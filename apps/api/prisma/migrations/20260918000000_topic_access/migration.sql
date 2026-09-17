CREATE TYPE "TopicVisibility" AS ENUM ('PUBLIC', 'PRIVATE_LINK');
CREATE TYPE "TopicAudience" AS ENUM ('MEMBER_ONLY', 'FOLLOWERS_ONLY');

ALTER TABLE "topics"
  ADD COLUMN "visibility" "TopicVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "audience" "TopicAudience" NOT NULL DEFAULT 'MEMBER_ONLY',
  ADD COLUMN "audience_owner_id" BIGINT;

UPDATE "topics" SET "audience_owner_id" = "creator_id" WHERE "creator_id" IS NOT NULL;

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_audience_owner_id_fkey"
  FOREIGN KEY ("audience_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "topic_applications"
  ADD COLUMN "audience" "TopicAudience" NOT NULL DEFAULT 'MEMBER_ONLY';

ALTER TABLE "topic_application_revisions"
  ADD COLUMN "audience" "TopicAudience" NOT NULL DEFAULT 'MEMBER_ONLY';

CREATE TABLE "topic_share_links" (
  "id" BIGSERIAL NOT NULL,
  "topic_id" BIGINT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "topic_share_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "topic_share_grants" (
  "share_link_id" BIGINT NOT NULL,
  "topic_id" BIGINT NOT NULL,
  "user_id" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "topic_share_grants_pkey" PRIMARY KEY ("share_link_id", "user_id")
);

CREATE UNIQUE INDEX "topic_share_links_topic_id_key" ON "topic_share_links"("topic_id");
CREATE UNIQUE INDEX "topic_share_links_token_hash_key" ON "topic_share_links"("token_hash");
CREATE INDEX "topic_share_grants_topic_id_user_id_idx" ON "topic_share_grants"("topic_id", "user_id");
CREATE INDEX "topics_audience_owner_id_audience_created_at_idx" ON "topics"("audience_owner_id", "audience", "created_at" DESC);
CREATE INDEX "topics_visibility_status_vote_end_at_idx" ON "topics"("visibility", "status", "vote_end_at");

ALTER TABLE "topic_share_links"
  ADD CONSTRAINT "topic_share_links_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topic_share_grants"
  ADD CONSTRAINT "topic_share_grants_share_link_id_fkey"
  FOREIGN KEY ("share_link_id") REFERENCES "topic_share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "topic_share_grants_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "topic_share_grants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
