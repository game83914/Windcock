import { ForbiddenException } from '@nestjs/common';
import { Capability, PolicyService } from './policy.service';

describe('PolicyService', () => {
  const baseUser = {
    role: 'USER',
    membershipTier: 'NEW',
    createdAt: new Date(Date.now() - 31 * 86_400_000),
    roleAssignments: [],
    organizationMemberships: [],
  };

  const createPolicy = (user: typeof baseUser & Record<string, unknown>, votes = 0) => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({}),
      },
      vote: { count: jest.fn().mockResolvedValue(votes) },
    };
    return new PolicyService(prisma as never);
  };

  it('treats the highest admin as having every capability', async () => {
    const prisma = { user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseUser, role: 'ADMIN' }) } };
    const policy = new PolicyService(prisma as never);
    await expect(policy.can(BigInt(1), Capability.TOPIC_PUBLISH)).resolves.toBe(true);
  });

  it('honors organization scope and does not leak it to another organization', async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...baseUser,
        organizationMemberships: [{ role: 'MEMBER', organization: { id: BigInt(7), name: 'Partner', isPartner: true } }],
        roleAssignments: [{
          role: 'TOPIC_TEAM', scope: 'ORGANIZATION', organizationId: BigInt(7), topicId: null, expiresAt: null,
        }],
      }) },
    };
    const policy = new PolicyService(prisma as never);
    await expect(policy.can(BigInt(1), Capability.TOPIC_DRAFT, { organizationId: BigInt(7) })).resolves.toBe(true);
    await expect(policy.can(BigInt(1), Capability.TOPIC_PUBLISH, { organizationId: BigInt(7) })).resolves.toBe(true);
    await expect(policy.can(BigInt(1), Capability.FORMAL_TOPIC_AUTHOR, { organizationId: BigInt(7) })).resolves.toBe(true);
    await expect(policy.can(BigInt(1), Capability.TOPIC_DRAFT, { organizationId: BigInt(8) })).resolves.toBe(false);
  });

  it('limits topic-scoped analytics access to the assigned topic', async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...baseUser,
        roleAssignments: [{ role: 'TOPIC_TEAM', scope: 'TOPIC', organizationId: null, topicId: 9n, expiresAt: null }],
      }) },
    };
    const policy = new PolicyService(prisma as never);

    await expect(policy.canViewTopicAnalytics(1n, 9n)).resolves.toBe(true);
    await expect(policy.canViewTopicAnalytics(1n, 10n)).resolves.toBe(false);
  });

  it('limits partner analytics to topics sourced from their organization', async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce({ topicId: 9n })
      .mockResolvedValueOnce(null);
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...baseUser,
        organizationMemberships: [{ role: 'MEMBER', organization: { id: 7n, name: 'Partner', isPartner: true } }],
      }) },
      topicApplicationResult: { findFirst },
    };
    const policy = new PolicyService(prisma as never);

    await expect(policy.canViewTopicAnalytics(1n, 9n)).resolves.toBe(true);
    await expect(policy.canViewTopicAnalytics(1n, 10n)).resolves.toBe(false);
  });

  it('promotes an existing-history eligible member on demand', async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseUser),
        update: jest.fn().mockResolvedValue({}),
      },
      vote: { count: jest.fn().mockResolvedValue(10) },
    };
    const policy = new PolicyService(prisma as never);
    await expect(policy.assertSeniorMember(BigInt(1))).resolves.toBeUndefined();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: BigInt(1) }, data: { membershipTier: 'SENIOR' } });
  });

  it('rejects an ineligible member', async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseUser, createdAt: new Date() }) },
      vote: { count: jest.fn().mockResolvedValue(10) },
    };
    const policy = new PolicyService(prisma as never);
    await expect(policy.assertSeniorMember(BigInt(1))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['new member', baseUser, 'MEMBER', true, false, false, false],
    ['senior member', { ...baseUser, membershipTier: 'SENIOR' }, 'MEMBER', true, true, true, true],
    ['partner', {
      ...baseUser,
      membershipTier: 'SENIOR',
      organizationMemberships: [{ role: 'MEMBER', organization: { id: BigInt(7), name: 'Partner', isPartner: true } }],
    }, 'PARTNER', false, false, true, false],
    ['topic team', {
      ...baseUser,
      membershipTier: 'SENIOR',
      roleAssignments: [{ role: 'TOPIC_TEAM', scope: 'GLOBAL', organizationId: null, topicId: null, expiresAt: null }],
    }, 'STAFF', false, false, false, false],
    ['admin', { ...baseUser, role: 'ADMIN' }, 'ADMIN', true, true, true, true],
  ])('returns the participation matrix for %s', async (
    _label,
    user,
    mode,
    canParticipate,
    canReport,
    canSubmitTopicApplication,
    canSubmitStanceApplication,
  ) => {
    const policy = createPolicy(user as typeof baseUser & Record<string, unknown>);

    await expect(policy.capabilities(BigInt(1))).resolves.toMatchObject({
      participation: {
        mode,
        canVote: canParticipate,
        canSignal: canParticipate,
        canDiscuss: canParticipate,
        canReport,
        canSubmitTopicApplication,
        canSubmitStanceApplication,
      },
    });
  });

  it('allows a new member to participate but not report', async () => {
    const policy = createPolicy(baseUser);
    await expect(policy.assertPublicAction(BigInt(1), 'VOTE')).resolves.toBeUndefined();
    await expect(policy.assertPublicAction(BigInt(1), 'REPORT')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a senior member to report and submit stance applications', async () => {
    const policy = createPolicy({ ...baseUser, membershipTier: 'SENIOR' });
    await expect(policy.assertPublicAction(BigInt(1), 'REPORT')).resolves.toBeUndefined();
    await expect(policy.assertCanSubmitStanceApplication(BigInt(1))).resolves.toBeUndefined();
  });

  it.each([
    ['partner', {
      ...baseUser,
      organizationMemberships: [{ role: 'MEMBER', organization: { id: BigInt(7), name: 'Partner', isPartner: true } }],
    }],
    ['topic team', {
      ...baseUser,
      roleAssignments: [{ role: 'TOPIC_TEAM', scope: 'GLOBAL', organizationId: null, topicId: null, expiresAt: null }],
    }],
  ])('blocks public interaction and stance applications for %s', async (_label, user) => {
    const policy = createPolicy(user as typeof baseUser & Record<string, unknown>);
    await expect(policy.assertPublicAction(BigInt(1), 'DISCUSS')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(policy.assertCanSubmitStanceApplication(BigInt(1))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps the real admin exception for public actions', async () => {
    const policy = createPolicy({ ...baseUser, role: 'ADMIN' });
    await expect(policy.assertPublicAction(BigInt(1), 'REPORT')).resolves.toBeUndefined();
    await expect(policy.assertCanSubmitStanceApplication(BigInt(1))).resolves.toBeUndefined();
  });

  it('does not leak the underlying admin privileges into a new-member assumption', async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseUser, role: 'ADMIN' }) },
    };
    const request = { user: { assumptionProfile: 'new-member' } };
    const policy = new PolicyService(prisma as never, request as never);

    await expect(policy.can(1n, Capability.ADMIN)).resolves.toBe(false);
    await expect(policy.canViewAnalytics(1n)).resolves.toBe(false);
    await expect(policy.assertPublicAction(1n, 'VOTE')).resolves.toBeUndefined();
    await expect(policy.assertPublicAction(1n, 'REPORT')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies topic-team restrictions to an assumed admin account', async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseUser, role: 'ADMIN' }) },
    };
    const request = { user: { assumptionProfile: 'topic-team' } };
    const policy = new PolicyService(prisma as never, request as never);

    await expect(policy.can(1n, Capability.TOPIC_PUBLISH)).resolves.toBe(true);
    await expect(policy.canViewAnalytics(1n)).resolves.toBe(true);
    await expect(policy.assertPublicAction(1n, 'DISCUSS')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
