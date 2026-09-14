import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { AgeBand, ChineseZodiac, WesternZodiac } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export interface EncryptedBirthDate {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

@Injectable()
export class DemographicCryptoService {
  private readonly currentKeyVersion = Number(process.env.PROFILE_ENCRYPTION_KEY_VERSION || 1);
  private readonly currentKey = this.loadCurrentKey();

  encryptBirthDate(birthDate: string): EncryptedBirthDate {
    validateBirthDate(birthDate);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.currentKey, iv);
    const encrypted = Buffer.concat([cipher.update(birthDate, 'utf8'), cipher.final()]);
    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyVersion: this.currentKeyVersion,
    };
  }

  decryptBirthDate(ciphertext: string, iv: string, authTag: string, keyVersion = 1): string {
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.keyForVersion(keyVersion), Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(authTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('生日資料解密失敗');
    }
  }

  private loadCurrentKey() {
    const configured = process.env.PROFILE_ENCRYPTION_KEY;
    if (!configured && process.env.NODE_ENV === 'production') {
      throw new Error('正式環境必須設定 PROFILE_ENCRYPTION_KEY');
    }
    const key = configured
      ? Buffer.from(configured, 'base64')
      : createHash('sha256').update(process.env.JWT_SECRET || 'development-only-profile-key').digest();
    if (key.length !== 32) {
      throw new Error('PROFILE_ENCRYPTION_KEY 必須是 32 bytes 的 Base64 字串');
    }
    return key;
  }

  private keyForVersion(version: number) {
    if (version === this.currentKeyVersion) return this.currentKey;
    const configured = process.env[`PROFILE_ENCRYPTION_KEY_V${version}`];
    if (!configured) throw new Error(`缺少第 ${version} 版的人口資料加密金鑰`);
    const key = Buffer.from(configured, 'base64');
    if (key.length !== 32) throw new Error(`PROFILE_ENCRYPTION_KEY_V${version} 格式不正確`);
    return key;
  }
}

export function deriveDemographics(birthDate: string, now = new Date()) {
  const date = validateBirthDate(birthDate);
  const age = calculateAge(date, now);
  const lunarYearParts = new Intl.DateTimeFormat('en-u-ca-chinese', {
    year: 'numeric',
    timeZone: 'Asia/Taipei',
  }).formatToParts(date) as Array<{ type: string; value: string }>;
  const lunarYearPart = lunarYearParts.find((part) => part.type === 'relatedYear');
  if (!lunarYearPart) throw new BadRequestException('無法計算十二生肖');
  const lunarYear = Number(lunarYearPart.value);

  return {
    age,
    ageBand: toAgeBand(age),
    isMinor: age < 18,
    westernZodiac: toWesternZodiac(date.getUTCMonth() + 1, date.getUTCDate()),
    chineseZodiac: toChineseZodiac(lunarYear),
  };
}

function validateBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('生日格式必須為 YYYY-MM-DD');
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('生日日期不正確');
  }
  const year = date.getUTCFullYear();
  if (year < 1900 || date.getTime() > Date.now()) throw new BadRequestException('生日日期不在可接受範圍');
  return date;
}

function calculateAge(date: Date, now: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Taipei',
  }).formatToParts(now);
  const currentYear = Number(parts.find((part) => part.type === 'year')?.value);
  const currentMonth = Number(parts.find((part) => part.type === 'month')?.value);
  const currentDay = Number(parts.find((part) => part.type === 'day')?.value);
  let age = currentYear - date.getUTCFullYear();
  const beforeBirthday =
    currentMonth < date.getUTCMonth() + 1 ||
    (currentMonth === date.getUTCMonth() + 1 && currentDay < date.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function toAgeBand(age: number): AgeBand {
  if (age < 18) return AgeBand.UNDER_18;
  if (age < 25) return AgeBand.AGE_18_24;
  if (age < 35) return AgeBand.AGE_25_34;
  if (age < 45) return AgeBand.AGE_35_44;
  if (age < 55) return AgeBand.AGE_45_54;
  if (age < 65) return AgeBand.AGE_55_64;
  return AgeBand.AGE_65_PLUS;
}

function toWesternZodiac(month: number, day: number): WesternZodiac {
  const boundary = month * 100 + day;
  if (boundary >= 321 && boundary <= 419) return WesternZodiac.ARIES;
  if (boundary >= 420 && boundary <= 520) return WesternZodiac.TAURUS;
  if (boundary >= 521 && boundary <= 621) return WesternZodiac.GEMINI;
  if (boundary >= 622 && boundary <= 722) return WesternZodiac.CANCER;
  if (boundary >= 723 && boundary <= 822) return WesternZodiac.LEO;
  if (boundary >= 823 && boundary <= 922) return WesternZodiac.VIRGO;
  if (boundary >= 923 && boundary <= 1023) return WesternZodiac.LIBRA;
  if (boundary >= 1024 && boundary <= 1122) return WesternZodiac.SCORPIO;
  if (boundary >= 1123 && boundary <= 1221) return WesternZodiac.SAGITTARIUS;
  if (boundary >= 120 && boundary <= 218) return WesternZodiac.AQUARIUS;
  if (boundary >= 219 && boundary <= 320) return WesternZodiac.PISCES;
  return WesternZodiac.CAPRICORN;
}

function toChineseZodiac(year: number): ChineseZodiac {
  const signs = [
    ChineseZodiac.RAT,
    ChineseZodiac.OX,
    ChineseZodiac.TIGER,
    ChineseZodiac.RABBIT,
    ChineseZodiac.DRAGON,
    ChineseZodiac.SNAKE,
    ChineseZodiac.HORSE,
    ChineseZodiac.GOAT,
    ChineseZodiac.MONKEY,
    ChineseZodiac.ROOSTER,
    ChineseZodiac.DOG,
    ChineseZodiac.PIG,
  ];
  return signs[((year - 2020) % 12 + 12) % 12];
}
