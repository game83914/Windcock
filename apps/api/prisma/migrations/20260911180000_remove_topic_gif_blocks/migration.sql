-- GIF remains available in discussions, but is no longer a topic content block.
ALTER TABLE "topic_cases"
  DROP CONSTRAINT IF EXISTS "topic_cases_gif_meme_check";

DELETE FROM "topic_cases"
WHERE "block_type" = 'GIF';

ALTER TABLE "topic_cases"
  DROP CONSTRAINT IF EXISTS "topic_cases_meme_id_fkey";

DROP INDEX IF EXISTS "topic_cases_meme_id_idx";

ALTER TABLE "topic_cases"
  DROP COLUMN "meme_id",
  ALTER COLUMN "block_type" DROP DEFAULT;

ALTER TYPE "TopicContentBlockType" RENAME TO "TopicContentBlockType_old";
CREATE TYPE "TopicContentBlockType" AS ENUM ('BACKGROUND', 'CASE', 'DATA', 'SOURCE', 'PERSPECTIVES');

ALTER TABLE "topic_cases"
  ALTER COLUMN "block_type" TYPE "TopicContentBlockType"
  USING ("block_type"::text::"TopicContentBlockType"),
  ALTER COLUMN "block_type" SET DEFAULT 'CASE';

DROP TYPE "TopicContentBlockType_old";
