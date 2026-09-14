import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: '我支持核四，因為……' })
  @ValidateIf((_, value) => value !== undefined && value !== '')
  @IsString()
  @Length(1, 2000)
  content?: string;

  @ApiProperty({ description: '貼文歸屬的立場節點 ID' })
  @IsString()
  @Matches(/^\d+$/)
  stanceId: string;

  @ApiPropertyOptional({ type: [String], maxItems: 4 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @Matches(/^\d+$/, { each: true })
  memeIds?: string[];
}

export class CreateCommentDto {
  @ApiProperty({ example: '同意，參見之前那篇報導。' })
  @ValidateIf((_, value) => value !== undefined && value !== '')
  @IsString()
  @Length(1, 500)
  content?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 1 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1)
  @Matches(/^\d+$/, { each: true })
  memeIds?: string[];
}

export class LikeDto {
  @ApiProperty({ enum: ['post', 'comment'] })
  @IsEnum(['post', 'comment'])
  targetType: 'post' | 'comment';

  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  targetId: string;
}

export class PaginationQuery {
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

  @ApiPropertyOptional({ description: '只列出歸屬該立場節點的貼文（可空）' })
  @IsOptional()
  @Matches(/^\d+$/)
  stanceId?: string;
}
