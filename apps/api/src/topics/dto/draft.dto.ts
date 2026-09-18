import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DraftKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export const MAX_DRAFTS_PER_USER = 20;
export const MAX_TEMPLATES_PER_USER = 20;
export const MAX_DRAFT_PAYLOAD_BYTES = 100_000;

export class CreateDraftDto {
  @ApiProperty({ enum: DraftKind, description: '草稿種類：快問或問卷' })
  @IsEnum(DraftKind)
  kind: DraftKind;

  @ApiProperty({ example: '午餐吃什麼', maxLength: 50 })
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiProperty({ description: '發起表單狀態（題型、選項、設定等）；完整題型驗證留到正式發佈時' })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ default: false, description: '是否存為可重複套用的範本' })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;
}

export class UpdateDraftDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @ApiPropertyOptional({ description: '發起表單狀態' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '草稿與範本互轉' })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;
}

export class ListDraftsQuery {
  @ApiPropertyOptional({ enum: DraftKind })
  @IsOptional()
  @IsEnum(DraftKind)
  kind?: DraftKind;

  // 注意：query 的 'false' 字串會被隱式轉型誤轉為 true，因此用字串聯合再由 service 轉譯
  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'true 只列範本，false 只列草稿，不帶則全部' })
  @IsOptional()
  @IsIn(['true', 'false'])
  template?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
