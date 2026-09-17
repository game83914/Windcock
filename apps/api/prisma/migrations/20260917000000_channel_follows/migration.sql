-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CHANNEL_NEW_TOPIC';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "channel_bio" TEXT;

-- CreateTable
CREATE TABLE "channel_follows" (
    "following_id" BIGINT NOT NULL,
    "channel_owner_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_follows_pkey" PRIMARY KEY ("following_id","channel_owner_id")
);

-- CreateIndex
CREATE INDEX "channel_follows_channel_owner_id_created_at_idx" ON "channel_follows"("channel_owner_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "channel_follows" ADD CONSTRAINT "channel_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_follows" ADD CONSTRAINT "channel_follows_channel_owner_id_fkey" FOREIGN KEY ("channel_owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

