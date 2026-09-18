-- Add email/password auth columns; relax phone_number to optional (unique kept: PG allows multiple NULLs).
ALTER TABLE "users" ADD COLUMN "email" TEXT;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "password_updated_at" TIMESTAMP(3);

ALTER TABLE "users" ALTER COLUMN "phone_number" DROP NOT NULL;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
