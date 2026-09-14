import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class VoteDto {
  @ApiPropertyOptional({ description: '二元/多元題要選的選項 ID' })
  @IsOptional()
  @IsInt()
  @Min(1)
  optionId?: number;

  @ApiPropertyOptional({ description: '光譜題的分數（0~100）' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  spectrumValue?: number;
}
