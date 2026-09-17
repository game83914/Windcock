import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAccountDto, VoteHistoryQuery } from './dto/member-center.dto';
import { AvatarStorageService } from '../avatars/avatar-storage.service';
import { AvatarPreset } from '../avatars/avatar-presets';
import { resolveAvatarUrl } from '../avatars/avatar-url';
import { DEMOGRAPHIC_CONSENT_VERSION } from '../profiles/demographic-profiles.service';

@Injectable()
export class MemberCenterService {
  constructor(private readonly prisma: PrismaService, private readonly avatars: AvatarStorageService) {}

  async dashboard(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        nickname: true,
        avatarUrl: true,
        phoneNumber: true,
        pointsBalance: true,
        role: true,
        isPhoneVerified: true,
        createdAt: true,
        demographicProfile: {
          select: {
            birthDateCiphertext: true,
            gender: true,
            occupation: true,
            region: true,
            district: true,
            personalityType: true,
            employmentStatus: true,
            industry: true,
            annualIncome: true,
            education: true,
            relationship: true,
            livingArrangement: true,
            parentingStage: true,
            housingStatus: true,
            analyticsConsent: true,
            consentVersion: true,
            isMinor: true,
            guardianConsentStatus: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('會員不存在');

    const [voteCount, topicCount, pendingTopicCount, unreadCount, collectedMemeCount, createdMemeCount, pendingMemeCount, recentVotes, recentTopics] = await Promise.all([
      this.prisma.vote.count({ where: { userId } }),
      this.prisma.topic.count({ where: { creatorId: userId, kind: 'FORMAL' } }),
      this.prisma.topic.count({ where: { creatorId: userId, kind: 'FORMAL', moderationStatus: 'PENDING_REVIEW' } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.memeCollection.count({ where: { userId, meme: { status: 'APPROVED' } } }),
      this.prisma.meme.count({ where: { creatorId: userId } }),
      this.prisma.meme.count({ where: { creatorId: userId, status: 'PENDING_REVIEW' } }),
      this.prisma.vote.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          option: { select: { label: true } },
          selections: { orderBy: { optionId: 'asc' }, select: { option: { select: { label: true } } } },
          topic: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.topic.findMany({
        where: { creatorId: userId, kind: 'FORMAL' },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, title: true, status: true, moderationStatus: true, updatedAt: true },
      }),
    ]);

    const profile = user.demographicProfile;
    const completedFields = profile
      ? [
          profile.birthDateCiphertext,
          profile.gender,
          profile.region,
          profile.district,
          profile.personalityType,
          profile.employmentStatus,
          profile.industry,
          profile.annualIncome,
          profile.education,
          profile.relationship,
          profile.livingArrangement,
          profile.parentingStage,
          profile.housingStatus,
        ].filter(Boolean).length
      : 0;
    const profileStatus = !profile
      ? 'NOT_STARTED'
       : profile.analyticsConsent && profile.consentVersion === DEMOGRAPHIC_CONSENT_VERSION && profile.isMinor && profile.guardianConsentStatus !== 'VERIFIED'
         ? 'PENDING_GUARDIAN'
         : profile.analyticsConsent && profile.consentVersion === DEMOGRAPHIC_CONSENT_VERSION
          ? 'ACTIVE'
          : 'INACTIVE';

    return {
      member: {
        nickname: user.nickname,
        avatarUrl: resolveAvatarUrl(user.avatarUrl),
        maskedPhone: maskPhone(user.phoneNumber),
        points: user.pointsBalance.toString(),
        role: user.role,
        isPhoneVerified: user.isPhoneVerified,
        createdAt: user.createdAt,
      },
      counts: {
        votes: voteCount,
        topics: topicCount,
        pendingTopics: pendingTopicCount,
        unreadNotifications: unreadCount,
        collectedMemes: collectedMemeCount,
        createdMemes: createdMemeCount,
        pendingMemes: pendingMemeCount,
      },
      profile: { status: profileStatus, completionPercent: Math.round(completedFields / 13 * 100) },
      recentVotes: recentVotes.map((vote) => ({
        id: vote.id.toString(),
        topicId: vote.topic.id.toString(),
        topicTitle: vote.topic.title,
        topicStatus: vote.topic.status,
        selection: vote.selections.length
          ? vote.selections.map((selection) => selection.option.label).join('、')
          : vote.option?.label ?? (vote.spectrumValue !== null ? String(vote.spectrumValue) : null),
        votedAt: vote.createdAt,
      })),
      recentTopics: recentTopics.map((topic) => ({ ...topic, id: topic.id.toString() })),
    };
  }

  async votes(userId: bigint, query: VoteHistoryQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: Prisma.VoteWhereInput = { userId };
    if (query.status === 'OPEN') where.topic = { status: 'OPEN' };
    if (query.status === 'CLOSED') where.topic = { status: { in: ['LOCKED', 'SETTLED', 'CANCELLED'] } };

    const [votes, total, rewards] = await Promise.all([
      this.prisma.vote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          option: { select: { label: true } },
          selections: { orderBy: { optionId: 'asc' }, select: { option: { select: { label: true } } } },
          topic: {
            select: {
              id: true,
              title: true,
              category: true,
              status: true,
              moderationStatus: true,
            },
          },
        },
      }),
      this.prisma.vote.count({ where }),
      this.prisma.pointTransaction.findMany({
        where: { userId, txType: 'VOTE_REWARD' },
        select: { referenceId: true, amount: true },
      }),
    ]);
    const rewardByTopic = new Map(rewards.map((item) => [item.referenceId, item.amount.toString()]));

    return {
      items: votes.map((vote) => ({
        id: vote.id.toString(),
        topicId: vote.topic.id.toString(),
        topicTitle: vote.topic.title,
        category: vote.topic.category,
        topicStatus: vote.topic.status,
        moderationStatus: vote.topic.moderationStatus,
        selection: vote.selections.length
          ? vote.selections.map((selection) => selection.option.label).join('、')
          : vote.option?.label ?? null,
        spectrumValue: vote.spectrumValue,
        rewardPoints: rewardByTopic.get(vote.topic.id.toString()) || '0',
        votedAt: vote.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async updateAccount(userId: bigint, dto: UpdateAccountDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { nickname: dto.nickname.trim() },
      select: { id: true, nickname: true, avatarUrl: true, pointsBalance: true, role: true, status: true, isPhoneVerified: true },
    });
    return {
      id: user.id.toString(),
      nickname: user.nickname,
      avatarUrl: resolveAvatarUrl(user.avatarUrl),
      points: user.pointsBalance.toString(),
      role: user.role,
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
    };
  }

  async points(userId: bigint) {
    const [user, transactions] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { pointsBalance: true } }),
      this.prisma.pointTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    return {
      balance: user.pointsBalance.toString(),
      items: transactions.map((item) => ({
        id: item.id.toString(),
        amount: item.amount.toString(),
        balanceAfter: item.balanceAfter.toString(),
        txType: item.txType,
        note: item.note,
        createdAt: item.createdAt,
      })),
    };
  }

  async uploadAvatar(userId: bigint, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('請選擇頭像圖片');
    const key = await this.avatars.processUpload(file.path);
    const reference = `upload:${key}`;
    const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarUrl: true } });
    let user;
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: reference } });
      user = await this.sessionUser(userId);
    } catch (error) {
      await this.avatars.removeReference(reference);
      throw error;
    }
    await this.avatars.removeReference(existing.avatarUrl).catch(() => undefined);
    return user;
  }

  async selectAvatar(userId: bigint, preset: AvatarPreset) {
    const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarUrl: true } });
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: `preset:${preset}` } });
    await this.avatars.removeReference(existing.avatarUrl);
    return this.sessionUser(userId);
  }

  async removeAvatar(userId: bigint) {
    const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarUrl: true } });
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    await this.avatars.removeReference(existing.avatarUrl);
    return this.sessionUser(userId);
  }

  private async sessionUser(userId: bigint) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, nickname: true, avatarUrl: true, pointsBalance: true, role: true, status: true, isPhoneVerified: true },
    });
    return {
      id: user.id.toString(),
      nickname: user.nickname,
      avatarUrl: resolveAvatarUrl(user.avatarUrl),
      points: user.pointsBalance.toString(),
      role: user.role,
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
    };
  }
}

function maskPhone(phone: string) {
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}
