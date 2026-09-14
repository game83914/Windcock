DROP INDEX "role_assignments_global_key";
DROP INDEX "role_assignments_organization_key";
DROP INDEX "role_assignments_topic_key";

DELETE FROM "role_assignments"
WHERE "role" IN ('CONTENT_MODERATOR', 'ADMIN');

ALTER TYPE "AssignmentRole" RENAME TO "AssignmentRole_old";
CREATE TYPE "AssignmentRole" AS ENUM ('TOPIC_TEAM');
ALTER TABLE "role_assignments" ALTER COLUMN "role" TYPE "AssignmentRole"
USING (
  CASE
    WHEN "role"::text IN ('TOPIC_RESEARCHER', 'TOPIC_EDITOR', 'TOPIC_PUBLISHER') THEN 'TOPIC_TEAM'
  END
)::"AssignmentRole";
DROP TYPE "AssignmentRole_old";

WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "user_id", "scope", "organization_id", "topic_id"
    ORDER BY "active" DESC, "expires_at" DESC NULLS FIRST, "created_at", "id"
  ) AS position
  FROM "role_assignments"
)
DELETE FROM "role_assignments"
WHERE "id" IN (SELECT "id" FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX "role_assignments_global_key" ON "role_assignments"("user_id", "role") WHERE "scope" = 'GLOBAL';
CREATE UNIQUE INDEX "role_assignments_organization_key" ON "role_assignments"("user_id", "role", "organization_id") WHERE "scope" = 'ORGANIZATION';
CREATE UNIQUE INDEX "role_assignments_topic_key" ON "role_assignments"("user_id", "role", "topic_id") WHERE "scope" = 'TOPIC';

UPDATE "users" SET "role" = 'USER' WHERE "role" = 'MODERATOR';
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
DROP TYPE "UserRole_old";
