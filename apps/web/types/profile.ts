export type Gender = 'FEMALE' | 'MALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type OccupationCategory = 'STUDENT' | 'PUBLIC_SERVICE' | 'HEALTHCARE' | 'TECHNOLOGY' | 'FINANCE' | 'MANUFACTURING' | 'SERVICE' | 'AGRICULTURE' | 'CULTURE_MEDIA' | 'FREELANCE' | 'HOMEMAKER' | 'UNEMPLOYED' | 'RETIRED' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type PersonalityType = 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP' | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP' | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ' | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP' | 'PREFER_NOT_TO_SAY';
export type EmploymentStatus = 'FULL_TIME' | 'PART_TIME' | 'SELF_EMPLOYED' | 'EMPLOYER' | 'STUDENT' | 'HOMEMAKER_CAREGIVER' | 'UNEMPLOYED' | 'RETIRED' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type IndustryCategory = 'PUBLIC_ADMINISTRATION' | 'EDUCATION' | 'HEALTHCARE' | 'TECHNOLOGY' | 'FINANCE' | 'MANUFACTURING' | 'RETAIL_ECOMMERCE' | 'HOSPITALITY_TOURISM' | 'CONSTRUCTION_REAL_ESTATE' | 'TRANSPORT_LOGISTICS' | 'PROFESSIONAL_SERVICES' | 'CULTURE_MEDIA' | 'AGRICULTURE' | 'NONPROFIT' | 'OTHER' | 'NOT_APPLICABLE' | 'PREFER_NOT_TO_SAY';
export type AnnualIncomeBand = 'UNDER_300K' | 'TWD_300K_499K' | 'TWD_500K_799K' | 'TWD_800K_1199K' | 'TWD_1200K_1999K' | 'TWD_2000K_PLUS' | 'NO_FIXED_INCOME' | 'PREFER_NOT_TO_SAY';
export type EducationLevel = 'MIDDLE_SCHOOL_OR_BELOW' | 'HIGH_SCHOOL_VOCATIONAL' | 'ASSOCIATE' | 'BACHELOR' | 'MASTER' | 'DOCTORATE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type RelationshipStatus = 'SINGLE' | 'DATING' | 'MARRIED' | 'SEPARATED_DIVORCED' | 'WIDOWED' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type LivingArrangement = 'ALONE' | 'WITH_PARTNER' | 'WITH_PARENTS_RELATIVES' | 'WITH_PARTNER_CHILDREN' | 'SINGLE_PARENT_CHILDREN' | 'THREE_GENERATION' | 'ROOMMATES_DORM' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type ParentingStage = 'NO_CHILDREN' | 'EXPECTING' | 'PRESCHOOL' | 'PRIMARY_SCHOOL' | 'SECONDARY_SCHOOL' | 'ADULT_CHILDREN' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type HousingStatus = 'OWN_OUTRIGHT' | 'MORTGAGE' | 'RENT' | 'SOCIAL_HOUSING' | 'DORMITORY' | 'LIVING_WITH_FAMILY' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type DemographicDimension = 'AGE_BAND' | 'GENDER' | 'OCCUPATION' | 'REGION' | 'DISTRICT' | 'PERSONALITY_TYPE' | 'EMPLOYMENT_STATUS' | 'INDUSTRY' | 'ANNUAL_INCOME' | 'EDUCATION' | 'RELATIONSHIP' | 'LIVING_ARRANGEMENT' | 'PARENTING_STAGE' | 'HOUSING_STATUS' | 'WESTERN_ZODIAC' | 'CHINESE_ZODIAC';

export interface DemographicProfileOptions {
  regions: Array<{ region: string; districts: string[] }>;
  specialRegions: string[];
}

export interface DemographicProfile {
  birthDate?: string | null;
  gender?: Gender | null;
  occupation?: OccupationCategory | null;
  region?: string | null;
  district?: string | null;
  personalityType?: PersonalityType | null;
  employmentStatus?: EmploymentStatus | null;
  industry?: IndustryCategory | null;
  annualIncome?: AnnualIncomeBand | null;
  education?: EducationLevel | null;
  relationship?: RelationshipStatus | null;
  livingArrangement?: LivingArrangement | null;
  parentingStage?: ParentingStage | null;
  housingStatus?: HousingStatus | null;
  westernZodiac?: string | null;
  chineseZodiac?: string | null;
  isMinor?: boolean | null;
  analyticsConsent: boolean;
  analysisActive: boolean;
  consentVersion?: string | null;
  consentedAt?: string | null;
  guardianConsentStatus: 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'REVOKED';
  guardianPhoneLast4?: string | null;
  updatedAt: string;
}

export interface DemographicGroup {
  key: string;
  count: number;
  median?: number | null;
  options?: Array<{ optionId: string; label: string; count: number; percentage: number }>;
}

export interface DemographicResults {
  topicId: string;
  topicType: string;
  dimension: DemographicDimension;
  totalVotes: string;
  profiledVotes: number;
  dimensionVotes: number;
  coveragePercent: number;
  thresholds: { total: number; cohort: number };
  methodology: string;
  available: boolean;
  suppressedCount: number;
  groups: DemographicGroup[];
}
