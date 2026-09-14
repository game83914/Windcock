import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { CreateTopicDto } from './topic.dto';

export class ImportTopicStanceDto {
  @ApiProperty({ example: '支持優先區，但要求保留停車位' })
  @IsString()
  @Length(2, 80)
  title: string;

  @ApiPropertyOptional({ example: '快速通行不該以鄰里停車需求為代價……' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  rationale?: string;

  @ApiPropertyOptional({ type: () => [ImportTopicStanceDto], description: '子立場，巢狀至多 4 層' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ImportTopicStanceDto)
  children?: ImportTopicStanceDto[];
}

export class ImportTopicDto extends CreateTopicDto {
  @ApiProperty({ default: false, description: 'Publish immediately instead of saving as an approved draft' })
  @IsBoolean()
  publish: boolean;

  @ApiPropertyOptional({ type: [ImportTopicStanceDto], maxItems: 60, description: '立場樹，建立者為執行匯入的編輯' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ImportTopicStanceDto)
  stances?: ImportTopicStanceDto[];
}