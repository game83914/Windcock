import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DraftKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from '../identity/policy.service';
import {
  CreateDraftDto,
  ListDraftsQuery,
  MAX_DRAFT_PAYLOAD_BYTES,
  MAX_DRAFTS_PER_USER,
  MAX_TEMPLATES_PER_USER,
  UpdateDraftDto,
} from './dto/draft.dto';

type DraftRecord = {
  id: bigint;
  kind: DraftKind;
  name: string;
  payload: Prisma.JsonValue;
  isTemplate: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class DraftsService {
  constructor(private readonly prisma: PrismaService, private readonly policy: PolicyService) {}

  private serialize(draft: DraftRecord) {
    return {
      id: draft.id.toString(),
      kind: draft.kind,
      name: draft.name,
      payload: draft.payload,
      isTemplate: draft.isTemplate,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  private assertPayloadSize(payload: Record<string, unknown>) {
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_DRAFT_PAYLOAD_BYTES) {
      throw new BadRequestException('草稿內容過大，請縮減後再儲存');
    }
  }

  private async assertUnderLimit(userId: bigint, isTemplate: boolean) {
    const count = await this.prisma.topicDraft.count({ where: { userId, isTemplate } });
    const limit = isTemplate ? MAX_TEMPLATES_PER_USER : MAX_DRAFTS_PER_USER;
    if (count >= limit) {
      throw new BadRequestException(isTemplate ? `範本最多只能儲存 ${limit} 份` : `草稿最多只能儲存 ${limit} 份`);
    }
  }

  private async ownedDraft(userId: bigint, draftId: bigint) {
    const draft = await this.prisma.topicDraft.findFirst({ where: { id: draftId, userId } });
    if (!draft) throw new NotFoundException('草稿不存在');
    return draft;
  }

  async list(userId: bigint, query: ListDraftsQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const where: Prisma.TopicDraftWhereInput = { userId };
    if (query.kind) where.kind = query.kind;
    if (query.template !== undefined) where.isTemplate = query.template === 'true';
    const [total, items] = await Promise.all([
      this.prisma.topicDraft.count({ where }),
      this.prisma.topicDraft.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: items.map((item) => this.serialize(item)), total, page, limit };
  }

  async create(userId: bigint, dto: CreateDraftDto) {
    await this.policy.assertSeniorMember(userId);
    this.assertPayloadSize(dto.payload);
    const isTemplate = dto.isTemplate ?? false;
    await this.assertUnderLimit(userId, isTemplate);
    const draft = await this.prisma.topicDraft.create({
      data: { userId, kind: dto.kind, name: dto.name.trim(), payload: dto.payload as Prisma.InputJsonValue, isTemplate },
    });
    return this.serialize(draft);
  }

  async update(userId: bigint, draftId: bigint, dto: UpdateDraftDto) {
    await this.policy.assertSeniorMember(userId);
    const existing = await this.ownedDraft(userId, draftId);
    if (dto.payload !== undefined) this.assertPayloadSize(dto.payload);
    if (dto.isTemplate !== undefined && dto.isTemplate && !existing.isTemplate) {
      await this.assertUnderLimit(userId, true);
    }
    const draft = await this.prisma.topicDraft.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.payload !== undefined ? { payload: dto.payload as Prisma.InputJsonValue } : {}),
        ...(dto.isTemplate !== undefined ? { isTemplate: dto.isTemplate } : {}),
      },
    });
    return this.serialize(draft);
  }

  async remove(userId: bigint, draftId: bigint) {
    await this.policy.assertSeniorMember(userId);
    const existing = await this.ownedDraft(userId, draftId);
    await this.prisma.topicDraft.delete({ where: { id: existing.id } });
    return { success: true };
  }
}
