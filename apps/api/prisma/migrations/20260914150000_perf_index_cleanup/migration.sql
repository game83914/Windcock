-- 第四批：效能優化
-- A. 搜尋加速：啟用 pg_trgm，建立 GIN trigram 索引讓 ILIKE '%term%' 走索引（≥3 字元查詢）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "topics_title_idx" ON "topics" USING gin ("title" gin_trgm_ops);
CREATE INDEX "topics_description_idx" ON "topics" USING gin ("description" gin_trgm_ops);
CREATE INDEX "memes_title_idx" ON "memes" USING gin ("title" gin_trgm_ops);

-- B. 刪除 VoteDemographicSnapshot 16 支單欄索引
-- 所有 analytics 查詢皆先靠 vote join 抓 topicId，單欄索引無法被使用，純屬每次投票的寫放大。
DROP INDEX "vote_demographic_snapshots_age_band_idx";
DROP INDEX "vote_demographic_snapshots_gender_idx";
DROP INDEX "vote_demographic_snapshots_occupation_idx";
DROP INDEX "vote_demographic_snapshots_region_idx";
DROP INDEX "vote_demographic_snapshots_district_idx";
DROP INDEX "vote_demographic_snapshots_personality_type_idx";
DROP INDEX "vote_demographic_snapshots_employment_status_idx";
DROP INDEX "vote_demographic_snapshots_industry_idx";
DROP INDEX "vote_demographic_snapshots_annual_income_idx";
DROP INDEX "vote_demographic_snapshots_education_idx";
DROP INDEX "vote_demographic_snapshots_relationship_idx";
DROP INDEX "vote_demographic_snapshots_living_arrangement_idx";
DROP INDEX "vote_demographic_snapshots_parenting_stage_idx";
DROP INDEX "vote_demographic_snapshots_housing_status_idx";
DROP INDEX "vote_demographic_snapshots_western_zodiac_idx";
DROP INDEX "vote_demographic_snapshots_chinese_zodiac_idx";

-- D. 刪除重複 phone 索引（「@unique」已自動建立索引，此即為冗餘索引）
DROP INDEX "users_phone_number_idx";