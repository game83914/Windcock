CREATE TYPE "PersonalityType" AS ENUM ('INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP', 'PREFER_NOT_TO_SAY');
CREATE TYPE "EmploymentStatus" AS ENUM ('FULL_TIME', 'PART_TIME', 'SELF_EMPLOYED', 'EMPLOYER', 'STUDENT', 'HOMEMAKER_CAREGIVER', 'UNEMPLOYED', 'RETIRED', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "IndustryCategory" AS ENUM ('PUBLIC_ADMINISTRATION', 'EDUCATION', 'HEALTHCARE', 'TECHNOLOGY', 'FINANCE', 'MANUFACTURING', 'RETAIL_ECOMMERCE', 'HOSPITALITY_TOURISM', 'CONSTRUCTION_REAL_ESTATE', 'TRANSPORT_LOGISTICS', 'PROFESSIONAL_SERVICES', 'CULTURE_MEDIA', 'AGRICULTURE', 'NONPROFIT', 'OTHER', 'NOT_APPLICABLE', 'PREFER_NOT_TO_SAY');
CREATE TYPE "AnnualIncomeBand" AS ENUM ('UNDER_300K', 'TWD_300K_499K', 'TWD_500K_799K', 'TWD_800K_1199K', 'TWD_1200K_1999K', 'TWD_2000K_PLUS', 'NO_FIXED_INCOME', 'PREFER_NOT_TO_SAY');
CREATE TYPE "EducationLevel" AS ENUM ('MIDDLE_SCHOOL_OR_BELOW', 'HIGH_SCHOOL_VOCATIONAL', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "RelationshipStatus" AS ENUM ('SINGLE', 'DATING', 'MARRIED', 'SEPARATED_DIVORCED', 'WIDOWED', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "LivingArrangement" AS ENUM ('ALONE', 'WITH_PARTNER', 'WITH_PARENTS_RELATIVES', 'WITH_PARTNER_CHILDREN', 'SINGLE_PARENT_CHILDREN', 'THREE_GENERATION', 'ROOMMATES_DORM', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "ParentingStage" AS ENUM ('NO_CHILDREN', 'EXPECTING', 'PRESCHOOL', 'PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADULT_CHILDREN', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "HousingStatus" AS ENUM ('OWN_OUTRIGHT', 'MORTGAGE', 'RENT', 'SOCIAL_HOUSING', 'DORMITORY', 'LIVING_WITH_FAMILY', 'OTHER', 'PREFER_NOT_TO_SAY');

ALTER TYPE "DemographicDimension" ADD VALUE 'DISTRICT';
ALTER TYPE "DemographicDimension" ADD VALUE 'PERSONALITY_TYPE';
ALTER TYPE "DemographicDimension" ADD VALUE 'EMPLOYMENT_STATUS';
ALTER TYPE "DemographicDimension" ADD VALUE 'INDUSTRY';
ALTER TYPE "DemographicDimension" ADD VALUE 'ANNUAL_INCOME';
ALTER TYPE "DemographicDimension" ADD VALUE 'EDUCATION';
ALTER TYPE "DemographicDimension" ADD VALUE 'RELATIONSHIP';
ALTER TYPE "DemographicDimension" ADD VALUE 'LIVING_ARRANGEMENT';
ALTER TYPE "DemographicDimension" ADD VALUE 'PARENTING_STAGE';
ALTER TYPE "DemographicDimension" ADD VALUE 'HOUSING_STATUS';

ALTER TABLE "user_demographic_profiles"
  ADD COLUMN "district" TEXT,
  ADD COLUMN "personality_type" "PersonalityType",
  ADD COLUMN "employment_status" "EmploymentStatus",
  ADD COLUMN "industry" "IndustryCategory",
  ADD COLUMN "annual_income" "AnnualIncomeBand",
  ADD COLUMN "education" "EducationLevel",
  ADD COLUMN "relationship" "RelationshipStatus",
  ADD COLUMN "living_arrangement" "LivingArrangement",
  ADD COLUMN "parenting_stage" "ParentingStage",
  ADD COLUMN "housing_status" "HousingStatus";

ALTER TABLE "vote_demographic_snapshots"
  ADD COLUMN "district" TEXT,
  ADD COLUMN "personality_type" "PersonalityType",
  ADD COLUMN "employment_status" "EmploymentStatus",
  ADD COLUMN "industry" "IndustryCategory",
  ADD COLUMN "annual_income" "AnnualIncomeBand",
  ADD COLUMN "education" "EducationLevel",
  ADD COLUMN "relationship" "RelationshipStatus",
  ADD COLUMN "living_arrangement" "LivingArrangement",
  ADD COLUMN "parenting_stage" "ParentingStage",
  ADD COLUMN "housing_status" "HousingStatus";

CREATE INDEX "vote_demographic_snapshots_district_idx" ON "vote_demographic_snapshots"("district");
CREATE INDEX "vote_demographic_snapshots_personality_type_idx" ON "vote_demographic_snapshots"("personality_type");
CREATE INDEX "vote_demographic_snapshots_employment_status_idx" ON "vote_demographic_snapshots"("employment_status");
CREATE INDEX "vote_demographic_snapshots_industry_idx" ON "vote_demographic_snapshots"("industry");
CREATE INDEX "vote_demographic_snapshots_annual_income_idx" ON "vote_demographic_snapshots"("annual_income");
CREATE INDEX "vote_demographic_snapshots_education_idx" ON "vote_demographic_snapshots"("education");
CREATE INDEX "vote_demographic_snapshots_relationship_idx" ON "vote_demographic_snapshots"("relationship");
CREATE INDEX "vote_demographic_snapshots_living_arrangement_idx" ON "vote_demographic_snapshots"("living_arrangement");
CREATE INDEX "vote_demographic_snapshots_parenting_stage_idx" ON "vote_demographic_snapshots"("parenting_stage");
CREATE INDEX "vote_demographic_snapshots_housing_status_idx" ON "vote_demographic_snapshots"("housing_status");
