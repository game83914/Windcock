import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '0912345678' })
  @Matches(/^09\d{8}$/, { message: '請輸入有效的台灣手機門號（09xxxxxxxx）' })
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile token（開發模式可留空）' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '0912345678' })
  @Matches(/^09\d{8}$/, { message: '請輸入有效的台灣手機門號（09xxxxxxxx）' })
  phoneNumber: string;

  @ApiProperty({ example: 'ABC123' })
  @IsString()
  @Length(6, 6, { message: '驗證碼必須為 6 位' })
  code: string;
}
