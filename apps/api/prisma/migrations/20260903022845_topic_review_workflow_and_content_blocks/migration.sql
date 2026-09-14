-- CreateEnum
CREATE TYPE "TopicContentBlockType" AS ENUM ('BACKGROUND', 'CASE', 'DATA', 'SOURCE', 'PERSPECTIVES');

-- AlterTable
ALTER TABLE "topic_cases" ADD COLUMN     "block_type" "TopicContentBlockType" NOT NULL DEFAULT 'CASE';

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "vote_duration_days" INTEGER NOT NULL DEFAULT 7,
ALTER COLUMN "vote_end_at" DROP NOT NULL;
