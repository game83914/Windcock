BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "meme_orders"
    WHERE "paid_points" <> 0 OR "creator_share" <> 0 OR "burn_share" <> 0 OR "public_pool_share" <> 0
  ) OR EXISTS (SELECT 1 FROM "public_point_pool_transactions")
    OR EXISTS (SELECT 1 FROM "public_point_pool" WHERE "balance" <> 0)
    OR EXISTS (
      SELECT 1 FROM "point_transactions"
      WHERE "tx_type" IN ('MEME_BUY', 'MEME_SELL', 'MEME_REFUND', 'MEME_SELL_REVERSAL')
    ) THEN
    RAISE EXCEPTION 'Cannot remove the GIF marketplace while non-zero financial history exists';
  END IF;
END $$;

DROP TABLE "public_point_pool_transactions";
DROP TABLE "public_point_pool";

DELETE FROM "meme_orders" WHERE "status" = 'REFUNDED';
ALTER TABLE "meme_orders" DROP CONSTRAINT IF EXISTS "meme_orders_shares_check";
DROP INDEX IF EXISTS "meme_orders_idempotency_key_key";
DROP INDEX IF EXISTS "meme_orders_meme_id_status_idx";
ALTER TABLE "meme_orders" DROP CONSTRAINT "meme_orders_user_id_fkey";
ALTER TABLE "meme_orders" DROP CONSTRAINT "meme_orders_meme_id_fkey";
ALTER TABLE "meme_orders"
  DROP COLUMN "paid_points",
  DROP COLUMN "creator_share",
  DROP COLUMN "burn_share",
  DROP COLUMN "public_pool_share",
  DROP COLUMN "status",
  DROP COLUMN "idempotency_key",
  DROP COLUMN "refunded_at",
  DROP COLUMN "refund_reason";
ALTER TABLE "meme_orders" RENAME TO "meme_collections";
ALTER TABLE "meme_collections" RENAME CONSTRAINT "meme_orders_pkey" TO "meme_collections_pkey";
ALTER INDEX "meme_orders_user_id_meme_id_key" RENAME TO "meme_collections_user_id_meme_id_key";
ALTER TABLE "meme_collections" ADD CONSTRAINT "meme_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meme_collections" ADD CONSTRAINT "meme_collections_meme_id_fkey" FOREIGN KEY ("meme_id") REFERENCES "memes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "meme_collections_meme_id_idx" ON "meme_collections"("meme_id");

ALTER TABLE "memes" DROP CONSTRAINT IF EXISTS "memes_price_points_check";
DROP INDEX IF EXISTS "memes_status_price_points_idx";
ALTER TABLE "memes" DROP COLUMN "price_points";
UPDATE "memes" SET "collection_count" = (
  SELECT COUNT(*) FROM "meme_collections" WHERE "meme_collections"."meme_id" = "memes"."id"
);

DROP TYPE "MemeOrderStatus";
DROP TYPE "PublicPointPoolTxType";

ALTER TYPE "PointTxType" RENAME TO "PointTxType_old";
CREATE TYPE "PointTxType" AS ENUM ('VOTE_REWARD', 'BET_PLACE', 'BET_WIN', 'BET_REFUND', 'MEME_USAGE_REWARD', 'MEME_USAGE_REVERSAL', 'ANALYTICS_UNLOCK');
ALTER TABLE "point_transactions" ALTER COLUMN "tx_type" TYPE "PointTxType" USING ("tx_type"::text::"PointTxType");
DROP TYPE "PointTxType_old";

COMMIT;
