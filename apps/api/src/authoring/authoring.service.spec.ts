import { BadRequestException } from '@nestjs/common';
import { AuthoringService } from './authoring.service';

describe('AuthoringService stance drafts', () => {
  const drafts = {
    drafts: [
      { label: '精簡版', form: { title: '支持增加公共運輸班次', rationale: '讓通勤選擇更便利。' } },
      { label: '具體版', form: { title: '尖峰時段應增加公共運輸班次', rationale: '改善尖峰時段的候車與壅擠問題。' } },
      { label: '完整版', form: { title: '公共運輸應優先增加尖峰班次', rationale: '先處理需求最集中的時段，提升服務可用性。' } },
    ],
  };

  function setup() {
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue({ title: '是否增加公共運輸？', description: '公共運輸服務討論', status: 'OPEN', moderationStatus: 'APPROVED', options: [{ label: '支持' }, { label: '反對' }] }) },
      topicStance: { findFirst: jest.fn().mockResolvedValue({ title: '應改善通勤體驗', rationale: '目前尖峰時段過於壅擠。' }) },
    };
    const client = { assertAvailable: jest.fn(), complete: jest.fn().mockResolvedValue(drafts) };
    const rateLimit = { consume: jest.fn() };
    const policy = { assertCanSubmitStanceApplication: jest.fn() };
    const service = new AuthoringService(prisma as never, {} as never, client as never, rateLimit as never, policy as never, {} as never, { assertCanInteract: jest.fn() } as never);
    return { service, prisma, client, rateLimit, policy };
  }

  it('organizes the current fields directly and preserves target context', async () => {
    const { service, client, rateLimit, policy } = setup();

    const result = await service.generateStanceDrafts(4n, {
      topicId: '2',
      parentId: '3',
      title: '我支持增加班次',
      rationale: '上班時間等太久',
    }, '127.0.0.1');

    expect(result.drafts).toHaveLength(3);
    expect(policy.assertCanSubmitStanceApplication).toHaveBeenCalledWith(4n);
    expect(rateLimit.consume).toHaveBeenCalledWith(4n, '127.0.0.1');
    const messages = client.complete.mock.calls[0][0];
    expect(JSON.parse(messages[1].content)).toEqual({
      context: {
        topic: { title: '是否增加公共運輸？', description: '公共運輸服務討論', options: ['支持', '反對'] },
        parent: { title: '應改善通勤體驗', rationale: '目前尖峰時段過於壅擠。' },
      },
      currentForm: { title: '我支持增加班次', rationale: '上班時間等太久' },
    });
  });

  it('requires content before calling the AI service', async () => {
    const { service, client, rateLimit } = setup();

    await expect(service.generateStanceDrafts(4n, { topicId: '2', title: ' ' }, '127.0.0.1')).rejects.toBeInstanceOf(BadRequestException);
    expect(client.complete).not.toHaveBeenCalled();
    expect(rateLimit.consume).not.toHaveBeenCalled();
  });
});
