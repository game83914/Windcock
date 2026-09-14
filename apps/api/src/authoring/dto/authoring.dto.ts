import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateNested } from 'class-validator';

export class CreateAuthoringSessionDto {
  @ApiProperty({ enum: ['TOPIC', 'STANCE'] })
  @IsIn(['TOPIC', 'STANCE'])
  target: 'TOPIC' | 'STANCE';

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @Length(10, 2000)
  brief: string;

  @ApiPropertyOptional({ description: '立場草稿所屬議題 ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  topicId?: string;

  @ApiPropertyOptional({ description: '衍生立場的父節點 ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  parentId?: string;

  @ApiPropertyOptional({ description: '目前表單內容，只作為草稿上下文' })
  @IsOptional()
  @IsObject()
  form?: Record<string, unknown>;
}

export class AuthoringAnswerDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  questionId: string;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  value: string;
}

export class GenerateAuthoringDraftsDto {
  @ApiProperty({ type: [AuthoringAnswerDto], minItems: 2, maxItems: 4 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => AuthoringAnswerDto)
  answers: AuthoringAnswerDto[];
}

export class GenerateStanceDraftsDto {
  @ApiProperty({ description: '立場所屬議題 ID' })
  @IsString()
  @Matches(/^\d+$/)
  topicId: string;

  @ApiPropertyOptional({ description: '正在延伸的立場 ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  parentId?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  rationale?: string;
}
