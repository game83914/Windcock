-- Remove the unused derived-topic hierarchy. No derived topics or applications existed at migration time.
ALTER TABLE "topic_applications" DROP CONSTRAINT "topic_applications_parent_topic_id_fkey";
ALTER TABLE "topics" DROP CONSTRAINT "topics_parent_topic_id_fkey";
ALTER TABLE "topics" DROP CONSTRAINT "topics_parent_topic_not_self_check";
DROP INDEX "topics_parent_topic_id_idx";
ALTER TABLE "topic_applications" DROP COLUMN "parent_topic_id";
ALTER TABLE "topics" DROP COLUMN "parent_topic_id";

CREATE TABLE "stance_applications" (
    "id" BIGSERIAL NOT NULL,
    "applicant_type" "TopicApplicationApplicantType" NOT NULL,
    "status" "TopicApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "submitter_id" BIGINT NOT NULL,
    "organization_id" BIGINT,
    "topic_id" BIGINT NOT NULL,
    "parent_stance_id" BIGINT,
    "resulting_stance_id" BIGINT,
    "title" TEXT NOT NULL,
    "rationale" TEXT,
    "note" TEXT,
    "review_note" TEXT,
    "reviewed_by_id" BIGINT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stance_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stance_applications_resulting_stance_id_key" ON "stance_applications"("resulting_stance_id");
CREATE INDEX "stance_applications_status_created_at_idx" ON "stance_applications"("status", "created_at" DESC);
CREATE INDEX "stance_applications_submitter_id_created_at_idx" ON "stance_applications"("submitter_id", "created_at" DESC);
CREATE INDEX "stance_applications_organization_id_status_created_at_idx" ON "stance_applications"("organization_id", "status", "created_at" DESC);
CREATE INDEX "stance_applications_topic_id_status_created_at_idx" ON "stance_applications"("topic_id", "status", "created_at" DESC);
CREATE INDEX "stance_applications_parent_stance_id_idx" ON "stance_applications"("parent_stance_id");

ALTER TABLE "stance_applications" ADD CONSTRAINT "stance_applications_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stance_applications" ADD CONSTRAINT "stance_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stance_applications" ADD CONSTRAINT "stance_applications_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stance_applications" ADD CONSTRAINT "stance_applications_parent_stance_id_fkey" FOREIGN KEY ("parent_stance_id") REFERENCES "topic_stances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stance_applications" ADD CONSTRAINT "stance_applications_resulting_stance_id_fkey" FOREIGN KEY ("resulting_stance_id") REFERENCES "topic_stances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stance_applications" ADD CONSTRAINT "stance_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
