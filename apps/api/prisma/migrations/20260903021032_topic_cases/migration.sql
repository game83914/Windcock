-- CreateTable
CREATE TABLE "topic_cases" (
    "id" BIGSERIAL NOT NULL,
    "topic_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "source_label" TEXT,
    "source_url" TEXT,
    "occurred_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topic_cases_topic_id_sort_order_idx" ON "topic_cases"("topic_id", "sort_order");

-- AddForeignKey
ALTER TABLE "topic_cases" ADD CONSTRAINT "topic_cases_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
