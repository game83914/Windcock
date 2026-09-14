-- Remove the topic revision (series/supersede) mechanism.
-- Published topics are now immutable; no new revisions, no re-vote flow.

DROP INDEX IF EXISTS "topics_series_root_id_revision_number_idx";
DROP INDEX IF EXISTS "topics_supersedes_id_idx";
ALTER TABLE "topics" DROP COLUMN IF EXISTS "series_root_id";
ALTER TABLE "topics" DROP COLUMN IF EXISTS "revision_number";
ALTER TABLE "topics" DROP COLUMN IF EXISTS "supersedes_id";