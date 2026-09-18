-- 五點/七點量表合併為自訂點數量表 LIKERT（舊 LIKERT_5/LIKERT_7 保留停用）
-- 注意：PG 要求新 enum 值先提交才能使用，資料轉換放在下一個 migration
ALTER TYPE "TopicType" ADD VALUE 'LIKERT';

ALTER TABLE "topics" ADD COLUMN "scale_points" INTEGER;
