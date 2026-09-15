import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TopicContentBlockType, TopicModerationStatus, TopicType } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
  Max,
  Min,
} from 'class-validator';

export const VOTE_DURATIONS = [3, 7, 14, 30] as const;
export const QUICK_VOTE_DURATION_HOURS = [6, 12, 24, 48] as const;
export const MAX_FEATURED_TOPICS = 5;

export class CreateTopicContentBlockDto {
  @ApiProperty({ enum: TopicContentBlockType, example: TopicContentBlockType.CASE })
  @IsEnum(TopicContentBlockType)
  type: TopicContentBlockType;

  @ApiProperty({ example: '某縣市試辦行人優先區' })
  @IsString()
  @Length(3, 120)
  title: string;

  @ApiProperty({ example: '試辦期間重新配置道路空間，並持續觀察事故與通行效率變化。' })
  @IsString()
  @Length(10, 2000)
  content: string;

  @ApiPropertyOptional({ example: '縣市政府公開資料' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceLabel?: string;

  @ApiPropertyOptional({ example: 'https://example.gov.tw/report' })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: '補充內容來源網址格式不正確' })
  sourceUrl?: string;

  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class CreateTopicDto {
  @ApiProperty({ example: '你支持將投票年齡全面降至 18 歲嗎？' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 100)
  title: string;

  @ApiPropertyOptional({ example: '青年公民權是否應與成年年齡同步？' })
  @IsOptional()
  @IsString()
  @Length(20, 2000)
  description?: string;

  @ApiProperty({ example: 'politics', description: '分類 key，可由 GET /categories 取得' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ enum: TopicType, default: TopicType.BINARY })
  @IsEnum(TopicType)
  topicType: TopicType;

  @ApiPropertyOptional({ description: '二元題固定 2 個，多選題 2 到 6 個，光譜題不需要選項' })
  @ValidateIf((dto: CreateTopicDto) => dto.topicType !== TopicType.SPECTRUM)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  options?: string[];

  @ApiPropertyOptional({ type: [CreateTopicContentBlockDto], description: '按需加入的背景、案例、數據、來源或多方觀點，最多 8 筆' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => CreateTopicContentBlockDto)
  blocks?: CreateTopicContentBlockDto[];

  @ApiProperty({ enum: VOTE_DURATIONS, default: 7 })
  @IsInt()
  @IsIn(VOTE_DURATIONS)
  voteDurationDays: number;
}

export class CreateQuickTopicDto {
  @ApiProperty({ example: '你今天中午想吃什麼？' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 100)
  title: string;

  @ApiPropertyOptional({ example: 'life', description: '已停用：快問不再設定生活分類，固定視為「快問」分類' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ enum: [TopicType.BINARY, TopicType.MULTIPLE], default: TopicType.BINARY, description: '快問僅開放二元題與多選題（2 到 4 個選項）' })
  @IsEnum([TopicType.BINARY, TopicType.MULTIPLE])
  topicType: 'BINARY' | 'MULTIPLE';

  @ApiPropertyOptional({ description: '二元題固定 2 個，多選題 2 到 4 個' })
  @ValidateIf((dto: CreateQuickTopicDto) => dto.topicType === TopicType.MULTIPLE)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  options?: string[];

  @ApiProperty({ enum: QUICK_VOTE_DURATION_HOURS, default: 24, description: '快問以小時計，8 小時到 48 小時' })
  @IsInt()
  @IsIn(QUICK_VOTE_DURATION_HOURS)
  voteDurationHours: number;

  @ApiPropertyOptional({ example: 20, description: '達到此票數即視為有效快問，作為日後升級正式議題的門檻' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minVotes?: number;
}

export class ListTopicsQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ['POPULAR', 'NEWEST', 'ENDING_SOON', 'ACTIVITY'] })
  @IsOptional()
  @IsIn(['POPULAR', 'NEWEST', 'ENDING_SOON', 'ACTIVITY'])
  sort?: 'POPULAR' | 'NEWEST' | 'ENDING_SOON' | 'ACTIVITY';

  @ApiPropertyOptional({ enum: ['FORMAL', 'QUICK', 'ALL'], description: '議題類型，預設僅正式議題' })
  @IsOptional()
  @IsIn(['FORMAL', 'QUICK', 'ALL'])
  kind?: 'FORMAL' | 'QUICK' | 'ALL';

  @ApiPropertyOptional({ enum: ['ALL', 'VOTED', 'UNVOTED', 'FOLLOWING'] })
  @IsOptional()
  @IsIn(['ALL', 'VOTED', 'UNVOTED', 'FOLLOWING'])
  participation?: 'ALL' | 'VOTED' | 'UNVOTED' | 'FOLLOWING';

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

export class AdminTopicsQuery extends ListTopicsQuery {
  @ApiPropertyOptional({ enum: TopicModerationStatus })
  @IsOptional()
  @IsEnum(TopicModerationStatus)
  moderationStatus?: TopicModerationStatus;
}

export class RejectTopicDto {
  @ApiProperty({ example: '議題內容涉及未經證實的指控，請補充可靠來源。' })
  @IsString()
  @Length(5, 500)
  note: string;
}

export class FeaturedTopicsDto {
  @ApiProperty({ type: [String], maxItems: MAX_FEATURED_TOPICS, description: '依置頂順序排列的議題 ID，不在清單中的議題自動取消置頂' })
  @IsArray()
  @ArrayMaxSize(MAX_FEATURED_TOPICS, { message: `置頂議題最多 ${MAX_FEATURED_TOPICS} 筆` })
  @IsString({ each: true })
  @Matches(/^\d+$/, { each: true })
  topicIds: string[];
}

export class FeaturedCandidatesQuery {
  @ApiPropertyOptional({ description: '以標題模糊搜尋' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: '每頁數量上限', default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
