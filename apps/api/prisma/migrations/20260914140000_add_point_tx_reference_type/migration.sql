-- Add structured referenceType to point_transactions
-- VOTE_REWARD referenceId "topicId:userId" → extract just topicId (userId already on row)
-- MEME_USAGE_REWARD referenceId unchanged (already a clean event ID)
BEGIN;

CREATE TYPE "PointTxReferenceType" AS ENUM ('VOTE', 'MEME_USAGE');

ALTER TABLE "point_transactions"
  ADD COLUMN "reference_type" "PointTxReferenceType";

UPDATE "point_transactions"
  SET "reference_type" = 'MEME_USAGE'
  WHERE "tx_type" = 'MEME_USAGE_REWARD';

UPDATE "point_transactions"
  SET "reference_type" = 'VOTE',
      "reference_id"  = split_part("reference_id", ':', 1)
  WHERE "tx_type" = 'VOTE_REWARD';

ALTER TABLE "point_transactions"
  ALTER COLUMN "reference_type" SET NOT NULL;

COMMIT;