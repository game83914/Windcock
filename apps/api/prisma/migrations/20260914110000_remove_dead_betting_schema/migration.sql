BEGIN;

-- Remove the V2 parimutuel betting schema and other retired enum values.
-- Guard: abort if any real data still references what is being removed.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "bets") THEN
    RAISE EXCEPTION 'Cannot remove betting schema while "bets" rows exist';
  END IF;
  IF EXISTS (SELECT 1 FROM "point_transactions" WHERE "tx_type" IN ('BET_PLACE', 'BET_WIN', 'BET_REFUND', 'MEME_USAGE_REVERSAL')) THEN
    RAISE EXCEPTION 'Cannot drop retired PointTxType values while ledger rows reference them';
  END IF;
  IF EXISTS (SELECT 1 FROM "meme_usage_events" WHERE "target_type" = 'TOPIC_BLOCK') THEN
    RAISE EXCEPTION 'Cannot drop TOPIC_BLOCK while meme usage rows reference it';
  END IF;
  IF EXISTS (SELECT 1 FROM "meme_usage_events" WHERE "reward_status" = 'REVERSED') THEN
    RAISE EXCEPTION 'Cannot drop REVERSED while meme usage rows reference it';
  END IF;
END $$;

-- Bet model removed (feature is deferred to V2).
DROP TABLE "bets";
DROP TYPE "BetStatus";

-- Drop betting-only columns on topics and topic_options.
ALTER TABLE "topics"
  DROP COLUMN "allow_betting",
  DROP COLUMN "platform_burn_rate",
  DROP COLUMN "bet_lock_at",
  DROP COLUMN "settled_option_id",
  DROP COLUMN "total_bet_pool";

ALTER TABLE "topic_options"
  DROP COLUMN "bet_points_pool";

-- Retire BET_* and MEME_USAGE_REVERSAL from PointTxType by recreating the type.
ALTER TYPE "PointTxType" RENAME TO "PointTxType_old";
CREATE TYPE "PointTxType" AS ENUM ('VOTE_REWARD', 'MEME_USAGE_REWARD');
ALTER TABLE "point_transactions" ALTER COLUMN "tx_type" TYPE "PointTxType" USING ("tx_type"::text::"PointTxType");
DROP TYPE "PointTxType_old";

-- Retire TOPIC_BLOCK from MemeUsageTargetType.
ALTER TYPE "MemeUsageTargetType" RENAME TO "MemeUsageTargetType_old";
CREATE TYPE "MemeUsageTargetType" AS ENUM ('POST', 'COMMENT');
ALTER TABLE "meme_usage_events" ALTER COLUMN "target_type" TYPE "MemeUsageTargetType" USING ("target_type"::text::"MemeUsageTargetType");
DROP TYPE "MemeUsageTargetType_old";

-- Retire REVERSED from MemeUsageRewardStatus.
ALTER TYPE "MemeUsageRewardStatus" RENAME TO "MemeUsageRewardStatus_old";
CREATE TYPE "MemeUsageRewardStatus" AS ENUM ('REWARDED', 'SELF_USE', 'OFFICIAL', 'DUPLICATE_DAILY_USE', 'ACTOR_DAILY_LIMIT', 'CREATOR_DAILY_LIMIT');
ALTER TABLE "meme_usage_events" ALTER COLUMN "reward_status" TYPE "MemeUsageRewardStatus" USING ("reward_status"::text::"MemeUsageRewardStatus");
DROP TYPE "MemeUsageRewardStatus_old";

COMMIT;