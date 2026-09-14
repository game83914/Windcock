BEGIN;

ALTER TABLE "topic_cases" RENAME TO "topic_content_blocks";

ALTER TABLE "topic_content_blocks"
  RENAME CONSTRAINT "topic_cases_pkey" TO "topic_content_blocks_pkey";

ALTER TABLE "topic_content_blocks"
  RENAME CONSTRAINT "topic_cases_topic_id_fkey" TO "topic_content_blocks_topic_id_fkey";

ALTER INDEX "topic_cases_topic_id_sort_order_idx"
  RENAME TO "topic_content_blocks_topic_id_sort_order_idx";

COMMIT;