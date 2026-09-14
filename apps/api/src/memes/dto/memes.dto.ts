import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MemeReportReason, MemeStatus } from '@prisma/client';

export class UploadMemeDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Length(3, 100)
  title: string;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @Equals(true, { message: '必須確認擁有素材使用及散布權利' })
  rightsAttested: boolean;
}

export class AdminUploadMemeDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Length(3, 100)
  title: string;
}

export class ListMemesQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ['NEWEST', 'POPULAR'] })
  @IsOptional()
  @IsIn(['NEWEST', 'POPULAR'])
  sort?: 'NEWEST' | 'POPULAR';

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class MyMemesQuery extends ListMemesQuery {
  @ApiProperty({ enum: ['collected', 'created'] })
  @IsIn(['collected', 'created'])
  scope: 'collected' | 'created';
}

export class AdminMemesQuery extends ListMemesQuery {
  @ApiPropertyOptional({ enum: MemeStatus })
  @IsOptional()
  @IsEnum(MemeStatus)
  status?: MemeStatus;
}

export class ReviewMemeDto {
  @ApiProperty()
  @IsString()
  @Length(2, 500)
  note: string;
}

export class TakedownMemeDto {
  @ApiProperty()
  @IsString()
  @Length(2, 500)
  reason: string;
}

export class ReportMemeDto {
  @ApiProperty({ enum: MemeReportReason })
  @IsEnum(MemeReportReason)
  reason: MemeReportReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;
}
