import { ApiProperty } from '@nestjs/swagger';
import { DemographicDimension } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { IsString, Matches } from 'class-validator';

export class TopicDemographicAnalyticsQuery {
  @ApiProperty({ enum: DemographicDimension })
  @IsEnum(DemographicDimension)
  dimension: DemographicDimension;
}

export class CompareTopicAnalyticsQuery extends TopicDemographicAnalyticsQuery {
  @ApiProperty({ type: [String], description: 'Comma-separated topic IDs' })
  @IsString()
  @Matches(/^\d+(,\d+){1,4}$/)
  topicIds: string;
}
