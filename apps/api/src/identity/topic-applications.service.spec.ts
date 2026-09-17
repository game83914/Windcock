import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TopicApplicationsService } from './topic-applications.service';

const dto = {
  applicantType: 'MEMBER',
  title: '這是一個符合最小長度的新議題嗎？',
  description: '這是一段符合最小長度要求的議題背景說明文字。',
  category: '社會',
  topicType: 'BINARY',
  options: ['支持', '反對'],
  voteDurationDays: 7,
};

describe('TopicApplicationsService authorization', () => {
  it('requires senior eligibility for member applications', async () => {
    const policy = { assertSeniorMember: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const service = new TopicApplicationsService({} as never, policy as never);
    await expect(service.submit(BigInt(1), dto as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires active partner membership for organization applications', async () => {
    const policy = { assertPartnerMember: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const service = new TopicApplicationsService({} as never, policy as never);
    await expect(service.submit(BigInt(1), {
      ...dto,
      applicantType: 'ORGANIZATION',
      organizationId: '9',
    } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(policy.assertPartnerMember).toHaveBeenCalledWith(BigInt(1), BigInt(9));
  });

  it('creates an organization-scoped application after authorization', async () => {
    const prisma = {
      topicApplication: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
        id: BigInt(3), ...data, status: 'PENDING', results: [], createdAt: new Date(), updatedAt: new Date(), organization: { id: BigInt(9), name: 'Partner' },
      })) },
    };
    const policy = { assertPartnerMember: jest.fn().mockResolvedValue(undefined) };
    const service = new TopicApplicationsService(prisma as never, policy as never);
    const result = await service.submit(BigInt(1), { ...dto, applicantType: 'ORGANIZATION', organizationId: '9' } as never);
    expect(result.organizationId).toBe('9');
    expect(prisma.topicApplication.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ submitterId: BigInt(1), organizationId: BigInt(9) }),
    }));
  });

  it('does not allow an organization application to switch to follower-only', async () => {
    const updatedAt = new Date('2026-09-16T00:00:00Z');
    const tx = {
      $queryRaw: jest.fn(),
      topicApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 3n,
          submitterId: 1n,
          applicantType: 'ORGANIZATION',
          status: 'PENDING',
          audience: 'MEMBER_ONLY',
          updatedAt,
        }),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new TopicApplicationsService(prisma as never, {} as never);

    await expect(service.updateMine(1n, 3n, {
      ...dto,
      audience: 'FOLLOWERS_ONLY',
      expectedUpdatedAt: updatedAt.toISOString(),
    } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});
