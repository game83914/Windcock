-- 問卷：父層 SURVEY 容器主題，擁有子層題目主題（parent_topic_id + sort_order）
ALTER TYPE "TopicKind" ADD VALUE 'SURVEY';
ALTER TYPE "TopicType" ADD VALUE 'SURVEY';

ALTER TABLE "topics" ADD COLUMN "parent_topic_id" BIGINT;
ALTER TABLE "topics" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "topics_parent_topic_id_sort_order_idx" ON "topics"("parent_topic_id", "sort_order");

ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_topic_id_fkey" FOREIGN KEY ("parent_topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
