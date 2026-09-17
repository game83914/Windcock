ALTER TYPE "TopicType" ADD VALUE 'STAR_RATING';
ALTER TYPE "TopicType" ADD VALUE 'LIKERT_5';
ALTER TYPE "TopicType" ADD VALUE 'LIKERT_7';
ALTER TYPE "TopicType" ADD VALUE 'MULTI_SELECT';

ALTER TABLE "topics"
  ADD COLUMN "scale_min_label" TEXT,
  ADD COLUMN "scale_max_label" TEXT,
  ADD COLUMN "max_selections" INTEGER;

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_max_selections_positive_check"
  CHECK ("max_selections" IS NULL OR "max_selections" > 0);

CREATE TABLE "vote_selections" (
  "vote_id" BIGINT NOT NULL,
  "option_id" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vote_selections_pkey" PRIMARY KEY ("vote_id", "option_id")
);

CREATE INDEX "vote_selections_option_id_idx" ON "vote_selections"("option_id");

ALTER TABLE "vote_selections"
  ADD CONSTRAINT "vote_selections_vote_id_fkey"
  FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vote_selections"
  ADD CONSTRAINT "vote_selections_option_id_fkey"
  FOREIGN KEY ("option_id") REFERENCES "topic_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "votes" DROP CONSTRAINT IF EXISTS "votes_choice_excluded_middle_check";
ALTER TABLE "votes"
  ADD CONSTRAINT "votes_choice_excluded_middle_check"
  CHECK (
    (("option_id" IS NOT NULL)::int + ("spectrum_value" IS NOT NULL)::int + ("answer_text" IS NOT NULL)::int) <= 1
  );
