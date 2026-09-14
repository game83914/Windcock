-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('NEW', 'SENIOR');
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "OrganizationMembershipRole" AS ENUM ('MEMBER', 'MANAGER', 'OWNER');
CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AssignmentRole" AS ENUM ('TOPIC_RESEARCHER', 'TOPIC_EDITOR', 'TOPIC_PUBLISHER', 'CONTENT_MODERATOR', 'ADMIN');
CREATE TYPE "AssignmentScope" AS ENUM ('GLOBAL', 'ORGANIZATION', 'TOPIC');
CREATE TYPE "TopicApplicationApplicantType" AS ENUM ('MEMBER', 'ORGANIZATION');
CREATE TYPE "TopicApplicationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "membership_tier" "MembershipTier" NOT NULL DEFAULT 'NEW';
ALTER TABLE "topics" ADD COLUMN "parent_topic_id" BIGINT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_partner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_memberships" (
    "organization_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" "OrganizationMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("organization_id", "user_id")
);

CREATE TABLE "role_assignments" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" "AssignmentRole" NOT NULL,
    "scope" "AssignmentScope" NOT NULL DEFAULT 'GLOBAL',
    "organization_id" BIGINT,
    "topic_id" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "granted_by_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "role_assignment_scope_check" CHECK (
      ("scope" = 'GLOBAL' AND "organization_id" IS NULL AND "topic_id" IS NULL) OR
      ("scope" = 'ORGANIZATION' AND "organization_id" IS NOT NULL AND "topic_id" IS NULL) OR
      ("scope" = 'TOPIC' AND "organization_id" IS NULL AND "topic_id" IS NOT NULL)
    )
);

CREATE TABLE "topic_applications" (
    "id" BIGSERIAL NOT NULL,
    "applicant_type" "TopicApplicationApplicantType" NOT NULL,
    "status" "TopicApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "submitter_id" BIGINT NOT NULL,
    "organization_id" BIGINT,
    "parent_topic_id" BIGINT,
    "resulting_topic_id" BIGINT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "topic_type" "TopicType" NOT NULL,
    "options" JSONB,
    "blocks" JSONB,
    "vote_duration_days" INTEGER NOT NULL DEFAULT 7,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "topic_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "topic_application_applicant_check" CHECK (
      ("applicant_type" = 'MEMBER' AND "organization_id" IS NULL) OR
      ("applicant_type" = 'ORGANIZATION' AND "organization_id" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_status_is_partner_idx" ON "organizations"("status", "is_partner");
CREATE INDEX "organization_memberships_user_id_status_idx" ON "organization_memberships"("user_id", "status");
CREATE INDEX "role_assignments_user_id_active_expires_at_idx" ON "role_assignments"("user_id", "active", "expires_at");
CREATE INDEX "role_assignments_organization_id_idx" ON "role_assignments"("organization_id");
CREATE INDEX "role_assignments_topic_id_idx" ON "role_assignments"("topic_id");
CREATE UNIQUE INDEX "role_assignments_global_key" ON "role_assignments"("user_id", "role") WHERE "scope" = 'GLOBAL';
CREATE UNIQUE INDEX "role_assignments_organization_key" ON "role_assignments"("user_id", "role", "organization_id") WHERE "scope" = 'ORGANIZATION';
CREATE UNIQUE INDEX "role_assignments_topic_key" ON "role_assignments"("user_id", "role", "topic_id") WHERE "scope" = 'TOPIC';
CREATE UNIQUE INDEX "topic_applications_resulting_topic_id_key" ON "topic_applications"("resulting_topic_id");
CREATE INDEX "topic_applications_status_created_at_idx" ON "topic_applications"("status", "created_at" DESC);
CREATE INDEX "topic_applications_submitter_id_created_at_idx" ON "topic_applications"("submitter_id", "created_at" DESC);
CREATE INDEX "topic_applications_organization_id_status_created_at_idx" ON "topic_applications"("organization_id", "status", "created_at" DESC);
CREATE INDEX "topics_parent_topic_id_idx" ON "topics"("parent_topic_id");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "topic_applications" ADD CONSTRAINT "topic_applications_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "topic_applications" ADD CONSTRAINT "topic_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "topic_applications" ADD CONSTRAINT "topic_applications_parent_topic_id_fkey" FOREIGN KEY ("parent_topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "topic_applications" ADD CONSTRAINT "topic_applications_resulting_topic_id_fkey" FOREIGN KEY ("resulting_topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_topic_id_fkey" FOREIGN KEY ("parent_topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_topic_not_self_check" CHECK ("parent_topic_id" IS NULL OR "parent_topic_id" <> "id");
