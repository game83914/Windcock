-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TOPIC_REVISION_APPROVED');

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "revision_number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "series_root_id" BIGINT,
ADD COLUMN     "supersedes_id" BIGINT;

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "topic_id" BIGINT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "topics_series_root_id_revision_number_idx" ON "topics"("series_root_id", "revision_number");

-- CreateIndex
CREATE INDEX "topics_supersedes_id_idx" ON "topics"("supersedes_id");

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
