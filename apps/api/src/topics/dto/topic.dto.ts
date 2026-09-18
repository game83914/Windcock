import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { TopicAudience, TopicContentBlockType, TopicModerationStatus, TopicType, TopicVisibility } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export enum ScratchRevealMode {
  SHARED = 'SHARED',
  PER_RESULT = 'PER_RESULT',
}

export class ScratchResultDto {
  @ApiProperty({ example: '恭喜中獎' })
  @Transform(({ obj, key }) => obj[key], { toClassOnly: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @ApiPropertyOptional({ description: '此結果的揭曉圖片，可使用上傳圖片相對路徑或 HTTP(S) URL' })
  @IsOptional()
  @Transform(({ obj, key }) => obj[key], { toClassOnly: true })
  @IsString()
  @MaxLength(2048)
  revealImageUrl?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ obj, key }) => obj[key], { toClassOnly: true })
  @IsInt()
  @Min(1)
  weight?: number;
}

export class ScratchCardDto {
  @ApiPropertyOptional({ description: '刮開前的覆蓋圖片，可使用上傳圖片相對路徑或 HTTP(S) URL' })
  @IsOptional()
  @Transform(({ obj, key }) => obj[key], { toClassOnly: true })
  @IsString()
  @MaxLength(2048)
  coverImageUrl?: string;

  @ApiPropertyOptional({ enum: ScratchRevealMode, default: ScratchRevealMode.SHARED })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ScratchRevealMode)
  revealMode: ScratchRevealMode = ScratchRevealMode.SHARED;

  @ApiPropertyOptional({ description: 'SHARED 模式共用的揭曉圖片，可使用上傳圖片相對路徑或 HTTP(S) URL' })
  @IsOptional()
  @Transform(({ obj, key }) => obj[key], { toClassOnly: true })
  @IsString()
  @MaxLength(2048)
  sharedRevealImageUrl?: string;

  @ApiPropertyOptional({ default: true, description: '揭曉時是否顯示結果文字' })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ obj, key }) => obj[key], { toClassOnly: true })
  @IsBoolean()
  showText: boolean = true;

  @ApiProperty({ type: [ScratchResultDto], minItems: 2, maxItems: 9 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => ScratchResultDto)
  results: ScratchResultDto[];
}

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
  @ApiPropertyOptional({ enum: TopicAudience, default: TopicAudience.MEMBER_ONLY })
  @IsOptional()
  @IsEnum(TopicAudience)
  audience?: TopicAudience;

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
  @MaxLength(50, { each: true })
  options?: string[];

  @ApiPropertyOptional({ description: '與 options 對齊的選項圖片相對路徑（如 /api/v1/option-images/xxxx），無圖片的選項請填 null' })
  @IsOptional()
  @IsArray()
  optionImages?: (string | null)[];

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
  @ApiPropertyOptional({ enum: TopicVisibility, default: TopicVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(TopicVisibility)
  visibility?: TopicVisibility;

  @ApiPropertyOptional({ enum: TopicAudience, default: TopicAudience.MEMBER_ONLY })
  @IsOptional()
  @IsEnum(TopicAudience)
  audience?: TopicAudience;

  @ApiProperty({ example: '你今天中午想吃什麼？' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 100)
  title: string;

  @ApiPropertyOptional({ example: 'life', description: '已停用：快問不再設定生活分類，固定視為「快問」分類' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ enum: [TopicType.BINARY, TopicType.MULTIPLE, TopicType.STAR_RATING, TopicType.LIKERT, TopicType.MULTI_SELECT, TopicType.IMAGE_MULTIPLE, TopicType.IMAGE_RANK, TopicType.SPECTRUM, TopicType.SHORT_ANSWER, TopicType.MATCHING, TopicType.PUZZLE, TopicType.SCRATCH, TopicType.SPIN_WHEEL, TopicType.LOTTERY], description: '快問題型' })
  @IsEnum([TopicType.BINARY, TopicType.MULTIPLE, TopicType.STAR_RATING, TopicType.LIKERT, TopicType.MULTI_SELECT, TopicType.IMAGE_MULTIPLE, TopicType.IMAGE_RANK, TopicType.SPECTRUM, TopicType.SHORT_ANSWER, TopicType.MATCHING, TopicType.PUZZLE, TopicType.SCRATCH, TopicType.SPIN_WHEEL, TopicType.LOTTERY])
  topicType: Exclude<TopicType, 'SURVEY'>;

  @ApiPropertyOptional({ description: '選項題（2~10）、連連看（2~6）、拼圖題（2~4）、刮刮樂（2~9）、轉盤抽獎（2~8）、日式搖獎（2~10）、二選一排名賽（4~50）；光譜題與簡答題不需選項' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  options?: string[];

  @ApiPropertyOptional({ type: ScratchCardDto, description: '刮刮樂卡片與隨機結果設定；SCRATCH 題型必填' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScratchCardDto)
  scratchCard?: ScratchCardDto;

  @ApiPropertyOptional({ description: '圖片選項題（IMAGE_MULTIPLE）與二選一排名賽（IMAGE_RANK）必填：與 options 對齊的選項圖片相對路徑（如 /api/v1/option-images/xxxx），每個選項都必須有圖；其他題型請勿提供' })
  @IsOptional()
  @IsArray()
  optionImages?: (string | null)[];

  @ApiPropertyOptional({ description: '連連看的右側配對文字，需與 options 同長度、一一對應' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  matches?: string[];

  @ApiPropertyOptional({ description: '轉盤抽獎各選項權重（正整數），需與 options 同長度' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(1, { each: true })
  weights?: number[];

  @ApiPropertyOptional({ description: '簡答題的作答提示' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  prompt?: string;

  @ApiPropertyOptional({ description: '量表最小值標籤（量表題必填）', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  scaleMinLabel?: string;

  @ApiPropertyOptional({ description: '量表最大值標籤（量表題必填）', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  scaleMaxLabel?: string;

  @ApiPropertyOptional({ description: '量表點數（LIKERT 必填，3~10）', minimum: 3, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  scalePoints?: number;

  @ApiPropertyOptional({ description: '複選題最多可選數量' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxSelections?: number;

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

export class CreateSurveyQuestionDto {
  @ApiProperty({ example: '你今天中午想吃什麼？' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  title: string;

  @ApiProperty({ enum: [TopicType.BINARY, TopicType.MULTIPLE, TopicType.STAR_RATING, TopicType.LIKERT, TopicType.MULTI_SELECT, TopicType.IMAGE_MULTIPLE, TopicType.IMAGE_RANK, TopicType.SPECTRUM, TopicType.SHORT_ANSWER, TopicType.MATCHING, TopicType.PUZZLE, TopicType.SCRATCH, TopicType.SPIN_WHEEL, TopicType.LOTTERY], description: '問卷題目可組合快問支援的各種題型' })
  @IsEnum([TopicType.BINARY, TopicType.MULTIPLE, TopicType.STAR_RATING, TopicType.LIKERT, TopicType.MULTI_SELECT, TopicType.IMAGE_MULTIPLE, TopicType.IMAGE_RANK, TopicType.SPECTRUM, TopicType.SHORT_ANSWER, TopicType.MATCHING, TopicType.PUZZLE, TopicType.SCRATCH, TopicType.SPIN_WHEEL, TopicType.LOTTERY])
  topicType: Exclude<TopicType, 'SURVEY'>;

  @ApiPropertyOptional({ description: '選項題（2~10）、連連看（2~6）、拼圖題（2~4）、刮刮樂（2~9）、轉盤抽獎（2~8）、日式搖獎（2~10）、二選一排名賽（4~50）；光譜題與簡答題不需選項' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  options?: string[];

  @ApiPropertyOptional({ type: ScratchCardDto, description: '刮刮樂卡片與隨機結果設定；SCRATCH 題型必填' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScratchCardDto)
  scratchCard?: ScratchCardDto;

  @ApiPropertyOptional({ description: '圖片選項題（IMAGE_MULTIPLE）與二選一排名賽（IMAGE_RANK）必填：與 options 對齊的選項圖片相對路徑，每個選項都必須有圖；其他題型請勿提供' })
  @IsOptional()
  @IsArray()
  optionImages?: (string | null)[];

  @ApiPropertyOptional({ description: '連連看的右側配對文字，需與 options 同長度、一一對應' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  matches?: string[];

  @ApiPropertyOptional({ description: '轉盤抽獎各選項權重（正整數），需與 options 同長度' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(1, { each: true })
  weights?: number[];

  @ApiPropertyOptional({ description: '簡答題的作答提示' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  prompt?: string;

  @ApiPropertyOptional({ description: '量表最小值標籤（量表題必填）', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  scaleMinLabel?: string;

  @ApiPropertyOptional({ description: '量表最大值標籤（量表題必填）', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  scaleMaxLabel?: string;

  @ApiPropertyOptional({ description: '量表點數（LIKERT 必填，3~10）', minimum: 3, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  scalePoints?: number;

  @ApiPropertyOptional({ description: '複選題最多可選數量' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxSelections?: number;
}

export class CreateSurveyDto {
  @ApiPropertyOptional({ enum: TopicVisibility, default: TopicVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(TopicVisibility)
  visibility?: TopicVisibility;

  @ApiPropertyOptional({ enum: TopicAudience, default: TopicAudience.MEMBER_ONLY })
  @IsOptional()
  @IsEnum(TopicAudience)
  audience?: TopicAudience;

  @ApiProperty({ example: '週末出遊偏好大調查' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 100)
  title: string;

  @ApiProperty({ type: [CreateSurveyQuestionDto], description: '問卷題目，至少 2 題、最多 20 題' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyQuestionDto)
  questions: CreateSurveyQuestionDto[];

  @ApiProperty({ enum: QUICK_VOTE_DURATION_HOURS, default: 24, description: '問卷以小時計' })
  @IsInt()
  @IsIn(QUICK_VOTE_DURATION_HOURS)
  voteDurationHours: number;

  @ApiPropertyOptional({ example: 20, description: '達到此票數即視為有效問卷' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minVotes?: number;
}

export class CreateStagedTopicDto {
  @ApiPropertyOptional({ enum: TopicVisibility, default: TopicVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(TopicVisibility)
  visibility?: TopicVisibility;

  @ApiPropertyOptional({ enum: TopicAudience, default: TopicAudience.MEMBER_ONLY })
  @IsOptional()
  @IsEnum(TopicAudience)
  audience?: TopicAudience;

  @ApiProperty({ example: '連續三天的晚餐抉擇挑戰' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 100)
  title: string;

  @ApiProperty({ example: 3, description: '總回合數，2 到 10 回合' })
  @IsInt()
  @Min(2)
  @Max(10)
  totalRounds: number;

  @ApiProperty({ type: CreateSurveyQuestionDto, description: '第 1 回合題目' })
  @ValidateNested()
  @Type(() => CreateSurveyQuestionDto)
  question: CreateSurveyQuestionDto;

  @ApiProperty({ enum: QUICK_VOTE_DURATION_HOURS, default: 24, description: '每回合投票時長（小時）' })
  @IsInt()
  @IsIn(QUICK_VOTE_DURATION_HOURS)
  voteDurationHours: number;

  @ApiPropertyOptional({ example: 20, description: '達到此票數即視為有效快問' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minVotes?: number;
}

export class PublishRoundDto {
  @ApiProperty({ example: '上一回合大家偏好火鍋，今晚換個口味吧！', description: '上一回合回饋，1 到 2000 字' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  feedback: string;

  @ApiProperty({ type: CreateSurveyQuestionDto, description: '下一回合題目' })
  @ValidateNested()
  @Type(() => CreateSurveyQuestionDto)
  question: CreateSurveyQuestionDto;
}

export class FinishStagedDto {
  @ApiProperty({ example: '三回合挑戰結束，感謝大家參與！', description: '最終回饋，1 到 2000 字' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  feedback: string;
}

export class ListTopicsQuery {
  @ApiPropertyOptional({ description: '僅列出指定會員建立的議題' })
  @IsOptional()
  @Matches(/^\d+$/)
  creatorId?: string;

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

  @ApiPropertyOptional({ enum: ['FORMAL', 'QUICK', 'SURVEY', 'STAGED', 'ALL'], description: '議題類型，預設僅正式議題' })
  @IsOptional()
  @IsIn(['FORMAL', 'QUICK', 'SURVEY', 'STAGED', 'ALL'])
  kind?: 'FORMAL' | 'QUICK' | 'SURVEY' | 'STAGED' | 'ALL';

  @ApiPropertyOptional({ enum: ['ALL', 'VOTED', 'UNVOTED', 'FOLLOWING'] })
  @IsOptional()
  @IsIn(['ALL', 'VOTED', 'UNVOTED', 'FOLLOWING'])
  participation?: 'ALL' | 'VOTED' | 'UNVOTED' | 'FOLLOWING';

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ENDED', 'ALL'], description: '議題狀態，預設 ACTIVE（進行中）' })
  @IsOptional()
  @IsIn(['ACTIVE', 'ENDED', 'ALL'])
  status?: 'ACTIVE' | 'ENDED' | 'ALL';

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
