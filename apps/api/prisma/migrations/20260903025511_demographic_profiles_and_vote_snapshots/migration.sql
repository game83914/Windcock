-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "OccupationCategory" AS ENUM ('STUDENT', 'PUBLIC_SERVICE', 'HEALTHCARE', 'TECHNOLOGY', 'FINANCE', 'MANUFACTURING', 'SERVICE', 'AGRICULTURE', 'CULTURE_MEDIA', 'FREELANCE', 'HOMEMAKER', 'UNEMPLOYED', 'RETIRED', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('UNDER_18', 'AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_54', 'AGE_55_64', 'AGE_65_PLUS');

-- CreateEnum
CREATE TYPE "WesternZodiac" AS ENUM ('ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES');

-- CreateEnum
CREATE TYPE "ChineseZodiac" AS ENUM ('RAT', 'OX', 'TIGER', 'RABBIT', 'DRAGON', 'SNAKE', 'HORSE', 'GOAT', 'MONKEY', 'ROOSTER', 'DOG', 'PIG');

-- CreateEnum
CREATE TYPE "GuardianConsentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DemographicDimension" AS ENUM ('AGE_BAND', 'GENDER', 'OCCUPATION', 'REGION', 'WESTERN_ZODIAC', 'CHINESE_ZODIAC');

-- CreateTable
CREATE TABLE "user_demographic_profiles" (
    "user_id" BIGINT NOT NULL,
    "birth_date_ciphertext" TEXT,
    "birth_date_iv" TEXT,
    "birth_date_auth_tag" TEXT,
    "birth_date_key_version" INTEGER,
    "gender" "Gender",
    "occupation" "OccupationCategory",
    "region" TEXT,
    "western_zodiac" "WesternZodiac",
    "chinese_zodiac" "ChineseZodiac",
    "is_minor" BOOLEAN,
    "analytics_consent" BOOLEAN NOT NULL DEFAULT false,
    "consent_version" TEXT,
    "consented_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "guardian_consent_status" "GuardianConsentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_demographic_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "guardian_consents" (
    "profile_user_id" BIGINT NOT NULL,
    "guardian_phone_hash" TEXT NOT NULL,
    "guardian_phone_last4" TEXT NOT NULL,
    "consent_version" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_consents_pkey" PRIMARY KEY ("profile_user_id")
);

-- CreateTable
CREATE TABLE "vote_demographic_snapshots" (
    "vote_id" BIGINT NOT NULL,
    "age_band" "AgeBand" NOT NULL,
    "gender" "Gender",
    "occupation" "OccupationCategory",
    "region" TEXT,
    "western_zodiac" "WesternZodiac",
    "chinese_zodiac" "ChineseZodiac",
    "is_minor" BOOLEAN NOT NULL,
    "consent_version" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_demographic_snapshots_pkey" PRIMARY KEY ("vote_id")
);

-- CreateTable
CREATE TABLE "demographic_analysis_audits" (
    "id" BIGSERIAL NOT NULL,
    "admin_id" BIGINT NOT NULL,
    "topic_id" BIGINT NOT NULL,
    "dimension" "DemographicDimension" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demographic_analysis_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vote_demographic_snapshots_age_band_idx" ON "vote_demographic_snapshots"("age_band");

-- CreateIndex
CREATE INDEX "vote_demographic_snapshots_gender_idx" ON "vote_demographic_snapshots"("gender");

-- CreateIndex
CREATE INDEX "vote_demographic_snapshots_occupation_idx" ON "vote_demographic_snapshots"("occupation");

-- CreateIndex
CREATE INDEX "vote_demographic_snapshots_region_idx" ON "vote_demographic_snapshots"("region");

-- CreateIndex
CREATE INDEX "vote_demographic_snapshots_western_zodiac_idx" ON "vote_demographic_snapshots"("western_zodiac");

-- CreateIndex
CREATE INDEX "vote_demographic_snapshots_chinese_zodiac_idx" ON "vote_demographic_snapshots"("chinese_zodiac");

-- CreateIndex
CREATE INDEX "demographic_analysis_audits_admin_id_created_at_idx" ON "demographic_analysis_audits"("admin_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "demographic_analysis_audits_topic_id_created_at_idx" ON "demographic_analysis_audits"("topic_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_demographic_profiles" ADD CONSTRAINT "user_demographic_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_profile_user_id_fkey" FOREIGN KEY ("profile_user_id") REFERENCES "user_demographic_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_demographic_snapshots" ADD CONSTRAINT "vote_demographic_snapshots_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demographic_analysis_audits" ADD CONSTRAINT "demographic_analysis_audits_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demographic_analysis_audits" ADD CONSTRAINT "demographic_analysis_audits_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
