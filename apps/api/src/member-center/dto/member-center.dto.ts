import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { AVATAR_PRESETS, AvatarPreset } from '../../avatars/avatar-presets';

export const VOTE_HISTORY_FILTERS = ['ALL', 'OPEN', 'CLOSED'] as const;

export class VoteHistoryQuery {
  @ApiPropertyOptional({ enum: VOTE_HISTORY_FILTERS, default: 'ALL' })
  @IsOptional()
  @IsIn(VOTE_HISTORY_FILTERS)
  status?: (typeof VOTE_HISTORY_FILTERS)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class UpdateAccountDto {
  @ApiProperty({ example: '公共議題觀察者' })
  @IsString()
  @Length(2, 30)
  nickname: string;
}

export class SelectAvatarPresetDto {
  @ApiProperty({ enum: AVATAR_PRESETS })
  @IsIn(AVATAR_PRESETS)
  preset: AvatarPreset;
}
