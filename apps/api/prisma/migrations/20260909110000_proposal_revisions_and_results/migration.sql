ALTER TABLE "topic_applications" ADD COLUMN "revision_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "stance_applications" ADD COLUMN "revision_number" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "topic_application_revisions" (
  "id" BIGSERIAL NOT NULL,
  "application_id" BIGINT NOT NULL,
  "revision_number" INTEGER NOT NULL,
  "status" "TopicApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "topic_type" "TopicType" NOT NULL,
  "options" JSONB,
  "blocks" JSONB,
  "vote_duration_days" INTEGER NOT NULL,
  "note" TEXT,
  "review_note" TEXT,
  "reviewed_by_id" BIGINT,
  "reviewed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "topic_application_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stance_application_revisions" (
  "id" BIGSERIAL NOT NULL,
  "application_id" BIGINT NOT NULL,
  "revision_number" INTEGER NOT NULL,
  "status" "TopicApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "rationale" TEXT,
  "note" TEXT,
  "review_note" TEXT,
  "reviewed_by_id" BIGINT,
  "reviewed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stance_application_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "topic_application_results" (
  "application_id" BIGINT NOT NULL,
  "topic_id" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "topic_application_results_pkey" PRIMARY KEY ("application_id", "topic_id")
);

CREATE TABLE "stance_application_results" (
  "application_id" BIGINT NOT NULL,
  "stance_id" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stance_application_results_pkey" PRIMARY KEY ("application_id", "stance_id")
);

INSERT INTO "topic_application_revisions" ("application_id", "revision_number", "status", "title", "description", "category", "topic_type", "options", "blocks", "vote_duration_days", "note", "created_at", "updated_at")
SELECT "id", 1, "status", "title", "description", "category", "topic_type", "options", "blocks", "vote_duration_days", "note", "created_at", "updated_at" FROM "topic_applications";

INSERT INTO "stance_application_revisions" ("application_id", "revision_number", "status", "title", "rationale", "note", "review_note", "reviewed_by_id", "reviewed_at", "created_at", "updated_at")
SELECT "id", 1, "status", "title", "rationale", "note", "review_note", "reviewed_by_id", "reviewed_at", "created_at", "updated_at" FROM "stance_applications";

INSERT INTO "topic_application_results" ("application_id", "topic_id")
SELECT "id", "resulting_topic_id" FROM "topic_applications" WHERE "resulting_topic_id" IS NOT NULL;

INSERT INTO "stance_application_results" ("application_id", "stance_id")
SELECT "id", "resulting_stance_id" FROM "stance_applications" WHERE "resulting_stance_id" IS NOT NULL;

ALTER TABLE "topic_applications" DROP CONSTRAINT "topic_applications_resulting_topic_id_fkey";
DROP INDEX "topic_applications_resulting_topic_id_key";
ALTER TABLE "topic_applications" DROP COLUMN "resulting_topic_id";
ALTER TABLE "stance_applications" DROP CONSTRAINT "stance_applications_resulting_stance_id_fkey";
DROP INDEX "stance_applications_resulting_stance_id_key";
ALTER TABLE "stance_applications" DROP COLUMN "resulting_stance_id";

CREATE UNIQUE INDEX "topic_application_revisions_application_id_revision_number_key" ON "topic_application_revisions"("application_id", "revision_number");
CREATE INDEX "topic_application_results_topic_id_idx" ON "topic_application_results"("topic_id");
CREATE UNIQUE INDEX "stance_application_revisions_application_id_revision_number_key" ON "stance_application_revisions"("application_id", "revision_number");
CREATE INDEX "stance_application_results_stance_id_idx" ON "stance_application_results"("stance_id");

ALTER TABLE "topic_application_revisions" ADD CONSTRAINT "topic_application_revisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "topic_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_application_revisions" ADD CONSTRAINT "topic_application_revisions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stance_application_revisions" ADD CONSTRAINT "stance_application_revisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "stance_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stance_application_revisions" ADD CONSTRAINT "stance_application_revisions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "topic_application_results" ADD CONSTRAINT "topic_application_results_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "topic_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_application_results" ADD CONSTRAINT "topic_application_results_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stance_application_results" ADD CONSTRAINT "stance_application_results_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "stance_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stance_application_results" ADD CONSTRAINT "stance_application_results_stance_id_fkey" FOREIGN KEY ("stance_id") REFERENCES "topic_stances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
