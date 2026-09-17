-- AddImageRankTopicType
-- 二選一排名賽：4~50 張圖片選項，逐對二選一排序；每人的整局排序結果
-- 存於 topic_rank_results（一人一題一筆，可重玩覆蓋）。

ALTER TYPE "TopicType" ADD VALUE IF NOT EXISTS 'IMAGE_RANK';

CREATE TABLE "topic_rank_results" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "topic_id" BIGINT NOT NULL,
    "ranking" JSONB NOT NULL,
    "comparisons" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_rank_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "topic_rank_results_user_id_topic_id_key" ON "topic_rank_results"("user_id", "topic_id");
CREATE INDEX "topic_rank_results_topic_id_idx" ON "topic_rank_results"("topic_id");

ALTER TABLE "topic_rank_results" ADD CONSTRAINT "topic_rank_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "topic_rank_results" ADD CONSTRAINT "topic_rank_results_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;