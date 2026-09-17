import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveAvatarUrl } from '../avatars/avatar-url';
import { RealtimeService } from '../realtime/realtime.service';

export interface ChannelProfile {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  channelBio: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isSelf: boolean;
}

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeService) {}

  async channelPage(channelOwnerId: bigint, viewerId: bigint | null): Promise<ChannelProfile> {
    const owner = await this.prisma.user.findUnique({
      where: { id: channelOwnerId },
      select: { nickname: true, avatarUrl: true, channelBio: true },
    });
    if (!owner) throw new NotFoundException('會員不存在');
    const [followerCount, followingCount] = await Promise.all([
      this.prisma.channelFollow.count({ where: { channelOwnerId } }),
      this.prisma.channelFollow.count({ where: { followingId: channelOwnerId } }),
    ]);
    const isFollowing =
      viewerId !== null
        ? (await this.prisma.channelFollow.count({ where: { followingId: viewerId, channelOwnerId } })) > 0
        : false;
    return {
      id: channelOwnerId.toString(),
      nickname: owner.nickname,
      avatarUrl: resolveAvatarUrl(owner.avatarUrl),
      channelBio: owner.channelBio ?? null,
      followerCount,
      followingCount,
      isFollowing,
      isSelf: viewerId !== null && viewerId === channelOwnerId,
    };
  }

  async follow(followingId: bigint, channelOwnerId: bigint): Promise<ChannelProfile> {
    if (followingId === channelOwnerId) throw new BadRequestException('不能追蹤自己的頻道');
    const owner = await this.prisma.user.findUnique({ where: { id: channelOwnerId }, select: { id: true } });
    if (!owner) throw new NotFoundException('會員不存在');
    await this.prisma.channelFollow.upsert({
      where: { followingId_channelOwnerId: { followingId, channelOwnerId } },
      create: { followingId, channelOwnerId },
      update: {},
    });
    return this.channelPage(channelOwnerId, followingId);
  }

  async unfollow(followingId: bigint, channelOwnerId: bigint): Promise<ChannelProfile> {
    await this.prisma.channelFollow.deleteMany({ where: { followingId, channelOwnerId } });
    const restrictedTopics = await this.prisma.topic.findMany({
      where: { audienceOwnerId: channelOwnerId, audience: 'FOLLOWERS_ONLY' },
      select: { id: true },
    });
    await this.realtime.evictUserFromTopics(followingId, restrictedTopics.map((topic) => topic.id));
    return this.channelPage(channelOwnerId, followingId);
  }

  async myChannel(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true, avatarUrl: true, channelBio: true },
    });
    if (!user) throw new NotFoundException('會員不存在');
    const [followerCount, followingCount] = await Promise.all([
      this.prisma.channelFollow.count({ where: { channelOwnerId: userId } }),
      this.prisma.channelFollow.count({ where: { followingId: userId } }),
    ]);
    return {
      id: userId.toString(),
      nickname: user.nickname,
      avatarUrl: resolveAvatarUrl(user.avatarUrl),
      channelBio: user.channelBio ?? null,
      followerCount,
      followingCount,
    };
  }

  async updateBio(userId: bigint, bio: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { channelBio: bio.trim().slice(0, 100) || null },
    });
    return this.myChannel(userId);
  }

  async followers(channelOwnerId: bigint, pageInput = 1, limitInput = 20) {
    const page = Math.max(1, pageInput);
    const limit = Math.min(50, Math.max(1, limitInput));
    const where = { channelOwnerId };
    const [rows, total] = await Promise.all([
      this.prisma.channelFollow.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          following: { select: { id: true, nickname: true, avatarUrl: true } },
          createdAt: true,
        },
      }),
      this.prisma.channelFollow.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        user: {
          ...row.following,
          id: row.following.id.toString(),
          avatarUrl: resolveAvatarUrl(row.following.avatarUrl),
        },
        createdAt: row.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async followingIds(followingId: bigint, pageInput = 1, limitInput = 20) {
    const page = Math.max(1, pageInput);
    const limit = Math.min(50, Math.max(1, limitInput));
    const where = { followingId };
    const [rows, total] = await Promise.all([
      this.prisma.channelFollow.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { channelOwnerId: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          channelOwner: { select: { id: true, nickname: true, avatarUrl: true } },
          createdAt: true,
        },
      }),
      this.prisma.channelFollow.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        user: {
          ...row.channelOwner,
          id: row.channelOwner.id.toString(),
          avatarUrl: resolveAvatarUrl(row.channelOwner.avatarUrl),
        },
        createdAt: row.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}
