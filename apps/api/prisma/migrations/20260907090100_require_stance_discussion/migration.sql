ALTER TABLE "topic_stances"
  ADD COLUMN "disagreement_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "topic_stances" AS stance
SET "disagreement_count" = (
  SELECT COUNT(*)::INTEGER
  FROM "topic_stance_signals" AS signal
  WHERE signal."stance_id" = stance."id" AND signal."signal" = 'DISAGREE'
);

DELETE FROM "likes"
WHERE "target_type" = 'comment'
  AND "target_id" IN (
    SELECT comment."id"
    FROM "comments" AS comment
    JOIN "posts" AS post ON post."id" = comment."post_id"
    WHERE post."stance_id" IS NULL
  );

DELETE FROM "likes"
WHERE "target_type" = 'post'
  AND "target_id" IN (SELECT "id" FROM "posts" WHERE "stance_id" IS NULL);

DELETE FROM "posts" WHERE "stance_id" IS NULL;

ALTER TABLE "posts" ALTER COLUMN "stance_id" SET NOT NULL;

ALTER TABLE "posts" DROP CONSTRAINT "posts_stance_id_fkey";
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_stance_id_fkey"
  FOREIGN KEY ("stance_id") REFERENCES "topic_stances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "topic_stance_signals_one_polar_signal_per_user"
ON "topic_stance_signals"("stance_id", "user_id")
WHERE "signal" IN ('AGREE', 'DISAGREE');
