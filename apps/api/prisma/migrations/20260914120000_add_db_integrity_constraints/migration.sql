-- Add DB-level data integrity constraints
-- * votes: exactly one of option_id / spectrum_value; spectrum_value within [0, 100]
-- * non-negative counters across users / topics / topic_options / topic_stances / posts / memes
-- * memes: rewarded_use_count must not exceed usage_count
-- * topics.category must reference an existing categories.key
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "votes" WHERE ("option_id" IS NOT NULL) = ("spectrum_value" IS NOT NULL)) THEN
    RAISE EXCEPTION 'Cannot add ck_votes_choice_excluded_middle_check: some votes have both or neither of option_id/spectrum_value';
  END IF;

  IF EXISTS (SELECT 1 FROM "votes" WHERE "spectrum_value" IS NOT NULL AND ("spectrum_value" < 0 OR "spectrum_value" > 100)) THEN
    RAISE EXCEPTION 'Cannot add ck_votes_spectrum_range_check: some spectrum votes fall outside [0, 100]';
  END IF;

  IF EXISTS (SELECT 1 FROM "users" WHERE "points_balance" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_users_points_balance_nonneg_check: some users have negative points_balance';
  END IF;

  IF EXISTS (SELECT 1 FROM "topics" WHERE "total_votes" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_topics_total_votes_nonneg_check: some topics have negative total_votes';
  END IF;

  IF EXISTS (SELECT 1 FROM "topics" WHERE "voter_count" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_topics_voter_count_nonneg_check: some topics have negative voter_count';
  END IF;

  IF EXISTS (SELECT 1 FROM "topic_options" WHERE "vote_count" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_topic_options_vote_count_nonneg_check: some topic_options have negative vote_count';
  END IF;

  IF EXISTS (SELECT 1 FROM "topic_stances" WHERE "agreement_count" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_topic_stances_agreement_count_nonneg_check: some topic_stances have negative agreement_count';
  END IF;

  IF EXISTS (SELECT 1 FROM "topic_stances" WHERE "disagreement_count" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_topic_stances_disagreement_count_nonneg_check: some topic_stances have negative disagreement_count';
  END IF;

  IF EXISTS (SELECT 1 FROM "posts" WHERE "like_count" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_posts_like_count_nonneg_check: some posts have negative like_count';
  END IF;

  IF EXISTS (SELECT 1 FROM "memes" WHERE "collection_count" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_memes_collection_count_nonneg_check: some memes have negative collection_count';
  END IF;

  IF EXISTS (SELECT 1 FROM "memes" WHERE "usage_count" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_memes_usage_count_nonneg_check: some memes have negative usage_count';
  END IF;

  IF EXISTS (SELECT 1 FROM "memes" WHERE "rewarded_use_count" < 0) THEN
    RAISE EXCEPTION 'Cannot add ck_memes_rewarded_use_count_nonneg_check: some memes have negative rewarded_use_count';
  END IF;

  IF EXISTS (SELECT 1 FROM "memes" WHERE "rewarded_use_count" > "usage_count") THEN
    RAISE EXCEPTION 'Cannot add ck_memes_rewarded_use_within_usage_check: some memes have rewarded_use_count > usage_count';
  END IF;

  IF EXISTS (SELECT 1 FROM "topics" t LEFT JOIN "categories" c ON c."key" = t."category" WHERE c."key" IS NULL) THEN
    RAISE EXCEPTION 'Cannot add topics_category_fkey: some topics reference a missing category';
  END IF;
END $$;

ALTER TABLE "votes"
  ADD CONSTRAINT "votes_choice_excluded_middle_check"
  CHECK (
    ("option_id" IS NOT NULL AND "spectrum_value" IS NULL)
    OR ("option_id" IS NULL AND "spectrum_value" IS NOT NULL)
  );

ALTER TABLE "votes"
  ADD CONSTRAINT "votes_spectrum_range_check"
  CHECK ("spectrum_value" IS NULL OR ("spectrum_value" >= 0 AND "spectrum_value" <= 100));

ALTER TABLE "users"
  ADD CONSTRAINT "users_points_balance_nonneg_check"
  CHECK ("points_balance" >= 0);

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_total_votes_nonneg_check"
  CHECK ("total_votes" >= 0);

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_voter_count_nonneg_check"
  CHECK ("voter_count" >= 0);

ALTER TABLE "topic_options"
  ADD CONSTRAINT "topic_options_vote_count_nonneg_check"
  CHECK ("vote_count" >= 0);

ALTER TABLE "topic_stances"
  ADD CONSTRAINT "topic_stances_agreement_count_nonneg_check"
  CHECK ("agreement_count" >= 0);

ALTER TABLE "topic_stances"
  ADD CONSTRAINT "topic_stances_disagreement_count_nonneg_check"
  CHECK ("disagreement_count" >= 0);

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_like_count_nonneg_check"
  CHECK ("like_count" >= 0);

ALTER TABLE "memes"
  ADD CONSTRAINT "memes_collection_count_nonneg_check"
  CHECK ("collection_count" >= 0);

ALTER TABLE "memes"
  ADD CONSTRAINT "memes_usage_count_nonneg_check"
  CHECK ("usage_count" >= 0);

ALTER TABLE "memes"
  ADD CONSTRAINT "memes_rewarded_use_count_nonneg_check"
  CHECK ("rewarded_use_count" >= 0);

ALTER TABLE "memes"
  ADD CONSTRAINT "memes_rewarded_use_within_usage_check"
  CHECK ("rewarded_use_count" <= "usage_count");

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_category_fkey"
  FOREIGN KEY ("category") REFERENCES "categories"("key") ON UPDATE CASCADE ON DELETE RESTRICT;

COMMIT;