-- 立場樹：讓會員在同一議題下長出結構化立場（跨陣營「認同」與「理解」）

CREATE TYPE "TopicStanceSignalType" AS ENUM ('AGREE', 'UNDERSTAND');
CREATE TYPE "TopicStanceStatus" AS ENUM ('ACTIVE', 'TAKEN_DOWN');
CREATE TYPE "TopicStanceReportReason" AS ENUM ('HARASSMENT', 'INAPPROPRIATE', 'FALSE_INFO', 'OTHER');
CREATE TYPE "TopicStanceReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TABLE "topic_stances" (
  "id" BIGSERIAL NOT NULL,
  "topic_id" BIGINT NOT NULL,
  "parent_id" BIGINT,
  "creator_id" BIGINT NOT NULL,
  "title" TEXT NOT NULL,
  "rationale" TEXT,
  "depth" INTEGER NOT NULL DEFAULT 0,
  "status" "TopicStanceStatus" NOT NULL DEFAULT 'ACTIVE',
  "agreement_count" INTEGER NOT NULL DEFAULT 0,
  "understanding_count" INTEGER NOT NULL DEFAULT 0,
  "taken_down_by_id" BIGINT,
  "taken_down_at" TIMESTAMPTZ,
  "takedown_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "topic_stances_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "topic_stances"
  ADD CONSTRAINT "topic_stances_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_stances"
  ADD CONSTRAINT "topic_stances_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "topic_stances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_stances"
  ADD CONSTRAINT "topic_stances_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "topic_stances"
  ADD CONSTRAINT "topic_stances_taken_down_by_id_fkey" FOREIGN KEY ("taken_down_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "topic_stances_topic_id_depth_created_at_idx" ON "topic_stances"("topic_id", "depth", "created_at" DESC);
CREATE INDEX "topic_stances_parent_id_idx" ON "topic_stances"("parent_id");

CREATE TABLE "topic_stance_signals" (
  "id" BIGSERIAL NOT NULL,
  "stance_id" BIGINT NOT NULL,
  "user_id" BIGINT NOT NULL,
  "signal" "TopicStanceSignalType" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "topic_stance_signals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "topic_stance_signals"
  ADD CONSTRAINT "topic_stance_signals_stance_id_fkey" FOREIGN KEY ("stance_id") REFERENCES "topic_stances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_stance_signals"
  ADD CONSTRAINT "topic_stance_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "topic_stance_signals_stance_id_user_id_signal_key" ON "topic_stance_signals"("stance_id", "user_id", "signal");
CREATE INDEX "topic_stance_signals_user_id_created_at_idx" ON "topic_stance_signals"("user_id", "created_at" DESC);

CREATE TABLE "topic_stance_reports" (
  "id" BIGSERIAL NOT NULL,
  "stance_id" BIGINT NOT NULL,
  "reporter_id" BIGINT NOT NULL,
  "reason" "TopicStanceReportReason" NOT NULL,
  "detail" TEXT,
  "status" "TopicStanceReportStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ,
  CONSTRAINT "topic_stance_reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "topic_stance_reports"
  ADD CONSTRAINT "topic_stance_reports_stance_id_fkey" FOREIGN KEY ("stance_id") REFERENCES "topic_stances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_stance_reports"
  ADD CONSTRAINT "topic_stance_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "topic_stance_reports_stance_id_reporter_id_key" ON "topic_stance_reports"("stance_id", "reporter_id");
CREATE INDEX "topic_stance_reports_status_created_at_idx" ON "topic_stance_reports"("status", "created_at" DESC);

-- 貼文可掛到單一立場節點（可空）
ALTER TABLE "posts" ADD COLUMN "stance_id" BIGINT;
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_stance_id_fkey" FOREIGN KEY ("stance_id") REFERENCES "topic_stances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "posts_stance_id_created_at_idx" ON "posts"("stance_id", "created_at" DESC);