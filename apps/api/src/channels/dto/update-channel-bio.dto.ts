import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateChannelBioDto {
  @ApiPropertyOptional({ description: '頻道簡介（選填，最多 100 字）', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bio?: string | null;
}
