import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DraftKind } from '@prisma/client';
import { DraftsService } from './drafts.service';

function setup(prismaOverrides: Record<string, unknown> = {}, senior = true) {
  const prisma = {
    topicDraft: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    ...prismaOverrides,
  };
  const policy = {
    assertSeniorMember: senior
      ? jest.fn().mockResolvedValue(undefined)
      : jest.fn().mockRejectedValue(new ForbiddenException('資深會員限定')),
  };
  const service = new DraftsService(prisma as never, policy as never);
  return { service, topicDraft: prisma.topicDraft as unknown as Record<string, jest.Mock>, policy };
}

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 5n,
    kind: DraftKind.QUICK,
    name: '午餐',
    payload: { title: '吃什麼' },
    isTemplate: false,
    createdAt: new Date('2026-09-24T00:00:00Z'),
    updatedAt: new Date('2026-09-24T00:00:00Z'),
    ...overrides,
  };
}

describe('DraftsService', () => {
  it('creates a draft with trimmed name and default flags', async () => {
    const { service, topicDraft } = setup();
    topicDraft.create.mockResolvedValue(draftRow());

    const result = await service.create(1n, { kind: DraftKind.QUICK, name: '  午餐  ', payload: { title: '吃什麼' } });

    expect(topicDraft.create).toHaveBeenCalledWith({
      data: { userId: 1n, kind: DraftKind.QUICK, name: '午餐', payload: { title: '吃什麼' }, isTemplate: false },
    });
    expect(result).toMatchObject({ id: '5', kind: 'QUICK', name: '午餐', isTemplate: false });
  });

  it('rejects creation over the draft limit', async () => {
    const { service, topicDraft } = setup({ topicDraft: { count: jest.fn().mockResolvedValue(20) } });

    await expect(service.create(1n, { kind: DraftKind.QUICK, name: '滿了', payload: {} })).rejects.toBeInstanceOf(BadRequestException);
    expect(topicDraft.count).toHaveBeenCalledWith({ where: { userId: 1n, isTemplate: false } });
  });

  it('rejects oversized payloads', async () => {
    const { service, topicDraft } = setup();

    await expect(service.create(1n, { kind: DraftKind.QUICK, name: '太大', payload: { blob: 'x'.repeat(100_001) } })).rejects.toBeInstanceOf(BadRequestException);
    expect(topicDraft.create).not.toHaveBeenCalled();
  });

  it('requires senior membership for writes', async () => {
    const { service, topicDraft } = setup({}, false);

    await expect(service.create(1n, { kind: DraftKind.QUICK, name: 'x', payload: {} })).rejects.toBeInstanceOf(ForbiddenException);
    expect(topicDraft.create).not.toHaveBeenCalled();
  });

  it('lists with kind/template filters and string ids', async () => {
    const { service, topicDraft } = setup();
    topicDraft.count.mockResolvedValue(1);
    topicDraft.findMany.mockResolvedValue([draftRow()]);

    const result = await service.list(1n, { kind: DraftKind.QUICK, template: 'false', page: 1, limit: 20 });

    expect(topicDraft.findMany).toHaveBeenCalledWith({
      where: { userId: 1n, kind: DraftKind.QUICK, isTemplate: false },
      orderBy: { updatedAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result).toMatchObject({ total: 1, items: [{ id: '5' }] });
  });

  it('updates only owned drafts and checks template cap on conversion', async () => {
    const { service, topicDraft } = setup();
    topicDraft.findFirst.mockResolvedValue(draftRow());
    topicDraft.update.mockResolvedValue(draftRow({ name: '新名', isTemplate: true }));
    topicDraft.count.mockResolvedValue(20);

    await expect(service.update(1n, 5n, { isTemplate: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(topicDraft.update).not.toHaveBeenCalled();

    topicDraft.count.mockResolvedValue(3);
    const result = await service.update(1n, 5n, { name: '  新名  ', isTemplate: true });
    expect(topicDraft.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { name: '新名', isTemplate: true } });
    expect(result).toMatchObject({ name: '新名', isTemplate: true });
  });

  it('returns 404 for drafts owned by others', async () => {
    const { service, topicDraft } = setup();
    topicDraft.findFirst.mockResolvedValue(null);

    await expect(service.update(1n, 9n, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(1n, 9n)).rejects.toBeInstanceOf(NotFoundException);
    expect(topicDraft.delete).not.toHaveBeenCalled();
  });

  it('removes an owned draft', async () => {
    const { service, topicDraft } = setup();
    topicDraft.findFirst.mockResolvedValue(draftRow());

    await expect(service.remove(1n, 5n)).resolves.toEqual({ success: true });
    expect(topicDraft.delete).toHaveBeenCalledWith({ where: { id: 5n } });
  });
});
