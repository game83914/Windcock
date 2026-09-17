import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TopicApplicationStatus } from '@prisma/client';
import { assertClean } from '../common/sensitive';
import { PrismaService } from '../prisma/prisma.service';
import { PublishStanceApplicationDto, ResolveStanceApplicationsDto, ReviewStanceApplicationDto, SubmitStanceApplicationDto, UpdateStanceApplicationDto } from './dto/stance-application.dto';
import { Capability, PolicyService } from './policy.service';
import { TopicAccessService } from '../topics/topic-access.service';

const MAX_DEPTH = Number(process.env.STANCE_MAX_DEPTH || 4);

@Injectable()
export class StanceApplicationsService {
  constructor(private readonly prisma: PrismaService, private readonly policy: PolicyService, private readonly topicAccess: TopicAccessService) {}

  async submit(userId: bigint, dto: SubmitStanceApplicationDto) {
    await this.policy.assertCanSubmitStanceApplication(userId);
    const topicId = BigInt(dto.topicId);
    const parentStanceId = dto.parentStanceId ? BigInt(dto.parentStanceId) : null;
    const title = dto.title.trim();
    const rationale = dto.rationale?.trim() || null;
    if (title.length < 2) throw new BadRequestException('立場名稱至少 2 個字');
    assertClean(title, '立場名稱');
    if (rationale) assertClean(rationale, '立場說明');
    await this.topicAccess.assertCanInteract(await this.accessTopic(topicId), userId);
    await this.assertOpenTarget(topicId, parentStanceId);
    const duplicate = await this.prisma.stanceApplication.findFirst({
      where: { submitterId: userId, topicId, parentStanceId, title: { equals: title, mode: 'insensitive' }, status: { in: ['PENDING', 'IN_REVIEW'] } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('你已有相同內容的立場提案正在處理');
    const daily = await this.prisma.stanceApplication.count({ where: { submitterId: userId, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
    if (daily >= 10) throw new ConflictException('今日立場提案數量已達上限');
    return this.serialize(await this.prisma.stanceApplication.create({
      data: {
        submitterId: userId,
        topicId,
        parentStanceId,
        title,
        rationale,
        note: dto.note?.trim() || null,
        revisions: { create: { revisionNumber: 1, title, rationale, note: dto.note?.trim() || null } },
      },
      include: this.include,
    }));
  }

  async listMine(userId: bigint, pageInput: number, limitInput: number) {
    const page = Math.max(1, pageInput);
    const limit = Math.min(50, Math.max(1, limitInput));
    const where = { submitterId: userId };
    const [items, total] = await Promise.all([
      this.prisma.stanceApplication.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: this.include }),
      this.prisma.stanceApplication.count({ where }),
    ]);
    return { items: items.map((item) => this.serialize(item)), pagination: { page, limit, total } };
  }

  async listMineForTopic(userId: bigint, topicId: bigint) {
    const items = await this.prisma.stanceApplication.findMany({
      where: { submitterId: userId, topicId, status: { in: ['PENDING', 'IN_REVIEW', 'REJECTED'] } },
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
    return items.map((item) => this.serialize(item));
  }

  async updateMine(userId: bigint, id: bigint, dto: UpdateStanceApplicationDto) {
    const title = dto.title.trim();
    const rationale = dto.rationale?.trim() || null;
    const note = dto.note?.trim() || null;
    this.cleanEdits({ title, rationale: rationale ?? undefined });
    const expectedUpdatedAt = new Date(dto.expectedUpdatedAt);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM stance_applications WHERE id = ${id} FOR UPDATE`);
      const current = await tx.stanceApplication.findUnique({ where: { id } });
      if (!current || current.submitterId !== userId) throw new NotFoundException('立場提案不存在');
      if (!['PENDING', 'REJECTED'].includes(current.status)) throw new ConflictException('審核中或已採用的提案無法修改');
      if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new ConflictException('提案已被更新，請重新載入後再編輯');
      await this.topicAccess.assertCanInteract(await this.accessTopic(current.topicId, tx), userId);
      await this.assertOpenTarget(current.topicId, current.parentStanceId, tx);

      if (current.status === 'REJECTED') {
        const revisionNumber = current.revisionNumber + 1;
        return this.serialize(await tx.stanceApplication.update({
          where: { id },
          data: {
            title,
            rationale,
            note,
            status: 'PENDING',
            revisionNumber,
            reviewNote: null,
            reviewedById: null,
            reviewedAt: null,
            revisions: { create: { revisionNumber, title, rationale, note } },
          },
          include: this.include,
        }));
      }

      await tx.stanceApplicationRevision.update({
        where: { applicationId_revisionNumber: { applicationId: id, revisionNumber: current.revisionNumber } },
        data: { title, rationale, note },
      });
      return this.serialize(await tx.stanceApplication.update({ where: { id }, data: { title, rationale, note }, include: this.include }));
    });
  }

  async revisions(userId: bigint, id: bigint) {
    const application = await this.prisma.stanceApplication.findUnique({ where: { id }, select: { submitterId: true } });
    if (!application || application.submitterId !== userId) throw new NotFoundException('立場提案不存在');
    const revisions = await this.prisma.stanceApplicationRevision.findMany({ where: { applicationId: id }, orderBy: { revisionNumber: 'desc' } });
    return revisions.map((revision) => ({
      ...revision,
      id: revision.id.toString(),
      applicationId: revision.applicationId.toString(),
      reviewedById: revision.reviewedById?.toString() ?? null,
    }));
  }

  async withdrawMine(userId: bigint, id: bigint) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM stance_applications WHERE id = ${id} FOR UPDATE`);
      const current = await tx.stanceApplication.findUnique({ where: { id }, include: { _count: { select: { results: true } } } });
      if (!current || current.submitterId !== userId) throw new NotFoundException('立場提案不存在');
      if (current._count.results || !['PENDING', 'IN_REVIEW', 'REJECTED'].includes(current.status)) {
        throw new ConflictException('此提案已完成處理，無法取消');
      }
      await tx.stanceApplicationRevision.update({
        where: { applicationId_revisionNumber: { applicationId: id, revisionNumber: current.revisionNumber } },
        data: { status: 'WITHDRAWN' },
      });
      await tx.stanceApplication.update({ where: { id }, data: { status: 'WITHDRAWN' } });
      return { withdrawn: true };
    });
  }

  async list(userId: bigint, query: { status?: TopicApplicationStatus; topicId?: bigint; page: number; limit: number }) {
    const scopes = await this.policy.editorialScopes(userId, Capability.TOPIC_APPLICATION_READ);
    if (scopes && !scopes.topicIds.length) throw new ForbiddenException('您沒有檢視立場提案的權限');
    const page = Math.max(1, query.page);
    const limit = Math.min(50, Math.max(1, query.limit));
    const where: Prisma.StanceApplicationWhereInput = {
      status: query.status,
      topicId: query.topicId,
      OR: scopes ? [
        ...(scopes.topicIds.length ? [{ topicId: { in: scopes.topicIds } }] : []),
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.stanceApplication.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: this.include }),
      this.prisma.stanceApplication.count({ where }),
    ]);
    return { items: items.map((item) => this.serialize(item)), pagination: { page, limit, total } };
  }

  async review(userId: bigint, id: bigint, dto: ReviewStanceApplicationDto) {
    const application = await this.prisma.stanceApplication.findUnique({ where: { id }, include: { _count: { select: { results: true } } } });
    if (!application) throw new NotFoundException('立場提案不存在');
    await this.policy.assert(userId, Capability.TOPIC_DRAFT, { topicId: application.topicId });
    const { title, rationale, reviewNote } = this.cleanEdits(dto);
    if (dto.status === 'REJECTED' && !dto.reviewNote?.trim()) throw new BadRequestException('未採用時必須填寫原因');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM stance_applications WHERE id = ${id} FOR UPDATE`);
      const current = await tx.stanceApplication.findUnique({ where: { id } });
      if (!current || !['PENDING', 'IN_REVIEW'].includes(current.status)) throw new ConflictException('此提案已完成處理');
      this.assertExpectedUpdatedAt(current.updatedAt, dto.expectedUpdatedAt);
      const reviewedAt = new Date();
      await tx.stanceApplicationRevision.update({
        where: { applicationId_revisionNumber: { applicationId: id, revisionNumber: current.revisionNumber } },
        data: {
          status: dto.status,
          title,
          rationale,
          reviewNote,
          reviewedById: userId,
          reviewedAt,
        },
      });
      return this.serialize(await tx.stanceApplication.update({
        where: { id },
        data: { status: dto.status, title, rationale, reviewNote, reviewedById: userId, reviewedAt },
        include: this.include,
      }));
    });
  }

  async publish(userId: bigint, id: bigint, dto: PublishStanceApplicationDto = {}) {
    const application = await this.prisma.stanceApplication.findUnique({ where: { id }, include: { _count: { select: { results: true } } } });
    if (!application) throw new NotFoundException('立場提案不存在');
    await this.policy.assert(userId, Capability.TOPIC_PUBLISH, { topicId: application.topicId });
    if (application._count.results || !['PENDING', 'IN_REVIEW'].includes(application.status)) throw new ConflictException('此提案已完成處理');
    const edits = this.cleanEdits(dto);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM stance_applications WHERE id = ${id} FOR UPDATE`);
      const current = await tx.stanceApplication.findUnique({ where: { id }, include: { _count: { select: { results: true } } } });
      if (!current || current._count.results || !['PENDING', 'IN_REVIEW'].includes(current.status)) throw new ConflictException('此提案已完成處理');
      this.assertExpectedUpdatedAt(current.updatedAt, dto.expectedUpdatedAt);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM topics WHERE id = ${current.topicId} FOR SHARE`);
      if (current.parentStanceId) await tx.$queryRaw(Prisma.sql`SELECT id FROM topic_stances WHERE id = ${current.parentStanceId} FOR SHARE`);
      const depth = await this.assertOpenTarget(current.topicId, current.parentStanceId, tx);
      const title = edits.title ?? current.title;
      const rationale = edits.rationale === undefined ? current.rationale : edits.rationale;
      const stance = await tx.topicStance.create({
        data: {
          topicId: current.topicId,
          parentId: current.parentStanceId,
          creatorId: userId,
          title,
          rationale,
          depth,
          applicationResults: { create: { applicationId: id } },
        },
      });
      const reviewedAt = new Date();
      await tx.stanceApplicationRevision.update({
        where: { applicationId_revisionNumber: { applicationId: id, revisionNumber: current.revisionNumber } },
        data: { status: 'APPROVED', title, rationale, reviewNote: edits.reviewNote, reviewedById: userId, reviewedAt },
      });
      const updated = await tx.stanceApplication.update({
        where: { id },
        data: { status: 'APPROVED', title, rationale, reviewNote: edits.reviewNote, reviewedById: userId, reviewedAt },
        include: this.include,
      });
      return this.serialize(updated);
    });
  }

  async resolve(userId: bigint, dto: ResolveStanceApplicationsDto) {
    const applicationIds = Array.from(new Set(dto.outputs.flatMap((output) => output.applicationIds))).map((id) => BigInt(id));
    const applications = await this.prisma.stanceApplication.findMany({
      where: { id: { in: applicationIds } },
      include: { _count: { select: { results: true } } },
    });
    if (applications.length !== applicationIds.length) throw new NotFoundException('部分立場提案不存在');
    const topicId = applications[0]?.topicId;
    if (!topicId || applications.some((application) => application.topicId !== topicId)) throw new BadRequestException('一次只能處理同一議題的提案');
    if (applications.some((application) => application._count.results || !['PENDING', 'IN_REVIEW'].includes(application.status))) {
      throw new ConflictException('部分提案已完成處理');
    }
    for (const output of dto.outputs) {
      if (new Set(output.applicationIds).size !== output.applicationIds.length) throw new BadRequestException('同一輸出不可重複指定來源提案');
      this.cleanEdits({ title: output.title, rationale: output.rationale });
    }
    await this.policy.assert(userId, Capability.TOPIC_PUBLISH, { topicId });

    return this.prisma.$transaction(async (tx) => {
      const sortedIds = [...applicationIds].sort((a, b) => (a < b ? -1 : 1));
      await tx.$queryRaw(Prisma.sql`SELECT id FROM stance_applications WHERE id IN (${Prisma.join(sortedIds)}) ORDER BY id FOR UPDATE`);
      const current = await tx.stanceApplication.findMany({ where: { id: { in: applicationIds } }, include: { _count: { select: { results: true } } } });
      if (current.some((application) => application._count.results || !['PENDING', 'IN_REVIEW'].includes(application.status))) {
        throw new ConflictException('部分提案已完成處理');
      }
      for (const application of current) {
        this.assertExpectedUpdatedAt(application.updatedAt, dto.expectedUpdatedAt?.[application.id.toString()]);
      }

      const stances = [];
      for (const output of dto.outputs) {
        const parentStanceId = output.parentStanceId ? BigInt(output.parentStanceId) : null;
        const depth = await this.assertOpenTarget(topicId, parentStanceId, tx);
        const title = output.title.trim();
        const rationale = output.rationale?.trim() || null;
        const stance = await tx.topicStance.create({
          data: {
            topicId,
            parentId: parentStanceId,
            creatorId: userId,
            title,
            rationale,
            depth,
            applicationResults: { create: output.applicationIds.map((applicationId) => ({ applicationId: BigInt(applicationId) })) },
          },
        });
        stances.push({ id: stance.id.toString(), title: stance.title, parentId: stance.parentId?.toString() ?? null });
      }

      const reviewedAt = new Date();
      const reviewNote = dto.reviewNote?.trim() || null;
      for (const application of current) {
        await tx.stanceApplicationRevision.update({
          where: { applicationId_revisionNumber: { applicationId: application.id, revisionNumber: application.revisionNumber } },
          data: { status: 'APPROVED', reviewNote, reviewedById: userId, reviewedAt },
        });
        await tx.stanceApplication.update({
          where: { id: application.id },
          data: { status: 'APPROVED', reviewNote, reviewedById: userId, reviewedAt },
        });
      }
      return { applicationIds: applicationIds.map(String), stances };
    });
  }

  private async assertOpenTarget(topicId: bigint, parentStanceId: bigint | null, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const topic = await db.topic.findUnique({ where: { id: topicId }, select: { status: true, moderationStatus: true, voteEndAt: true } });
    if (!topic) throw new NotFoundException('議題不存在');
    if (topic.status !== 'OPEN' || topic.moderationStatus !== 'APPROVED' || (topic.voteEndAt && topic.voteEndAt <= new Date())) throw new BadRequestException('此議題目前不開放立場提案');
    if (!parentStanceId) return 0;
    const parent = await db.topicStance.findFirst({ where: { id: parentStanceId, topicId, status: 'ACTIVE' }, select: { depth: true } });
    if (!parent) throw new NotFoundException('父立場不存在或已下架');
    if (parent.depth + 1 > MAX_DEPTH) throw new BadRequestException(`立場最深只能到第 ${MAX_DEPTH} 層`);
    return parent.depth + 1;
  }

  private async accessTopic(topicId: bigint, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const topic = await db.topic.findUnique({
      where: { id: topicId },
      select: { id: true, kind: true, visibility: true, audience: true, audienceOwnerId: true },
    });
    if (!topic) throw new NotFoundException('議題不存在');
    return topic;
  }

  private cleanEdits(dto: { title?: string; rationale?: string; reviewNote?: string }) {
    const title = dto.title === undefined ? undefined : dto.title.trim();
    const rationale = dto.rationale === undefined ? undefined : dto.rationale.trim() || null;
    const reviewNote = dto.reviewNote === undefined ? undefined : dto.reviewNote.trim() || null;
    if (title !== undefined) {
      if (title.length < 2) throw new BadRequestException('立場名稱至少 2 個字');
      assertClean(title, '立場名稱');
    }
    if (rationale) assertClean(rationale, '立場說明');
    return { title, rationale, reviewNote };
  }

  private assertExpectedUpdatedAt(updatedAt: Date, expected?: string) {
    if (expected && updatedAt.getTime() !== new Date(expected).getTime()) {
      throw new ConflictException('提案已被更新，請重新載入後再處理');
    }
  }

  private readonly include = {
    topic: { select: { id: true, title: true, status: true, moderationStatus: true, voteEndAt: true } },
    parentStance: {
      select: {
        id: true,
        title: true,
        status: true,
        depth: true,
        parent: {
          select: {
            id: true,
            title: true,
            parent: {
              select: {
                id: true,
                title: true,
                parent: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    },
    submitter: { select: { id: true, nickname: true } },
    results: { include: { stance: { select: { id: true, title: true } } }, orderBy: { createdAt: 'asc' as const } },
  } as const;

  private serialize(application: any) {
    const path: Array<{ id: string; title: string }> = [];
    let current = application.parentStance;
    while (current) {
      path.unshift({ id: current.id.toString(), title: current.title });
      current = current.parent;
    }
    const topicOpen = application.topic?.status === 'OPEN'
      && application.topic.moderationStatus === 'APPROVED'
      && (!application.topic.voteEndAt || application.topic.voteEndAt > new Date());
    const targetOpen = topicOpen && (!application.parentStance || application.parentStance.status === 'ACTIVE');
    let blockedReason: string | null = null;
    if (application.status === 'REJECTED' && !topicOpen) blockedReason = '議題目前未開放，無法重新送審';
    else if (application.status === 'REJECTED' && application.parentStance?.status !== 'ACTIVE') blockedReason = '原本回應的立場已下架，無法重新送審';
    return {
      ...application,
      id: application.id.toString(),
      submitterId: application.submitterId.toString(),
      topicId: application.topicId.toString(),
      parentStanceId: application.parentStanceId?.toString() ?? null,
      reviewedById: application.reviewedById?.toString() ?? null,
      results: application.results?.map((result: any) => ({
        stanceId: result.stanceId.toString(),
        createdAt: result.createdAt,
        stance: { ...result.stance, id: result.stance.id.toString() },
      })) ?? [],
      topic: application.topic ? { id: application.topic.id.toString(), title: application.topic.title } : undefined,
      parentStance: application.parentStance ? { id: application.parentStance.id.toString(), title: application.parentStance.title } : null,
      submitter: application.submitter ? { ...application.submitter, id: application.submitter.id.toString() } : undefined,
      target: application.topic ? {
        kind: application.parentStance ? 'STANCE' : 'TOPIC',
        topic: {
          id: application.topic.id.toString(),
          title: application.topic.title,
          status: application.topic.status,
          voteEndAt: application.topic.voteEndAt,
        },
        parent: application.parentStance ? {
          id: application.parentStance.id.toString(),
          title: application.parentStance.title,
          status: application.parentStance.status,
          depth: application.parentStance.depth,
        } : null,
        path,
        canEdit: application.status === 'PENDING',
        canResubmit: application.status === 'REJECTED' && targetOpen,
        blockedReason,
      } : undefined,
    };
  }
}
