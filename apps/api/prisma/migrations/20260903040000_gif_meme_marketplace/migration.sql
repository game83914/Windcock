ALTER TYPE "TopicContentBlockType" ADD VALUE 'GIF';
ALTER TYPE "PointTxType" ADD VALUE 'MEME_REFUND';
ALTER TYPE "PointTxType" ADD VALUE 'MEME_SELL_REVERSAL';
ALTER TYPE "MemeStatus" ADD VALUE 'TAKEN_DOWN';

CREATE TYPE "MemeOrigin" AS ENUM ('USER', 'OFFICIAL');
CREATE TYPE "MemeOrderStatus" AS ENUM ('ACTIVE', 'REFUNDED');
CREATE TYPE "MemeReportReason" AS ENUM ('COPYRIGHT', 'INAPPROPRIATE', 'OTHER');
CREATE TYPE "MemeReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
CREATE TYPE "PublicPointPoolTxType" AS ENUM ('MEME_PURCHASE', 'MEME_REFUND');

-- The legacy tables were an unused scaffold with no API or stored media. Their
-- URL-only rows cannot satisfy the validated-media and refund ledger contract.
DELETE FROM "meme_orders";
DELETE FROM "memes";

ALTER TABLE "memes"
  ADD COLUMN "origin" "MemeOrigin" NOT NULL DEFAULT 'USER',
  ADD COLUMN "storage_key" TEXT NOT NULL,
  ADD COLUMN "mime_type" TEXT NOT NULL DEFAULT 'image/gif',
  ADD COLUMN "byte_size" INTEGER NOT NULL,
  ADD COLUMN "width" INTEGER NOT NULL,
  ADD COLUMN "height" INTEGER NOT NULL,
  ADD COLUMN "frame_count" INTEGER NOT NULL,
  ADD COLUMN "duration_ms" INTEGER NOT NULL,
  ADD COLUMN "sha256" TEXT NOT NULL,
  ADD COLUMN "rights_attested_at" TIMESTAMP(3) NOT NULL,
  ADD COLUMN "reviewed_by_id" BIGINT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "moderation_note" TEXT,
  ADD COLUMN "taken_down_by_id" BIGINT,
  ADD COLUMN "taken_down_at" TIMESTAMP(3),
  ADD COLUMN "takedown_reason" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL;

ALTER TABLE "memes" RENAME COLUMN "download_count" TO "collection_count";

ALTER TABLE "memes" DROP COLUMN "raw_image_url";
ALTER TABLE "memes" DROP COLUMN "watermarked_url";

ALTER TABLE "meme_orders"
  ADD COLUMN "creator_share" BIGINT NOT NULL,
  ADD COLUMN "burn_share" BIGINT NOT NULL,
  ADD COLUMN "public_pool_share" BIGINT NOT NULL,
  ADD COLUMN "status" "MemeOrderStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "idempotency_key" TEXT NOT NULL,
  ADD COLUMN "refunded_at" TIMESTAMP(3),
  ADD COLUMN "refund_reason" TEXT;

ALTER TABLE "topic_cases" ADD COLUMN "meme_id" BIGINT;

CREATE TABLE "post_meme_attachments" (
  "post_id" BIGINT NOT NULL,
  "meme_id" BIGINT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "post_meme_attachments_pkey" PRIMARY KEY ("post_id", "meme_id")
);

CREATE TABLE "comment_meme_attachments" (
  "comment_id" BIGINT NOT NULL,
  "meme_id" BIGINT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "comment_meme_attachments_pkey" PRIMARY KEY ("comment_id", "meme_id")
);

CREATE TABLE "meme_reports" (
  "id" BIGSERIAL NOT NULL,
  "meme_id" BIGINT NOT NULL,
  "reporter_id" BIGINT NOT NULL,
  "reason" "MemeReportReason" NOT NULL,
  "detail" TEXT,
  "status" "MemeReportStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "meme_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_point_pool" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "balance" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "public_point_pool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_point_pool_transactions" (
  "id" BIGSERIAL NOT NULL,
  "pool_id" INTEGER NOT NULL DEFAULT 1,
  "order_id" BIGINT NOT NULL,
  "amount" BIGINT NOT NULL,
  "balance_before" BIGINT NOT NULL,
  "balance_after" BIGINT NOT NULL,
  "tx_type" "PublicPointPoolTxType" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_point_pool_transactions_pkey" PRIMARY KEY ("id")
);

INSERT INTO "public_point_pool" ("id", "balance", "updated_at")
VALUES (1, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

CREATE UNIQUE INDEX "memes_storage_key_key" ON "memes"("storage_key");
CREATE INDEX "memes_status_created_at_idx" ON "memes"("status", "created_at" DESC);
CREATE INDEX "memes_creator_id_created_at_idx" ON "memes"("creator_id", "created_at" DESC);
CREATE INDEX "memes_sha256_idx" ON "memes"("sha256");
CREATE UNIQUE INDEX "meme_orders_idempotency_key_key" ON "meme_orders"("idempotency_key");
CREATE INDEX "meme_orders_meme_id_status_idx" ON "meme_orders"("meme_id", "status");
CREATE INDEX "topic_cases_meme_id_idx" ON "topic_cases"("meme_id");
CREATE INDEX "post_meme_attachments_meme_id_idx" ON "post_meme_attachments"("meme_id");
CREATE INDEX "comment_meme_attachments_meme_id_idx" ON "comment_meme_attachments"("meme_id");
CREATE UNIQUE INDEX "meme_reports_meme_id_reporter_id_key" ON "meme_reports"("meme_id", "reporter_id");
CREATE INDEX "meme_reports_status_created_at_idx" ON "meme_reports"("status", "created_at" DESC);
CREATE UNIQUE INDEX "public_point_pool_transactions_order_id_tx_type_key" ON "public_point_pool_transactions"("order_id", "tx_type");
CREATE INDEX "public_point_pool_transactions_pool_id_created_at_idx" ON "public_point_pool_transactions"("pool_id", "created_at" DESC);

ALTER TABLE "memes" ADD CONSTRAINT "memes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memes" ADD CONSTRAINT "memes_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memes" ADD CONSTRAINT "memes_taken_down_by_id_fkey" FOREIGN KEY ("taken_down_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meme_orders" ADD CONSTRAINT "meme_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meme_orders" ADD CONSTRAINT "meme_orders_meme_id_fkey" FOREIGN KEY ("meme_id") REFERENCES "memes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "topic_cases" ADD CONSTRAINT "topic_cases_meme_id_fkey" FOREIGN KEY ("meme_id") REFERENCES "memes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "post_meme_attachments" ADD CONSTRAINT "post_meme_attachments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_meme_attachments" ADD CONSTRAINT "post_meme_attachments_meme_id_fkey" FOREIGN KEY ("meme_id") REFERENCES "memes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comment_meme_attachments" ADD CONSTRAINT "comment_meme_attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_meme_attachments" ADD CONSTRAINT "comment_meme_attachments_meme_id_fkey" FOREIGN KEY ("meme_id") REFERENCES "memes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meme_reports" ADD CONSTRAINT "meme_reports_meme_id_fkey" FOREIGN KEY ("meme_id") REFERENCES "memes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meme_reports" ADD CONSTRAINT "meme_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public_point_pool_transactions" ADD CONSTRAINT "public_point_pool_transactions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public_point_pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public_point_pool_transactions" ADD CONSTRAINT "public_point_pool_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "meme_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "memes" ADD CONSTRAINT "memes_price_points_check" CHECK ("price_points" = 0 OR ("price_points" BETWEEN 10 AND 500 AND "price_points" % 10 = 0));
ALTER TABLE "memes" ADD CONSTRAINT "memes_metadata_check" CHECK ("byte_size" >= 0 AND "width" >= 0 AND "height" >= 0 AND "frame_count" >= 0 AND "duration_ms" >= 0);
ALTER TABLE "meme_orders" ADD CONSTRAINT "meme_orders_shares_check" CHECK ("paid_points" >= 0 AND "creator_share" >= 0 AND "burn_share" >= 0 AND "public_pool_share" >= 0 AND "creator_share" + "burn_share" + "public_pool_share" = "paid_points");
