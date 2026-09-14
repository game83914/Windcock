import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TopicStanceReportReason, TopicStanceSignalType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class SignalStanceDto {
  @ApiProperty({ enum: TopicStanceSignalType, description: 'AGREE = 我認同；DISAGREE = 我不認同。兩者互斥。' })
  @IsEnum(TopicStanceSignalType)
  signal: TopicStanceSignalType;
}

export class ReportStanceDto {
  @ApiProperty({ enum: TopicStanceReportReason })
  @IsEnum(TopicStanceReportReason)
  reason: TopicStanceReportReason;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;
}

export class TakedownStanceDto {
  @ApiProperty({ example: '內容涉及未經證實的指控' })
  @IsString()
  @Length(5, 500)
  reason: string;
}
