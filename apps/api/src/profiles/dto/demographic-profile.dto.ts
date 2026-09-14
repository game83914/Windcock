import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AnnualIncomeBand,
  EducationLevel,
  EmploymentStatus,
  Gender,
  HousingStatus,
  IndustryCategory,
  LivingArrangement,
  OccupationCategory,
  ParentingStage,
  PersonalityType,
  RelationshipStatus,
} from '@prisma/client';
import { Equals, IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

export const TAIWAN_REGIONS = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '嘉義市', '新竹縣', '苗栗縣', '彰化縣',
  '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣', '海外', '不願透露',
] as const;

export class UpdateDemographicProfileDto {
  @ApiPropertyOptional({ example: '1990-05-20', nullable: true })
  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @ApiPropertyOptional({ enum: Gender, nullable: true })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @ApiPropertyOptional({ enum: OccupationCategory, nullable: true })
  @IsOptional()
  @IsEnum(OccupationCategory)
  occupation?: OccupationCategory | null;

  @ApiPropertyOptional({ enum: TAIWAN_REGIONS, nullable: true })
  @IsOptional()
  @IsIn(TAIWAN_REGIONS)
  region?: string | null;

  @ApiPropertyOptional({ example: '中正區', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  district?: string | null;

  @ApiPropertyOptional({ enum: PersonalityType, nullable: true })
  @IsOptional()
  @IsEnum(PersonalityType)
  personalityType?: PersonalityType | null;

  @ApiPropertyOptional({ enum: EmploymentStatus, nullable: true })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus | null;

  @ApiPropertyOptional({ enum: IndustryCategory, nullable: true })
  @IsOptional()
  @IsEnum(IndustryCategory)
  industry?: IndustryCategory | null;

  @ApiPropertyOptional({ enum: AnnualIncomeBand, nullable: true })
  @IsOptional()
  @IsEnum(AnnualIncomeBand)
  annualIncome?: AnnualIncomeBand | null;

  @ApiPropertyOptional({ enum: EducationLevel, nullable: true })
  @IsOptional()
  @IsEnum(EducationLevel)
  education?: EducationLevel | null;

  @ApiPropertyOptional({ enum: RelationshipStatus, nullable: true })
  @IsOptional()
  @IsEnum(RelationshipStatus)
  relationship?: RelationshipStatus | null;

  @ApiPropertyOptional({ enum: LivingArrangement, nullable: true })
  @IsOptional()
  @IsEnum(LivingArrangement)
  livingArrangement?: LivingArrangement | null;

  @ApiPropertyOptional({ enum: ParentingStage, nullable: true })
  @IsOptional()
  @IsEnum(ParentingStage)
  parentingStage?: ParentingStage | null;

  @ApiPropertyOptional({ enum: HousingStatus, nullable: true })
  @IsOptional()
  @IsEnum(HousingStatus)
  housingStatus?: HousingStatus | null;

  @ApiProperty({ description: '是否同意將人口分類加入匿名投票分析' })
  @IsBoolean()
  analyticsConsent: boolean;

  @ApiPropertyOptional({ example: '2026-09-v3', description: '同意匿名彙總可供會員及企業分析使用的告知版本' })
  @ValidateIf((value: UpdateDemographicProfileDto) => value.analyticsConsent)
  @IsIn(['2026-09-v3'])
  analyticsConsentVersion?: string;
}

export class GuardianOtpDto {
  @ApiProperty({ example: '0912345678' })
  @Matches(/^09\d{8}$/, { message: '請輸入有效的台灣手機門號（09xxxxxxxx）' })
  phoneNumber: string;
}

export class VerifyGuardianOtpDto extends GuardianOtpDto {
  @ApiProperty({ example: 'ABC123' })
  @Matches(/^[A-F0-9]{6}$/i, { message: '驗證碼必須為 6 位英數字' })
  code: string;

  @ApiProperty({ description: '確認為會員之法定代理人並同意匿名分析' })
  @Equals(true, { message: '法定代理人必須確認同意內容' })
  attestsLegalGuardian: boolean;
}
