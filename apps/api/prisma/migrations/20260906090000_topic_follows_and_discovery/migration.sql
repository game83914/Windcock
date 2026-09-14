CREATE TABLE "topic_follows" (
  "user_id" BIGINT NOT NULL,
  "topic_id" BIGINT NOT NULL,
  "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "topic_follows_pkey" PRIMARY KEY ("user_id", "topic_id")
);

ALTER TABLE "topic_follows"
  ADD CONSTRAINT "topic_follows_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topic_follows"
  ADD CONSTRAINT "topic_follows_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "topic_follows_topic_id_created_at_idx" ON "topic_follows"("topic_id", "created_at" DESC);
CREATE INDEX "votes_created_at_idx" ON "votes"("created_at" DESC);
