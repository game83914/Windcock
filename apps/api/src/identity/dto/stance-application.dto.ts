import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TopicApplicationStatus } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';

export class SubmitStanceApplicationDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  topicId: string;

  @ApiPropertyOptional({ description: 'The stance being extended; omit when responding directly to the topic' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  parentStanceId?: string;

  @ApiProperty({ minLength: 2, maxLength: 80 })
  @IsString()
  @Length(2, 80)
  title: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  rationale?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class StanceApplicationsQuery {
  @ApiPropertyOptional({ enum: TopicApplicationStatus })
  @IsOptional()
  @IsEnum(TopicApplicationStatus)
  status?: TopicApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  topicId?: string;

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

export class ReviewStanceApplicationDto {
  @ApiPropertyOptional({ enum: ['IN_REVIEW', 'REJECTED'] })
  @IsOptional()
  @IsIn(['IN_REVIEW', 'REJECTED'])
  status?: 'IN_REVIEW' | 'REJECTED';

  @ApiPropertyOptional({ minLength: 2, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  title?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  rationale?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf((dto: ReviewStanceApplicationDto) => dto.status === 'REJECTED')
  @IsString()
  @Length(5, 500)
  reviewNote?: string;

  @ApiPropertyOptional({ description: 'updatedAt returned by the last read' })
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class PublishStanceApplicationDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  title?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  rationale?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reviewNote?: string;

  @ApiPropertyOptional({ description: 'updatedAt returned by the last read' })
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class UpdateStanceApplicationDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @IsString()
  @Length(2, 80)
  title: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rationale?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ description: 'updatedAt returned by the last read' })
  @IsISO8601()
  expectedUpdatedAt: string;
}

export class StanceResolutionOutputDto {
  @ApiProperty({ type: [String], description: 'Source application IDs used by this output' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^\d+$/, { each: true })
  applicationIds: string[];

  @ApiPropertyOptional({ description: 'The stance being extended; omit when responding directly to the topic' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  parentStanceId?: string;

  @ApiProperty({ minLength: 2, maxLength: 80 })
  @IsString()
  @Length(2, 80)
  title: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rationale?: string;
}

export class ResolveStanceApplicationsDto {
  @ApiProperty({ type: [StanceResolutionOutputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StanceResolutionOutputDto)
  outputs: StanceResolutionOutputDto[];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;

  @ApiPropertyOptional({ description: 'Map of application ID to updatedAt returned by the last read' })
  @IsOptional()
  @IsObject()
  expectedUpdatedAt?: Record<string, string>;
}
