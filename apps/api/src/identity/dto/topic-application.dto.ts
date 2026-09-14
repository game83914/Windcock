import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TopicApplicationApplicantType, TopicApplicationStatus } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { CreateTopicDto } from '../../topics/dto/topic.dto';

export class SubmitTopicApplicationDto extends CreateTopicDto {
  @ApiProperty({ enum: TopicApplicationApplicantType })
  @IsEnum(TopicApplicationApplicantType)
  applicantType: TopicApplicationApplicantType;

  @ApiPropertyOptional({ description: 'Required for ORGANIZATION applications' })
  @ValidateIf((dto: SubmitTopicApplicationDto) => dto.applicantType === TopicApplicationApplicantType.ORGANIZATION)
  @IsString()
  @Matches(/^\d+$/)
  organizationId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class TopicApplicationsQuery {
  @ApiPropertyOptional({ enum: TopicApplicationStatus })
  @IsOptional()
  @IsEnum(TopicApplicationStatus)
  status?: TopicApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  organizationId?: string;

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

export class ReviewTopicApplicationDto {
  @ApiProperty({ enum: ['IN_REVIEW', 'REJECTED'] })
  @IsIn(['IN_REVIEW', 'REJECTED'])
  status: 'IN_REVIEW' | 'REJECTED';

  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf((dto: ReviewTopicApplicationDto) => dto.status === 'REJECTED')
  @IsString()
  @Length(5, 500)
  note?: string;
}

export class UpdateTopicApplicationDto extends CreateTopicDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ description: 'updatedAt returned by the last read' })
  @IsISO8601()
  expectedUpdatedAt: string;
}
