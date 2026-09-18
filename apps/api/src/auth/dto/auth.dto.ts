import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '請輸入有效的 Email' })
  @MaxLength(254, { message: 'Email 過長' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 's3cur3-pass', minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72, { message: '密碼長度需為 8~72 字元' })
  password: string;

  @ApiProperty({ example: '公共議題觀察者' })
  @IsString()
  @Length(2, 20, { message: '暱稱長度需為 2~20 字元' })
  nickname: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @Matches(/^09\d{8}$/, { message: '請輸入有效的台灣手機門號（09xxxxxxxx）' })
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile token（開發模式可留空）' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '請輸入有效的 Email' })
  @MaxLength(254, { message: 'Email 過長' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 's3cur3-pass' })
  @IsString()
  @Length(1, 72, { message: '請輸入密碼' })
  password: string;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile token（開發模式可留空）' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'old-pass-123' })
  @IsString()
  @Length(1, 72, { message: '請輸入舊密碼' })
  oldPassword: string;

  @ApiProperty({ example: 'new-pass-456', minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72, { message: '新密碼長度需為 8~72 字元' })
  newPassword: string;
}
