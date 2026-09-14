BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "topic_analytics_unlocks")
    OR EXISTS (SELECT 1 FROM "analytics_entitlements")
    OR EXISTS (SELECT 1 FROM "analytics_access_audits")
    OR EXISTS (SELECT 1 FROM "point_transactions" WHERE "tx_type" = 'ANALYTICS_UNLOCK') THEN
    RAISE EXCEPTION 'Cannot remove paid analytics tables while entitlement or unlock history exists';
  END IF;
END $$;

DROP TABLE "analytics_access_audits";
DROP TABLE "analytics_entitlements";
DROP TABLE "topic_analytics_unlocks";
DROP TYPE "AnalyticsEntitlementFeature";
DROP TYPE "AnalyticsModule";

ALTER TYPE "PointTxType" RENAME TO "PointTxType_old";
CREATE TYPE "PointTxType" AS ENUM ('VOTE_REWARD', 'BET_PLACE', 'BET_WIN', 'BET_REFUND', 'MEME_USAGE_REWARD', 'MEME_USAGE_REVERSAL');
ALTER TABLE "point_transactions" ALTER COLUMN "tx_type" TYPE "PointTxType" USING ("tx_type"::text::"PointTxType");
DROP TYPE "PointTxType_old";

COMMIT;
