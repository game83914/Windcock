import { StancesService } from './stances.service';

describe('StancesService signals', () => {
  it('does not let the proposer delete an editorially published stance', async () => {
    const prisma = { topicStance: { findFirst: jest.fn().mockResolvedValue({ creatorId: 2n, applicationResults: [{ applicationId: 3n }], _count: { children: 0, posts: 0, signals: 0, pendingApplications: 0 } }), delete: jest.fn() } };
    const service = new StancesService(prisma as never, { assertPublicAction: jest.fn() } as never);

    await expect(service.remove(1n, 2n, 2n)).rejects.toThrow('只能透過內容管理流程處理');
    expect(prisma.topicStance.delete).not.toHaveBeenCalled();
  });

  it('switches AGREE to DISAGREE and reconciles counters', async () => {
    const signals = [
      { id: BigInt(1), stanceId: BigInt(10), userId: BigInt(20), signal: 'AGREE' },
    ];
    let counters: Record<string, number> = {};
    const signalStore = {
      findUnique: jest.fn(({ where }) => Promise.resolve(signals.find((item) => item.stanceId === where.stanceId_userId_signal.stanceId && item.userId === where.stanceId_userId_signal.userId && item.signal === where.stanceId_userId_signal.signal) ?? null)),
      delete: jest.fn(({ where }) => {
        const index = signals.findIndex((item) => item.id === where.id);
        return Promise.resolve(signals.splice(index, 1)[0]);
      }),
      deleteMany: jest.fn(({ where }) => {
        const before = signals.length;
        for (let index = signals.length - 1; index >= 0; index -= 1) {
          const item = signals[index];
          if (item.stanceId === where.stanceId && item.userId === where.userId && item.signal === where.signal) signals.splice(index, 1);
        }
        return Promise.resolve({ count: before - signals.length });
      }),
      create: jest.fn(({ data }) => {
        const item = { id: BigInt(signals.length + 10), ...data };
        signals.push(item);
        return Promise.resolve(item);
      }),
      count: jest.fn(({ where }) => Promise.resolve(signals.filter((item) => item.stanceId === where.stanceId && item.signal === where.signal).length)),
    };
    const updateStance = jest.fn(({ data }) => { counters = data; return Promise.resolve({}); });
    const prisma = {
      topicStance: {
        findFirst: jest.fn(() => Promise.resolve({ id: BigInt(10), topic: { status: 'OPEN', moderationStatus: 'APPROVED' } })),
        update: updateStance,
      },
      topicStanceSignal: signalStore,
      $transaction: jest.fn((callback) => callback({ topicStanceSignal: signalStore, topicStance: { update: updateStance } })),
    };
    const service = new StancesService(prisma as never, { assertPublicAction: jest.fn() } as never);

    await expect(service.toggleSignal(BigInt(1), BigInt(10), BigInt(20), 'DISAGREE')).resolves.toEqual({ active: true, signal: 'DISAGREE' });
    expect(signals.map((item) => item.signal)).toEqual(['DISAGREE']);
    expect(counters).toEqual({ agreementCount: 0, disagreementCount: 1 });
  });
});
