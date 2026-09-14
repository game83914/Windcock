ALTER TABLE "stance_applications" DROP CONSTRAINT "stance_applications_applicant_check";
ALTER TABLE "stance_applications" DROP CONSTRAINT "stance_applications_organization_id_fkey";
DROP INDEX "stance_applications_organization_id_status_created_at_idx";
ALTER TABLE "stance_applications" DROP COLUMN "applicant_type";
ALTER TABLE "stance_applications" DROP COLUMN "organization_id";
