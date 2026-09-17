import { ConflictException, ForbiddenException } from '@nestjs/common';
import { StanceApplicationsService } from './stance-applications.service';

describe('StanceApplicationsService', () => {
  it('rejects a new member before creating an application', async () => {
    const prisma = { stanceApplication: { create: jest.fn() } };
    const policy = { assertCanSubmitStanceApplication: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const service = new StanceApplicationsService(prisma as never, policy as never, { assertCanInteract: jest.fn() } as never);

    await expect(service.submit(1n, { topicId: '2', title: '新的立場' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.stanceApplication.create).not.toHaveBeenCalled();
  });

  it('requires an editorial scope when listing applications', async () => {
    const policy = { editorialScopes: jest.fn().mockResolvedValue({ organizationIds: [], topicIds: [] }) };
    const service = new StanceApplicationsService({} as never, policy as never, { assertCanInteract: jest.fn() } as never);

    await expect(service.list(1n, { page: 1, limit: 20 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a title that is empty after trimming', async () => {
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN', moderationStatus: 'APPROVED', voteEndAt: new Date(Date.now() + 60_000), creatorId: 4n, audienceOwnerId: 4n, visibility: 'PUBLIC', audience: 'MEMBER_ONLY' }) },
      stanceApplication: { create: jest.fn() },
    };
    const policy = { assertCanSubmitStanceApplication: jest.fn().mockResolvedValue(undefined) };
    const service = new StanceApplicationsService(prisma as never, policy as never, { assertCanInteract: jest.fn() } as never);

    await expect(service.submit(1n, { topicId: '2', title: '  ' })).rejects.toThrow('立場名稱至少 2 個字');
    expect(prisma.stanceApplication.create).not.toHaveBeenCalled();
  });

  it('publishes an application as a stance attributed to the topic team', async () => {
    const application = { id: 8n, topicId: 2n, parentStanceId: 3n, submitterId: 4n, organizationId: null, title: '衍生立場', rationale: '理由', status: 'IN_REVIEW', revisionNumber: 1, _count: { results: 0 } };
    const update = jest.fn().mockResolvedValue({ ...application, status: 'APPROVED', results: [{ stanceId: 9n, createdAt: new Date(), stance: { id: 9n, title: '衍生立場' } }] });
    const create = jest.fn().mockResolvedValue({ id: 9n });
    const updateRevision = jest.fn().mockResolvedValue({});
    const prisma = {
      stanceApplication: { findUnique: jest.fn().mockResolvedValue(application) },
      topic: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN', moderationStatus: 'APPROVED', voteEndAt: new Date(Date.now() + 60_000), creatorId: 4n, audienceOwnerId: 4n, visibility: 'PUBLIC', audience: 'MEMBER_ONLY' }) },
      topicStance: { findFirst: jest.fn().mockResolvedValue({ depth: 1 }) },
      $transaction: jest.fn((callback) => callback({
        $queryRaw: jest.fn(),
        topic: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN', moderationStatus: 'APPROVED', voteEndAt: new Date(Date.now() + 60_000) }) },
        topicStance: { findFirst: jest.fn().mockResolvedValue({ depth: 1 }), create },
        stanceApplication: { findUnique: jest.fn().mockResolvedValue(application), update },
        stanceApplicationRevision: { update: updateRevision },
      })),
    };
    const policy = { assert: jest.fn().mockResolvedValue(undefined) };
    const service = new StanceApplicationsService(prisma as never, policy as never, { assertCanInteract: jest.fn() } as never);

    await service.publish(7n, 8n);
    expect(create).toHaveBeenCalledWith({ data: { topicId: 2n, parentId: 3n, creatorId: 7n, title: '衍生立場', rationale: '理由', depth: 2, applicationResults: { create: { applicationId: 8n } } } });
    expect(updateRevision).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED', reviewedById: 7n }) }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED', reviewedById: 7n }) }));
  });

  it('creates a new revision and resubmits a rejected application', async () => {
    const updatedAt = new Date('2026-09-09T10:00:00.000Z');
    const application = { id: 8n, submitterId: 4n, topicId: 2n, parentStanceId: null, status: 'REJECTED', revisionNumber: 2, updatedAt };
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...application, ...data, results: [] }));
    const tx = {
      $queryRaw: jest.fn(),
      stanceApplication: { findUnique: jest.fn().mockResolvedValue(application), update },
      topic: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN', moderationStatus: 'APPROVED', voteEndAt: new Date(Date.now() + 60_000), creatorId: 4n, audienceOwnerId: 4n, visibility: 'PUBLIC', audience: 'MEMBER_ONLY' }) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new StanceApplicationsService(prisma as never, {} as never, { assertCanInteract: jest.fn() } as never);

    await service.updateMine(4n, 8n, { title: '修改後立場', rationale: '', note: '', expectedUpdatedAt: updatedAt.toISOString() });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDING', revisionNumber: 3, reviewNote: null, revisions: { create: expect.objectContaining({ revisionNumber: 3, title: '修改後立場' }) } }),
    }));
  });

  it('supports merging sources and splitting them into multiple formal stances', async () => {
    const applications = [
      { id: 8n, topicId: 2n, status: 'PENDING', revisionNumber: 1, _count: { results: 0 } },
      { id: 9n, topicId: 2n, status: 'IN_REVIEW', revisionNumber: 1, _count: { results: 0 } },
    ];
    const create = jest.fn()
      .mockResolvedValueOnce({ id: 20n, title: '整併立場', parentId: null })
      .mockResolvedValueOnce({ id: 21n, title: '拆分立場', parentId: null });
    const tx = {
      $queryRaw: jest.fn(),
      stanceApplication: { findMany: jest.fn().mockResolvedValue(applications), update: jest.fn() },
      stanceApplicationRevision: { update: jest.fn() },
      topic: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN', moderationStatus: 'APPROVED', voteEndAt: new Date(Date.now() + 60_000) }) },
      topicStance: { create },
    };
    const prisma = {
      stanceApplication: { findMany: jest.fn().mockResolvedValue(applications) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const policy = { assert: jest.fn() };
    const service = new StanceApplicationsService(prisma as never, policy as never, { assertCanInteract: jest.fn() } as never);

    await service.resolve(7n, { outputs: [
      { applicationIds: ['8', '9'], title: '整併立場' },
      { applicationIds: ['8'], title: '拆分立場' },
    ] });
    expect(create).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ creatorId: 7n, applicationResults: { create: [{ applicationId: 8n }, { applicationId: 9n }] } }) }));
    expect(create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ applicationResults: { create: [{ applicationId: 8n }] } }) }));
    expect(tx.stanceApplication.update).toHaveBeenCalledTimes(2);
  });

  it('returns an explicit topic and full stance path for member context', async () => {
    const application = {
      id: 8n,
      submitterId: 4n,
      topicId: 2n,
      parentStanceId: 12n,
      status: 'REJECTED',
      reviewedById: 7n,
      topic: { id: 2n, title: '公共議題', status: 'OPEN', moderationStatus: 'APPROVED', voteEndAt: new Date(Date.now() + 60_000) },
      parentStance: { id: 12n, title: '第三層', status: 'ACTIVE', depth: 2, parent: { id: 11n, title: '第二層', parent: { id: 10n, title: '第一層', parent: null } } },
      submitter: { id: 4n, nickname: '會員' },
      results: [],
    };
    const prisma = {
      stanceApplication: {
        findMany: jest.fn().mockResolvedValue([application]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new StanceApplicationsService(prisma as never, {} as never, { assertCanInteract: jest.fn() } as never);

    const result = await service.listMine(4n, 1, 20);
    expect(result.items[0].target).toEqual(expect.objectContaining({
      kind: 'STANCE',
      canResubmit: true,
      path: [
        { id: '10', title: '第一層' },
        { id: '11', title: '第二層' },
        { id: '12', title: '第三層' },
      ],
    }));
  });

  it('rejects an editorial update when the member changed the proposal', async () => {
    const oldUpdatedAt = new Date('2026-09-09T10:00:00.000Z');
    const current = { id: 8n, topicId: 2n, status: 'PENDING', revisionNumber: 1, updatedAt: new Date('2026-09-09T10:01:00.000Z') };
    const tx = {
      $queryRaw: jest.fn(),
      stanceApplication: { findUnique: jest.fn().mockResolvedValue(current), update: jest.fn() },
      stanceApplicationRevision: { update: jest.fn() },
    };
    const prisma = {
      stanceApplication: { findUnique: jest.fn().mockResolvedValue({ ...current, _count: { results: 0 } }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const policy = { assert: jest.fn() };
    const service = new StanceApplicationsService(prisma as never, policy as never, { assertCanInteract: jest.fn() } as never);

    await expect(service.review(7n, 8n, { status: 'IN_REVIEW', expectedUpdatedAt: oldUpdatedAt.toISOString() })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.stanceApplicationRevision.update).not.toHaveBeenCalled();
  });

  it('withdraws an unpublished application and its current revision', async () => {
    const updateApplication = jest.fn();
    const updateRevision = jest.fn();
    const tx = {
      $queryRaw: jest.fn(),
      stanceApplication: {
        findUnique: jest.fn().mockResolvedValue({ id: 8n, submitterId: 4n, status: 'IN_REVIEW', revisionNumber: 2, _count: { results: 0 } }),
        update: updateApplication,
      },
      stanceApplicationRevision: { update: updateRevision },
    };
    const service = new StanceApplicationsService({ $transaction: jest.fn((callback) => callback(tx)) } as never, {} as never, { assertCanInteract: jest.fn() } as never);

    await expect(service.withdrawMine(4n, 8n)).resolves.toEqual({ withdrawn: true });
    expect(updateRevision).toHaveBeenCalledWith({ where: { applicationId_revisionNumber: { applicationId: 8n, revisionNumber: 2 } }, data: { status: 'WITHDRAWN' } });
    expect(updateApplication).toHaveBeenCalledWith({ where: { id: 8n }, data: { status: 'WITHDRAWN' } });
  });
});
