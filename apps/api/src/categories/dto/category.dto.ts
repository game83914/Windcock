import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

class CategoryBaseDto {
  @ApiProperty({ example: '生活' })
  @IsString()
  @Length(1, 20)
  label: string;

  @ApiProperty({ example: '生活選擇' })
  @IsString()
  @Length(1, 30)
  eyebrow: string;

  @ApiProperty({ example: '#3f7a58' })
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color: string;

  @ApiProperty({ example: '#e5f1e9' })
  @Matches(/^#[0-9a-fA-F]{6}$/)
  soft: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateCategoryDto extends CategoryBaseDto {
  @ApiProperty({ example: 'life' })
  @Matches(/^[a-z0-9-]+$/)
  key: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: '生活' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  label?: string;

  @ApiPropertyOptional({ example: '生活選擇' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  eyebrow?: string;

  @ApiPropertyOptional({ example: '#3f7a58' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;

  @ApiPropertyOptional({ example: '#e5f1e9' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  soft?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}