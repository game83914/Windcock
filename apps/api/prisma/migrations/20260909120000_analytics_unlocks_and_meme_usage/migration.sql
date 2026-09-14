ALTER TYPE "PointTxType" ADD VALUE IF NOT EXISTS 'MEME_USAGE_REWARD';
ALTER TYPE "PointTxType" ADD VALUE IF NOT EXISTS 'MEME_USAGE_REVERSAL';
ALTER TYPE "PointTxType" ADD VALUE IF NOT EXISTS 'ANALYTICS_UNLOCK';

CREATE TYPE "AnalyticsModule" AS ENUM ('RESULT_TRENDS', 'DEMOGRAPHICS', 'STANCE_INSIGHTS');
CREATE TYPE "AnalyticsEntitlementFeature" AS ENUM ('CROSS_TOPIC_COMPARE');
CREATE TYPE "MemeUsageTargetType" AS ENUM ('POST', 'COMMENT', 'TOPIC_BLOCK');
CREATE TYPE "MemeUsageRewardStatus" AS ENUM ('REWARDED', 'SELF_USE', 'OFFICIAL', 'DUPLICATE_DAILY_USE', 'ACTOR_DAILY_LIMIT', 'CREATOR_DAILY_LIMIT', 'REVERSED');

ALTER TABLE "memes" ADD COLUMN "usage_count" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "memes" ADD COLUMN "rewarded_use_count" BIGINT NOT NULL DEFAULT 0;
UPDATE "memes" SET "price_points" = 0;

CREATE TABLE "topic_analytics_unlocks" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL,
  "topic_series_root_id" BIGINT NOT NULL,
  "module" "AnalyticsModule" NOT NULL,
  "cost_points" BIGINT NOT NULL,
  "point_transaction_id" BIGINT NOT NULL,
  "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "topic_analytics_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "topic_analytics_unlocks_topic_series_root_id_fkey" FOREIGN KEY ("topic_series_root_id") REFERENCES "topics"("id") ON DELETE CASCADE,
  CONSTRAINT "topic_analytics_unlocks_point_transaction_id_fkey" FOREIGN KEY ("point_transaction_id") REFERENCES "point_transactions"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "topic_analytics_unlocks_point_transaction_id_key" ON "topic_analytics_unlocks"("point_transaction_id");
CREATE UNIQUE INDEX "topic_analytics_unlocks_user_id_topic_series_root_id_module_key" ON "topic_analytics_unlocks"("user_id", "topic_series_root_id", "module");
CREATE INDEX "topic_analytics_unlocks_topic_series_root_id_module_idx" ON "topic_analytics_unlocks"("topic_series_root_id", "module");

CREATE TABLE "analytics_entitlements" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT,
  "organization_id" BIGINT,
  "feature" "AnalyticsEntitlementFeature" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "granted_by_id" BIGINT NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_entitlements_subject_check" CHECK (("user_id" IS NOT NULL) <> ("organization_id" IS NOT NULL)),
  CONSTRAINT "analytics_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "analytics_entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "analytics_entitlements_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "analytics_entitlements_user_id_feature_active_expires_at_idx" ON "analytics_entitlements"("user_id", "feature", "active", "expires_at");
CREATE INDEX "analytics_entitlements_organization_id_feature_active_expires_at_idx" ON "analytics_entitlements"("organization_id", "feature", "active", "expires_at");

CREATE TABLE "analytics_access_audits" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL,
  "organization_id" BIGINT,
  "feature" "AnalyticsEntitlementFeature" NOT NULL,
  "topic_ids" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_access_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "analytics_access_audits_user_id_created_at_idx" ON "analytics_access_audits"("user_id", "created_at" DESC);
CREATE INDEX "analytics_access_audits_organization_id_created_at_idx" ON "analytics_access_audits"("organization_id", "created_at" DESC);

CREATE TABLE "meme_usage_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "meme_id" BIGINT NOT NULL,
  "actor_user_id" BIGINT NOT NULL,
  "creator_id" BIGINT NOT NULL,
  "target_type" "MemeUsageTargetType" NOT NULL,
  "target_id" BIGINT NOT NULL,
  "reward_date" DATE NOT NULL,
  "reward_points" BIGINT NOT NULL DEFAULT 0,
  "reward_status" "MemeUsageRewardStatus" NOT NULL,
  "point_transaction_id" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meme_usage_events_meme_id_fkey" FOREIGN KEY ("meme_id") REFERENCES "memes"("id") ON DELETE RESTRICT,
  CONSTRAINT "meme_usage_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "meme_usage_events_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "meme_usage_events_point_transaction_id_fkey" FOREIGN KEY ("point_transaction_id") REFERENCES "point_transactions"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "meme_usage_events_point_transaction_id_key" ON "meme_usage_events"("point_transaction_id");
CREATE UNIQUE INDEX "meme_usage_events_target_type_target_id_meme_id_key" ON "meme_usage_events"("target_type", "target_id", "meme_id");
CREATE INDEX "meme_usage_events_actor_user_id_reward_date_reward_status_idx" ON "meme_usage_events"("actor_user_id", "reward_date", "reward_status");
CREATE INDEX "meme_usage_events_creator_id_reward_date_reward_status_idx" ON "meme_usage_events"("creator_id", "reward_date", "reward_status");
CREATE INDEX "meme_usage_events_meme_id_created_at_idx" ON "meme_usage_events"("meme_id", "created_at" DESC);
