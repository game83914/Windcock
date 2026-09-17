import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class SaveRankDto {
  @ApiProperty({ description: '依名次排列的選項 ID 陣列（第 1 名在前）', isArray: true })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^\d+$/, { each: true })
  ranking: string[];

  @ApiPropertyOptional({ description: '整局進行的比較次數' })
  @IsOptional()
  @IsInt()
  @Min(0)
  comparisons?: number;
}