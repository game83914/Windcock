-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TopicModerationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "creator_id" BIGINT,
ADD COLUMN     "moderation_note" TEXT,
ADD COLUMN     "moderation_status" "TopicModerationStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" BIGINT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "topics_moderation_status_created_at_idx" ON "topics"("moderation_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "topics_creator_id_created_at_idx" ON "topics"("creator_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
