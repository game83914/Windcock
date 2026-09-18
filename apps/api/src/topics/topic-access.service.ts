import { randomBytes, createHash } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TopicAudience, TopicKind, TopicVisibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

type AccessTopic = {
  id: bigint;
  kind: TopicKind;
  visibility: TopicVisibility;
  audience: TopicAudience;
  audienceOwnerId: bigint | null;
};

@Injectable()
export class TopicAccessService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeService) {}

  discoveryWhere(userId: bigint | null): Prisma.TopicWhereInput {
    const visible: Prisma.TopicWhereInput[] = [
      { visibility: TopicVisibility.PUBLIC, audience: TopicAudience.MEMBER_ONLY },
    ];
    if (userId) {
      visible.push({
        visibility: TopicVisibility.PUBLIC,
        audience: TopicAudience.FOLLOWERS_ONLY,
        OR: [
          { audienceOwnerId: userId },
          { audienceOwner: { channelFollowers: { some: { followingId: userId } } } },
        ],
      });
    }
    return { OR: visible };
  }

  async assertCanView(topic: AccessTopic, userId: bigint | null) {
    if (topic.visibility === TopicVisibility.PRIVATE_LINK) {
      if (!userId) throw new ForbiddenException('請先登入以查看此私密快問');
      const grant = await this.prisma.topicShareGrant.findFirst({
        where: { topicId: topic.id, userId, shareLink: { enabled: true, topicId: topic.id } },
        select: { userId: true },
      });
      if (!grant && topic.audienceOwnerId !== userId) throw new NotFoundException('私密連結無效或已停用');
    }
    if (topic.audience === TopicAudience.FOLLOWERS_ONLY) await this.assertFollower(topic, userId);
  }

  async assertCanInteract(topic: AccessTopic, userId: bigint) {
    await this.assertCanView(topic, userId);
  }

  async rotateShareLink(topicId: bigint, userId: bigint) {
    const topic = await this.ownedQuick(topicId, userId);
    if (topic.visibility !== TopicVisibility.PRIVATE_LINK) throw new ForbiddenException('只有私密內容可以建立分享連結');
    const token = randomBytes(24).toString('base64url');
    const tokenHash = this.hash(token);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.topicShareLink.findUnique({ where: { topicId }, select: { id: true } });
      if (existing) await tx.topicShareGrant.deleteMany({ where: { shareLinkId: existing.id } });
      await tx.topicShareLink.upsert({
        where: { topicId },
        create: { topicId, tokenHash, enabled: true },
        update: { tokenHash, enabled: true },
      });
    });
    await this.realtime.evictTopic(topicId, userId);
    return { enabled: true, sharePath: `/s/${token}` };
  }

  async disableShareLink(topicId: bigint, userId: bigint) {
    await this.ownedQuick(topicId, userId);
    await this.prisma.$transaction(async (tx) => {
      const link = await tx.topicShareLink.findUnique({ where: { topicId }, select: { id: true } });
      if (!link) return;
      await tx.topicShareGrant.deleteMany({ where: { shareLinkId: link.id } });
      await tx.topicShareLink.update({ where: { id: link.id }, data: { enabled: false } });
    });
    await this.realtime.evictTopic(topicId, userId);
    return { enabled: false };
  }

  async shareLinkStatus(topicId: bigint, userId: bigint) {
    await this.ownedQuick(topicId, userId);
    const link = await this.prisma.topicShareLink.findUnique({ where: { topicId }, select: { enabled: true, updatedAt: true } });
    return { enabled: link?.enabled ?? false, updatedAt: link?.updatedAt ?? null };
  }

  async redeem(token: string, userId: bigint) {
    const link = await this.prisma.topicShareLink.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { topic: { select: { id: true, kind: true, visibility: true, audience: true, audienceOwnerId: true } } },
    });
    if (!link?.enabled || (link.topic.kind !== TopicKind.QUICK && link.topic.kind !== TopicKind.SURVEY && link.topic.kind !== TopicKind.STAGED) || link.topic.visibility !== TopicVisibility.PRIVATE_LINK) {
      throw new NotFoundException('私密連結無效或已停用');
    }
    if (link.topic.audience === TopicAudience.FOLLOWERS_ONLY) await this.assertFollower(link.topic, userId);
    await this.prisma.topicShareGrant.upsert({
      where: { shareLinkId_userId: { shareLinkId: link.id, userId } },
      create: { shareLinkId: link.id, topicId: link.topicId, userId },
      update: {},
    });
    return { topicId: link.topicId.toString() };
  }

  async createShareLink(tx: Prisma.TransactionClient, topicId: bigint) {
    const token = randomBytes(24).toString('base64url');
    await tx.topicShareLink.create({ data: { topicId, tokenHash: this.hash(token), enabled: true } });
    return { enabled: true, sharePath: `/s/${token}` };
  }

  private async assertFollower(topic: AccessTopic, userId: bigint | null) {
    if (!userId) throw new ForbiddenException('此內容僅限發布者的頻道追蹤者');
    if (topic.audienceOwnerId === userId) return;
    if (!topic.audienceOwnerId) throw new ForbiddenException('此內容沒有可供追蹤的發布者');
    const follow = await this.prisma.channelFollow.findUnique({
      where: { followingId_channelOwnerId: { followingId: userId, channelOwnerId: topic.audienceOwnerId } },
      select: { followingId: true },
    });
    if (!follow) throw new ForbiddenException('此內容僅限發布者的頻道追蹤者');
  }

  private async ownedQuick(topicId: bigint, userId: bigint) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, kind: { in: [TopicKind.QUICK, TopicKind.SURVEY, TopicKind.STAGED] }, audienceOwnerId: userId },
      select: { id: true, kind: true, visibility: true, audience: true, audienceOwnerId: true },
    });
    if (!topic) throw new NotFoundException('內容不存在');
    return topic;
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
