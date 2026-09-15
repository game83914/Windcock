import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TopicStanceSignalType, TopicType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveAvatarUrl } from '../avatars/avatar-url';
import { ReportStanceDto } from './dto/stances.dto';
import { PolicyService } from '../identity/policy.service';

const COMMON_GROUND_MIN = Number(process.env.STANCE_COMMON_GROUND_MIN || 3);
const MAX_DEPTH = Number(process.env.STANCE_MAX_DEPTH || 4);

interface Camp {
  optionId: string;
  label: string;
  count: number;
}

export interface NodeView {
  id: string;
  parentId: string | null;
  title: string;
  rationale: string | null;
  depth: number;
  status: string;
  creator: { nickname: string; avatarUrl: string | null };
  proposedBy: Array<{ type: 'MEMBER'; label: string }>;
  agreed: number;
  disagreed: number;
  discussionCount: number;
  mySignals: TopicStanceSignalType[];
  camps: Camp[] | null;
  unvotedAgree: number;
  commonGround: boolean;
  createdAt: string;
  children: NodeView[];
}

@Injectable()
export class StancesService {
  constructor(private readonly prisma: PrismaService, private readonly policy: PolicyService) {}

  async list(topicId: bigint, userId: bigint | null, includeAnalytics = false) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { options: { orderBy: { id: 'asc' } } },
    });
    if (!topic) throw new NotFoundException('議題不存在');
    if (topic.moderationStatus !== 'APPROVED') throw new NotFoundException('議題尚未公開');

    const rows = await this.prisma.topicStance.findMany({
      where: { topicId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { nickname: true, avatarUrl: true } },
        applicationResults: { include: { application: { select: { submitter: { select: { nickname: true } } } } } },
        _count: { select: { posts: true } },
      },
    });
    if (rows.length === 0) {
      return { topicId: topicId.toString(), topicType: topic.topicType, maxDepth: MAX_DEPTH, camps: includeAnalytics ? this.campHeadings(topic) : null, commonGroundCount: 0, count: 0, roots: [] };
    }

    const ids = rows.map((row) => row.id);
    const [agreeSignals, mySignals] = await Promise.all([
      includeAnalytics
        ? this.prisma.topicStanceSignal.findMany({
            where: { stanceId: { in: ids }, signal: 'AGREE' },
            select: { stanceId: true, userId: true },
          })
        : Promise.resolve([]),
      userId
        ? this.prisma.topicStanceSignal.findMany({
            where: { stanceId: { in: ids }, userId },
            select: { stanceId: true, signal: true },
          })
        : Promise.resolve([]),
    ]);

    const agreeingUserIds = Array.from(new Set(agreeSignals.map((item) => item.userId.toString())));
    const votes = agreeingUserIds.length
      ? await this.prisma.vote.findMany({
          where: { topicId, userId: { in: agreeingUserIds.map((id) => BigInt(id)) } },
          select: { userId: true, optionId: true },
        })
      : [];
    const voteByUser = new Map(votes.map((vote) => [vote.userId.toString(), vote.optionId?.toString() ?? null]));
    const agreeByStance = new Map<string, { camps: Map<string, number>; unvoted: number }>();
    for (const item of agreeSignals) {
      const key = item.stanceId.toString();
      const entry = agreeByStance.get(key) ?? { camps: new Map<string, number>(), unvoted: 0 };
      const optionId = voteByUser.get(item.userId.toString()) ?? null;
      if (optionId) {
        entry.camps.set(optionId, (entry.camps.get(optionId) ?? 0) + 1);
      } else {
        entry.unvoted += 1;
      }
      agreeByStance.set(key, entry);
    }
    const mySignalsByStance = new Map<string, TopicStanceSignalType[]>();
    for (const item of mySignals) {
      const key = item.stanceId.toString();
      const list = mySignalsByStance.get(key) ?? [];
      list.push(item.signal);
      mySignalsByStance.set(key, list);
    }

    const nodeMap = new Map<string, NodeView>();
    for (const row of rows) {
      const key = row.id.toString();
      const agree = agreeByStance.get(key);
      let camps: Camp[] | null = null;
      const campMeta = includeAnalytics ? this.campOptions(topic) : null;
      if (campMeta) {
        camps = campMeta.map((option) => {
          const optionKey = option.id.toString();
          return {
            optionId: optionKey,
            label: option.label,
            count: agree?.camps.get(optionKey) ?? 0,
          };
        });
      }
      const campCounts = camps ? camps.map((camp) => camp.count) : [];
      const commonGround = camps !== null && campCounts.length === 2
        ? Math.min(campCounts[0], campCounts[1]) >= COMMON_GROUND_MIN
        : false;
      nodeMap.set(key, {
        id: key,
        parentId: row.parentId?.toString() ?? null,
        title: row.title,
        rationale: row.rationale,
        depth: row.depth,
        status: row.status,
        creator: { nickname: row.creator.nickname, avatarUrl: resolveAvatarUrl(row.creator.avatarUrl) },
        proposedBy: Array.from(new Set(row.applicationResults.map((result) => result.application.submitter.nickname)))
          .map((label) => ({ type: 'MEMBER' as const, label })),
        agreed: row.agreementCount,
        disagreed: row.disagreementCount,
        discussionCount: row._count.posts,
        mySignals: mySignalsByStance.get(key) ?? [],
        camps,
        unvotedAgree: agree?.unvoted ?? 0,
        commonGround,
        createdAt: row.createdAt.toISOString(),
        children: [],
      });
    }

    const roots: NodeView[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    let commonGroundCount = 0;
    for (const node of nodeMap.values()) {
      if (node.commonGround) commonGroundCount += 1;
    }

    return {
      topicId: topicId.toString(),
      topicType: topic.topicType,
      maxDepth: MAX_DEPTH,
      camps: includeAnalytics ? this.campHeadings(topic) : null,
      commonGroundCount,
      count: rows.length,
      roots,
    };
  }

  async remove(topicId: bigint, stanceId: bigint, userId: bigint) {
    const stance = await this.prisma.topicStance.findFirst({
      where: { id: stanceId, topicId },
      include: { applicationResults: { select: { applicationId: true }, take: 1 }, _count: { select: { children: true, posts: true, signals: true, pendingApplications: true } } },
    });
    if (!stance) throw new NotFoundException('立場節點不存在');
    if (stance.creatorId !== userId) throw new ForbiddenException('只能刪除自己建立的立場');
    if (stance.applicationResults.length) throw new ForbiddenException('經議題小組發布的立場只能透過內容管理流程處理');
    if (stance._count.pendingApplications > 0) throw new ConflictException('此立場仍有相關提案紀錄，無法刪除');
    if (stance._count.children > 0) throw new ConflictException('此立場底下已有子立場，無法刪除');
    if (stance._count.posts > 0) throw new ConflictException('此立場已有討論，無法刪除');
    await this.prisma.topicStance.delete({ where: { id: stanceId } });
    return { deleted: true };
  }

  async toggleSignal(topicId: bigint, stanceId: bigint, userId: bigint, signal: TopicStanceSignalType) {
    await this.policy.assertPublicAction(userId, 'SIGNAL');
    const stance = await this.prisma.topicStance.findFirst({
      where: { id: stanceId, topicId, status: 'ACTIVE' },
      select: { id: true, topic: { select: { status: true, moderationStatus: true } } },
    });
    if (!stance) throw new NotFoundException('立場節點不存在或已下架');
    if (stance.topic.status !== 'OPEN' || stance.topic.moderationStatus !== 'APPROVED') {
      throw new BadRequestException('此議題目前不開放新增訊號');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.topicStanceSignal.findUnique({
            where: { stanceId_userId_signal: { stanceId, userId, signal } },
          });
          let active = true;
          if (existing) {
            await tx.topicStanceSignal.delete({ where: { id: existing.id } });
            active = false;
          } else {
            const opposite = signal === 'AGREE' ? 'DISAGREE' : 'AGREE';
            await tx.topicStanceSignal.deleteMany({ where: { stanceId, userId, signal: opposite } });
            await tx.topicStanceSignal.create({ data: { stanceId, userId, signal } });
          }

          const [agreementCount, disagreementCount] = await Promise.all([
            tx.topicStanceSignal.count({ where: { stanceId, signal: 'AGREE' } }),
            tx.topicStanceSignal.count({ where: { stanceId, signal: 'DISAGREE' } }),
          ]);
          await tx.topicStance.update({
            where: { id: stanceId },
            data: { agreementCount, disagreementCount },
          });
          return { active, signal };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError
          && (error.code === 'P2002' || error.code === 'P2034');
        if (!retryable || attempt === 2) throw error;
      }
    }
    throw new ConflictException('立場訊號更新衝突，請再試一次');
  }

  async report(topicId: bigint, stanceId: bigint, reporterId: bigint, dto: ReportStanceDto) {
    await this.policy.assertPublicAction(reporterId, 'REPORT');
    const stance = await this.prisma.topicStance.findFirst({
      where: { id: stanceId, topicId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!stance) throw new NotFoundException('立場節點不存在或已下架');
    const existing = await this.prisma.topicStanceReport.findUnique({
      where: { stanceId_reporterId: { stanceId, reporterId } },
    });
    if (existing?.status === 'OPEN') throw new ConflictException('你已檢舉過此立場，正在處理中');
    if (existing) {
      await this.prisma.topicStanceReport.update({
        where: { id: existing.id },
        data: { reason: dto.reason, detail: dto.detail?.trim() || null, status: 'OPEN', resolvedAt: null },
      });
      return { reported: true };
    }
    await this.prisma.topicStanceReport.create({
      data: { stanceId, reporterId, reason: dto.reason, detail: dto.detail?.trim() || null },
    });
    return { reported: true };
  }

  async listReports(page: number, limit: number) {
    const p = Math.max(1, page);
    const l = Math.min(50, Math.max(1, limit));
    const [items, total] = await Promise.all([
      this.prisma.topicStanceReport.findMany({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
        include: {
          stance: { select: { id: true, title: true, topicId: true } },
          reporter: { select: { nickname: true } },
        },
      }),
      this.prisma.topicStanceReport.count({ where: { status: 'OPEN' } }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id.toString(),
        stanceId: item.stanceId.toString(),
        stanceTitle: item.stance.title,
        topicId: item.stance.topicId.toString(),
        reporter: item.reporter.nickname,
        reason: item.reason,
        detail: item.detail,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: { page: p, limit: l, total },
    };
  }

  async takedown(stanceId: bigint, adminId: bigint, reason: string) {
    const stance = await this.prisma.topicStance.findUnique({ where: { id: stanceId } });
    if (!stance) throw new NotFoundException('立場節點不存在');
    await this.prisma.$transaction([
      this.prisma.topicStance.update({
        where: { id: stanceId },
        data: { status: 'TAKEN_DOWN', takenDownById: adminId, takenDownAt: new Date(), takedownReason: reason.trim() },
      }),
      this.prisma.topicStanceReport.updateMany({
        where: { stanceId, status: 'OPEN' },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      }),
    ]);
    return { takenDown: true };
  }

  async restore(stanceId: bigint) {
    const stance = await this.prisma.topicStance.findUnique({ where: { id: stanceId } });
    if (!stance) throw new NotFoundException('立場節點不存在');
    await this.prisma.topicStance.update({
      where: { id: stanceId },
      data: { status: 'ACTIVE', takenDownById: null, takenDownAt: null, takedownReason: null },
    });
    return { restored: true };
  }

  private async nodeView(stanceId: bigint, userId: bigint) {
    const stance = await this.prisma.topicStance.findUnique({
      where: { id: stanceId },
      include: {
        creator: { select: { nickname: true, avatarUrl: true } },
        _count: { select: { posts: true } },
      },
    });
    if (!stance) throw new NotFoundException('立場節點不存在');
    const mySignals = await this.prisma.topicStanceSignal.findMany({
      where: { stanceId, userId },
      select: { signal: true },
    });
    return {
      id: stance.id.toString(),
      parentId: stance.parentId?.toString() ?? null,
      title: stance.title,
      rationale: stance.rationale,
      depth: stance.depth,
      status: stance.status,
      creator: { nickname: stance.creator.nickname, avatarUrl: resolveAvatarUrl(stance.creator.avatarUrl) },
      agreed: stance.agreementCount,
      disagreed: stance.disagreementCount,
      discussionCount: stance._count.posts,
      mySignals: mySignals.map((item) => item.signal),
      camps: null,
      unvotedAgree: 0,
      commonGround: false,
      createdAt: stance.createdAt.toISOString(),
    };
  }

  private campOptions(topic: { topicType: TopicType; options: Array<{ id: bigint; label: string }> }) {
    if (topic.topicType === 'BINARY') return topic.options.slice(0, 2);
    if (topic.topicType === 'MULTIPLE' || topic.topicType === 'IMAGE_MULTIPLE') return topic.options;
    return null;
  }

  private campHeadings(topic: { topicType: TopicType; options: Array<{ id: bigint; label: string }> }) {
    const camps = this.campOptions(topic);
    return camps ? camps.map((option) => ({ optionId: option.id.toString(), label: option.label })) : null;
  }

}
