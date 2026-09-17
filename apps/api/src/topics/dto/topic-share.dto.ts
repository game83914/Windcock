import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RedeemTopicShareDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  token: string;
}
