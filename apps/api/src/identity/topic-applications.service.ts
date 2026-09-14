import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TopicApplicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from './policy.service';
import { SubmitTopicApplicationDto, UpdateTopicApplicationDto } from './dto/topic-application.dto';

@Injectable()
export class TopicApplicationsService {
  constructor(private readonly prisma: PrismaService, private readonly policy: PolicyService) {}

  async submit(userId: bigint, dto: SubmitTopicApplicationDto) {
    const organizationId = dto.organizationId ? BigInt(dto.organizationId) : null;
    if (dto.applicantType === 'MEMBER') {
      if (organizationId) throw new BadRequestException('會員提案不可指定組織');
      await this.policy.assertSeniorMember(userId);
    } else {
      if (!organizationId) throw new BadRequestException('組織提案必須指定組織');
      await this.policy.assertPartnerMember(userId, organizationId);
    }
    const application = await this.prisma.topicApplication.create({
      data: {
        applicantType: dto.applicantType,
        submitterId: userId,
        organizationId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category,
        topicType: dto.topicType,
        options: dto.options ?? Prisma.JsonNull,
        blocks: dto.blocks ? JSON.parse(JSON.stringify(dto.blocks)) : Prisma.JsonNull,
        voteDurationDays: dto.voteDurationDays,
        note: dto.note?.trim() || null,
        revisions: {
          create: {
            revisionNumber: 1,
            title: dto.title.trim(),
            description: dto.description?.trim() || null,
            category: dto.category,
            topicType: dto.topicType,
            options: dto.options ?? Prisma.JsonNull,
            blocks: dto.blocks ? JSON.parse(JSON.stringify(dto.blocks)) : Prisma.JsonNull,
            voteDurationDays: dto.voteDurationDays,
            note: dto.note?.trim() || null,
          },
        },
      },
      include: { organization: { select: { id: true, name: true } }, results: { include: { topic: { select: { id: true, title: true } } } } },
    });
    return this.serialize(application);
  }

  async list(userId: bigint, query: { status?: TopicApplicationStatus; organizationId?: bigint; page: number; limit: number }) {
    const allowedOrganizations = await this.policy.applicationOrganizationScope(userId);
    if (allowedOrganizations && query.organizationId && !allowedOrganizations.includes(query.organizationId)) {
      throw new ForbiddenException('您沒有檢視此組織提案的權限');
    }
    const page = Math.max(1, query.page);
    const limit = Math.min(50, Math.max(1, query.limit));
    const where: Prisma.TopicApplicationWhereInput = {
      status: query.status,
      organizationId: query.organizationId ?? (allowedOrganizations ? { in: allowedOrganizations } : undefined),
    };
    const [items, total] = await Promise.all([
      this.prisma.topicApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          organization: { select: { id: true, name: true } },
          submitter: { select: { id: true, nickname: true } },
          results: { include: { topic: { select: { id: true, title: true } } } },
        },
      }),
      this.prisma.topicApplication.count({ where }),
    ]);
    return { items: items.map((item) => this.serialize(item)), pagination: { page, limit, total } };
  }

  async listMine(userId: bigint, pageInput: number, limitInput: number) {
    const page = Math.max(1, pageInput);
    const limit = Math.min(50, Math.max(1, limitInput));
    const where = { submitterId: userId };
    const [items, total] = await Promise.all([
      this.prisma.topicApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { organization: { select: { id: true, name: true } }, results: { include: { topic: { select: { id: true, title: true } } } } },
      }),
      this.prisma.topicApplication.count({ where }),
    ]);
    return { items: items.map((item) => this.serialize(item)), pagination: { page, limit, total } };
  }

  async updateMine(userId: bigint, applicationId: bigint, dto: UpdateTopicApplicationDto) {
    const expectedUpdatedAt = new Date(dto.expectedUpdatedAt);
    const content = {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      category: dto.category,
      topicType: dto.topicType,
      options: dto.options ?? Prisma.JsonNull,
      blocks: dto.blocks ? JSON.parse(JSON.stringify(dto.blocks)) : Prisma.JsonNull,
      voteDurationDays: dto.voteDurationDays,
      note: dto.note?.trim() || null,
    };
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM topic_applications WHERE id = ${applicationId} FOR UPDATE`);
      const current = await tx.topicApplication.findUnique({ where: { id: applicationId } });
      if (!current || current.submitterId !== userId) throw new NotFoundException('議題提案不存在');
      if (!['PENDING', 'REJECTED'].includes(current.status)) throw new ConflictException('審核中或已採用的提案無法修改');
      if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new ConflictException('提案已被更新，請重新載入後再編輯');

      if (current.status === 'REJECTED') {
        const revisionNumber = current.revisionNumber + 1;
        return this.serialize(await tx.topicApplication.update({
          where: { id: applicationId },
          data: {
            ...content,
            status: 'PENDING',
            revisionNumber,
            revisions: { create: { revisionNumber, ...content } },
          },
          include: { organization: { select: { id: true, name: true } }, results: { include: { topic: { select: { id: true, title: true } } } } },
        }));
      }

      await tx.topicApplicationRevision.update({
        where: { applicationId_revisionNumber: { applicationId, revisionNumber: current.revisionNumber } },
        data: content,
      });
      return this.serialize(await tx.topicApplication.update({
        where: { id: applicationId },
        data: content,
        include: { organization: { select: { id: true, name: true } }, results: { include: { topic: { select: { id: true, title: true } } } } },
      }));
    });
  }

  async revisions(userId: bigint, applicationId: bigint) {
    const application = await this.prisma.topicApplication.findUnique({ where: { id: applicationId }, select: { submitterId: true } });
    if (!application || application.submitterId !== userId) throw new NotFoundException('議題提案不存在');
    const revisions = await this.prisma.topicApplicationRevision.findMany({ where: { applicationId }, orderBy: { revisionNumber: 'desc' } });
    return revisions.map((revision) => ({
      ...revision,
      id: revision.id.toString(),
      applicationId: revision.applicationId.toString(),
      reviewedById: revision.reviewedById?.toString() ?? null,
    }));
  }

  async review(userId: bigint, applicationId: bigint, status: 'IN_REVIEW' | 'REJECTED', note?: string) {
    const application = await this.prisma.topicApplication.findUnique({ where: { id: applicationId } });
    if (!application) throw new BadRequestException('提案不存在');
    const allowedOrganizations = await this.policy.applicationOrganizationScope(userId);
    if (allowedOrganizations && (!application.organizationId || !allowedOrganizations.includes(application.organizationId))) {
      throw new ForbiddenException('您沒有檢視此提案的權限');
    }
    if (!['PENDING', 'IN_REVIEW'].includes(application.status)) {
      throw new BadRequestException('此提案已完成處理');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.topicApplicationRevision.update({
        where: { applicationId_revisionNumber: { applicationId, revisionNumber: application.revisionNumber } },
        data: { status, reviewNote: note?.trim() || null, reviewedById: userId, reviewedAt: new Date() },
      });
      return tx.topicApplication.update({
        where: { id: applicationId },
        data: { status },
        include: {
          organization: { select: { id: true, name: true } },
          submitter: { select: { id: true, nickname: true } },
          results: { include: { topic: { select: { id: true, title: true } } } },
        },
      });
    });
    return this.serialize(updated);
  }

  private serialize(application: any) {
    return {
      ...application,
      id: application.id.toString(),
      submitterId: application.submitterId.toString(),
      organizationId: application.organizationId?.toString() ?? null,
      results: application.results?.map((result: any) => ({ topicId: result.topicId.toString(), topic: { ...result.topic, id: result.topic.id.toString() } })) ?? [],
      organization: application.organization ? { ...application.organization, id: application.organization.id.toString() } : null,
      submitter: application.submitter ? { ...application.submitter, id: application.submitter.id.toString() } : undefined,
    };
  }
}
