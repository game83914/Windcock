ALTER TABLE "stance_applications" DROP CONSTRAINT "stance_applications_parent_stance_id_fkey";
ALTER TABLE "stance_applications" ADD CONSTRAINT "stance_applications_parent_stance_id_fkey" FOREIGN KEY ("parent_stance_id") REFERENCES "topic_stances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stance_applications" ADD CONSTRAINT "stance_applications_applicant_check" CHECK (
  ("applicant_type" = 'MEMBER' AND "organization_id" IS NULL)
  OR ("applicant_type" = 'ORGANIZATION' AND "organization_id" IS NOT NULL)
);
