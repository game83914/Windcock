import { ForbiddenException, Inject, Injectable, NotFoundException, Optional, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AssignmentRole, AssignmentScope, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export enum Capability {
  TOPIC_APPLICATION_READ = 'TOPIC_APPLICATION_READ',
  TOPIC_DRAFT = 'TOPIC_DRAFT',
  TOPIC_PUBLISH = 'TOPIC_PUBLISH',
  FORMAL_TOPIC_AUTHOR = 'FORMAL_TOPIC_AUTHOR',
  CATEGORY_MANAGE = 'CATEGORY_MANAGE',
  TOPIC_FEATURE = 'TOPIC_FEATURE',
  ADMIN = 'ADMIN',
}

const ROLE_CAPABILITIES: Record<AssignmentRole, Capability[]> = {
  TOPIC_TEAM: [
    Capability.TOPIC_APPLICATION_READ,
    Capability.TOPIC_DRAFT,
    Capability.TOPIC_PUBLISH,
    Capability.FORMAL_TOPIC_AUTHOR,
    Capability.CATEGORY_MANAGE,
    Capability.TOPIC_FEATURE,
  ],
};

export interface PolicyScope {
  organizationId?: bigint;
  topicId?: bigint;
}

export type ParticipationMode = 'ADMIN' | 'STAFF' | 'PARTNER' | 'MEMBER';
export type PublicAction = 'VOTE' | 'SIGNAL' | 'DISCUSS' | 'REPORT';
export type DevIdentityProfile = 'new-member' | 'senior-member' | 'partner-owner' | 'topic-team';

const STAFF_ASSIGNMENTS: AssignmentRole[] = ['TOPIC_TEAM'];

@Injectable({ scope: Scope.REQUEST })
export class PolicyService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(REQUEST) private readonly request?: { user?: AuthUser },
  ) {}

  async assert(userId: bigint, capability: Capability, scope: PolicyScope = {}) {
    if (!(await this.can(userId, capability, scope))) {
      throw new ForbiddenException('您沒有執行此操作的權限');
    }
  }

  async can(userId: bigint, capability: Capability, scope: PolicyScope = {}) {
    const context = await this.loadContext(userId);
    if (context.role === UserRole.ADMIN) return true;
    return context.assignments.some((assignment) =>
      ROLE_CAPABILITIES[assignment.role].includes(capability) && this.scopeMatches(assignment, scope),
    );
  }

  async capabilities(userId: bigint, profileOverride?: DevIdentityProfile) {
    const profile = profileOverride ?? this.currentProfile();
    const context = await this.loadContext(userId, profile);
    const eligibility = await this.evaluateSeniorEligibility(userId, context.createdAt, context.membershipTier, profile);
    const participation = this.participationFor(context, eligibility.membershipTier);
    const legacyCapabilities = context.role === UserRole.ADMIN ? Object.values(Capability) : [];
    return {
      membershipTier: eligibility.membershipTier,
      seniorEligibility: {
        eligible: eligibility.eligible,
        accountAgeDays: eligibility.accountAgeDays,
        distinctTopicsVoted: eligibility.distinctTopicsVoted,
        requiredAccountAgeDays: 30,
        requiredDistinctTopicsVoted: 10,
      },
      capabilities: [...new Set([
        ...legacyCapabilities,
        ...context.assignments.flatMap((assignment) => ROLE_CAPABILITIES[assignment.role]),
      ])],
      assignments: context.assignments.map((assignment) => ({
        role: assignment.role,
        scope: assignment.scope,
        organizationId: assignment.organizationId?.toString() ?? null,
        topicId: assignment.topicId?.toString() ?? null,
        expiresAt: assignment.expiresAt,
      })),
      partnerOrganizations: context.organizationMemberships.filter((membership) => membership.organization.isPartner).map((membership) => ({
        id: membership.organization.id.toString(),
        name: membership.organization.name,
        role: membership.role,
      })),
      participation,
      canViewAnalytics: ['ADMIN', 'STAFF', 'PARTNER'].includes(participation.mode),
    };
  }

  async canViewAnalytics(userId: bigint) {
    return ['ADMIN', 'STAFF', 'PARTNER'].includes(this.participationMode(await this.loadContext(userId)));
  }

  async canViewTopicAnalytics(userId: bigint, topicId: bigint) {
    const context = await this.loadContext(userId);
    if (context.role === UserRole.ADMIN) return true;
    if (context.assignments.some((assignment) => assignment.scope === AssignmentScope.GLOBAL)) return true;
    if (context.assignments.some((assignment) => assignment.scope === AssignmentScope.TOPIC && assignment.topicId === topicId)) return true;

    const organizationIds = new Set([
      ...context.assignments.flatMap((assignment) => assignment.scope === AssignmentScope.ORGANIZATION && assignment.organizationId ? [assignment.organizationId] : []),
      ...context.organizationMemberships.filter((membership) => membership.organization.isPartner).map((membership) => membership.organization.id),
    ].map(String));
    if (!organizationIds.size) return false;
    const source = await this.prisma.topicApplicationResult.findFirst({
      where: {
        topicId,
        application: { organizationId: { in: [...organizationIds].map(BigInt) } },
      },
      select: { topicId: true },
    });
    return !!source;
  }

  async assertPublicAction(userId: bigint, action: PublicAction) {
    const context = await this.loadContext(userId);
    const mode = this.participationMode(context);
    if (mode === 'ADMIN') return;
    if (mode === 'STAFF') throw new ForbiddenException('工作帳號只能執行後台職務，不能參與公開互動');
    if (mode === 'PARTNER') throw new ForbiddenException('合作組織帳號僅供提案與資訊查閱，不能參與公開互動');
    if (action === 'REPORT') {
      const eligibility = await this.evaluateSeniorEligibility(userId, context.createdAt, context.membershipTier);
      if (eligibility.membershipTier !== 'SENIOR') throw new ForbiddenException('檢舉功能限資深會員使用');
    }
  }

  async assertSeniorMember(userId: bigint) {
    const context = await this.loadContext(userId);
    const mode = this.participationMode(context);
    if (mode === 'ADMIN') return;
    if (mode !== 'MEMBER') throw new ForbiddenException('工作帳號與合作組織不可使用會員提案身份');
    const eligibility = await this.evaluateSeniorEligibility(userId, context.createdAt, context.membershipTier);
    if (eligibility.membershipTier !== 'SENIOR') {
      throw new ForbiddenException('會員提案需帳號滿 30 天，且曾在至少 10 個不同議題投票');
    }
  }

  async assertPartnerMember(userId: bigint, organizationId: bigint) {
    const context = await this.loadContext(userId);
    const mode = this.participationMode(context);
    if (mode !== 'PARTNER' && mode !== 'ADMIN') throw new ForbiddenException('此帳號不能代表合作組織提案');
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE', isPartner: true },
      },
      select: { userId: true },
    });
    if (!membership) throw new ForbiddenException('您不是此合作組織的有效成員');
  }

  async assertCanSubmitStanceApplication(userId: bigint) {
    const context = await this.loadContext(userId);
    const mode = this.participationMode(context);
    if (mode === 'ADMIN') return;
    if (mode !== 'MEMBER') throw new ForbiddenException('立場提案僅限資深會員使用');
    const eligibility = await this.evaluateSeniorEligibility(userId, context.createdAt, context.membershipTier);
    if (eligibility.membershipTier === 'SENIOR') return;
    throw new ForbiddenException('立場提案需為資深會員');
  }

  async applicationOrganizationScope(userId: bigint): Promise<bigint[] | null> {
    const context = await this.loadContext(userId);
    if (context.role === UserRole.ADMIN) return null;
    const eligible = context.assignments.filter((assignment) =>
      ROLE_CAPABILITIES[assignment.role].includes(Capability.TOPIC_APPLICATION_READ),
    );
    if (eligible.some((assignment) => assignment.scope === AssignmentScope.GLOBAL)) return null;
    const ids = eligible.flatMap((assignment) => assignment.scope === AssignmentScope.ORGANIZATION && assignment.organizationId
      ? [assignment.organizationId]
      : []);
    if (!ids.length) throw new ForbiddenException('您沒有檢視提案的權限');
    return ids;
  }

  async editorialScopes(userId: bigint, capability: Capability) {
    const context = await this.loadContext(userId);
    if (context.role === UserRole.ADMIN) return null;
    const eligible = context.assignments.filter((assignment) => ROLE_CAPABILITIES[assignment.role].includes(capability));
    if (eligible.some((assignment) => assignment.scope === AssignmentScope.GLOBAL)) return null;
    return {
      organizationIds: eligible.flatMap((assignment) => assignment.scope === AssignmentScope.ORGANIZATION && assignment.organizationId ? [assignment.organizationId] : []),
      topicIds: eligible.flatMap((assignment) => assignment.scope === AssignmentScope.TOPIC && assignment.topicId ? [assignment.topicId] : []),
    };
  }

  private scopeMatches(
    assignment: { scope: AssignmentScope; organizationId: bigint | null; topicId: bigint | null },
    scope: PolicyScope,
  ) {
    if (assignment.scope === AssignmentScope.GLOBAL) return true;
    if (assignment.scope === AssignmentScope.ORGANIZATION) {
      return !!scope.organizationId && assignment.organizationId === scope.organizationId;
    }
    return !!scope.topicId && assignment.topicId === scope.topicId;
  }

  private participationMode(context: Awaited<ReturnType<PolicyService['loadContext']>>): ParticipationMode {
    if (context.role === UserRole.ADMIN) return 'ADMIN';
    if (context.assignments.some((assignment) => STAFF_ASSIGNMENTS.includes(assignment.role))) return 'STAFF';
    if (context.organizationMemberships.some((membership) => membership.organization.isPartner)) return 'PARTNER';
    return 'MEMBER';
  }

  private participationFor(context: Awaited<ReturnType<PolicyService['loadContext']>>, membershipTier: 'NEW' | 'SENIOR') {
    const mode = this.participationMode(context);
    const admin = mode === 'ADMIN';
    const member = mode === 'MEMBER';
    const senior = membershipTier === 'SENIOR';
    return {
      mode,
      canVote: admin || member,
      canSignal: admin || member,
      canDiscuss: admin || member,
      canReport: admin || (member && senior),
      canSubmitTopicApplication: admin || (member && senior) || mode === 'PARTNER',
      canSubmitStanceApplication: admin || (member && senior),
    };
  }

  private loadContext(userId: bigint, profileOverride?: DevIdentityProfile) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        role: true,
        membershipTier: true,
        createdAt: true,
        roleAssignments: {
          where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          select: { role: true, scope: true, organizationId: true, topicId: true, expiresAt: true },
        },
        organizationMemberships: {
          where: { status: 'ACTIVE', organization: { status: 'ACTIVE' } },
          select: { role: true, organization: { select: { id: true, name: true, isPartner: true } } },
        },
      },
    }).then((user) => {
      const activeOrganizationIds = new Set(user.organizationMemberships.map((item) => item.organization.id.toString()));
      const context = {
        ...user,
        assignments: user.roleAssignments.filter((assignment) =>
          assignment.scope !== AssignmentScope.ORGANIZATION ||
          (!!assignment.organizationId && activeOrganizationIds.has(assignment.organizationId.toString())),
        ),
      };
      const profile = profileOverride ?? this.currentProfile();
      if (profile === 'new-member') return { ...context, role: UserRole.USER, membershipTier: 'NEW' as const, createdAt: new Date(), assignments: [], organizationMemberships: [] };
      if (profile === 'senior-member') return { ...context, role: UserRole.USER, membershipTier: 'SENIOR' as const, createdAt: new Date(0), assignments: [], organizationMemberships: [] };
      if (profile === 'partner-owner') return { ...context, role: UserRole.USER, membershipTier: 'NEW' as const, assignments: [], organizationMemberships: context.organizationMemberships.filter((item) => item.organization.isPartner) };
      if (profile === 'topic-team') return {
        ...context,
        role: UserRole.USER,
        membershipTier: 'SENIOR' as const,
        assignments: [{ role: AssignmentRole.TOPIC_TEAM, scope: AssignmentScope.GLOBAL, organizationId: null, topicId: null, expiresAt: null }],
        organizationMemberships: [],
      };
      return context;
    });
  }

  private async evaluateSeniorEligibility(userId: bigint, createdAt: Date, currentTier: 'NEW' | 'SENIOR', profile = this.currentProfile()) {
    if (profile) {
      const senior = profile === 'senior-member' || profile === 'topic-team';
      return { eligible: senior, membershipTier: senior ? 'SENIOR' as const : 'NEW' as const, accountAgeDays: senior ? 30 : 0, distinctTopicsVoted: senior ? 10 : 0 };
    }
    const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
    const distinctTopicsVoted = await this.prisma.vote.count({ where: { userId } });
    const eligible = accountAgeDays >= 30 && distinctTopicsVoted >= 10;
    const membershipTier = eligible ? 'SENIOR' as const : currentTier;
    if (membershipTier === 'SENIOR' && currentTier !== 'SENIOR') {
      await this.prisma.user.update({ where: { id: userId }, data: { membershipTier: 'SENIOR' } });
    }
    return { eligible, membershipTier, accountAgeDays, distinctTopicsVoted };
  }

  private currentProfile() {
    const profile = this.request?.user?.assumptionProfile;
    return ['new-member', 'senior-member', 'partner-owner', 'topic-team'].includes(profile || '') ? profile as DevIdentityProfile : undefined;
  }
}
