ALTER TABLE "memes"
  ALTER COLUMN "byte_size" DROP DEFAULT,
  ALTER COLUMN "width" DROP DEFAULT,
  ALTER COLUMN "height" DROP DEFAULT,
  ALTER COLUMN "frame_count" DROP DEFAULT,
  ALTER COLUMN "duration_ms" DROP DEFAULT,
  ALTER COLUMN "sha256" DROP DEFAULT,
  ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "meme_orders"
  ALTER COLUMN "creator_share" DROP DEFAULT,
  ALTER COLUMN "burn_share" DROP DEFAULT,
  ALTER COLUMN "public_pool_share" DROP DEFAULT;

ALTER TABLE "topic_cases"
  DROP CONSTRAINT IF EXISTS "topic_cases_gif_meme_check";

ALTER TABLE "topic_cases"
  ADD CONSTRAINT "topic_cases_gif_meme_check"
  CHECK (("block_type" = 'GIF' AND "meme_id" IS NOT NULL) OR ("block_type" <> 'GIF' AND "meme_id" IS NULL));
