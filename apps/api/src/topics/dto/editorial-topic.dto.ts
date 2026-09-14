import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { CreateTopicDto } from './topic.dto';

export class EditorialTopicDto extends CreateTopicDto {
  @ApiProperty({ default: false, description: 'Publish immediately instead of keeping an approved draft' })
  @IsBoolean()
  publish: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Source topic application IDs' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^\d+$/, { each: true })
  applicationIds?: string[];
}
