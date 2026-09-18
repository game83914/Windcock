-- 回合制快問（STAGED）：父層為回合容器，子題為各回合快問（沿用 parent_topic_id + sort_order）
ALTER TYPE "TopicKind" ADD VALUE 'STAGED';
ALTER TYPE "TopicType" ADD VALUE 'STAGED';

ALTER TABLE "topics" ADD COLUMN "total_rounds" INTEGER;
ALTER TABLE "topics" ADD COLUMN "round_feedback" TEXT;
