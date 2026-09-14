-- 快問（UGC 微投票）雙軌制：與正式民調分軌，並記錄小時級截止與結算門檻
CREATE TYPE "TopicKind" AS ENUM ('FORMAL', 'QUICK');

ALTER TABLE "topics" ADD COLUMN "kind" "TopicKind" NOT NULL DEFAULT 'FORMAL';
ALTER TABLE "topics" ADD COLUMN "vote_duration_hours" INTEGER;
ALTER TABLE "topics" ADD COLUMN "min_votes" INTEGER;

-- 快問列表走 kind + status + voteEndAt 的掃描
CREATE INDEX "topics_kind_status_vote_end_at_idx" ON "topics"("kind", "status", "vote_end_at");
CREATE INDEX "topics_kind_created_at_idx" ON "topics"("kind", "created_at" DESC);