-- 會員發起表單草稿與自存範本（快問 / 問卷共用同一表，以 kind + is_template 區分）
CREATE TYPE "DraftKind" AS ENUM ('QUICK', 'SURVEY');

CREATE TABLE "topic_drafts" (
  "id" BIGINT NOT NULL GENERATED ALWAYS AS IDENTITY,
  "user_id" BIGINT NOT NULL,
  "kind" "DraftKind" NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "payload" JSONB NOT NULL,
  "is_template" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "topic_drafts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "topic_drafts"
  ADD CONSTRAINT "topic_drafts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "topic_drafts_user_id_kind_is_template_idx" ON "topic_drafts"("user_id", "kind", "is_template");
