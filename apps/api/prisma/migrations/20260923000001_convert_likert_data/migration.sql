-- 將既有五點/七點量表轉為 LIKERT（enum 值需先提交，本檔獨立一個 migration）
UPDATE "topics" SET "topic_type" = 'LIKERT', "scale_points" = 5 WHERE "topic_type" = 'LIKERT_5';
UPDATE "topics" SET "topic_type" = 'LIKERT', "scale_points" = 7 WHERE "topic_type" = 'LIKERT_7';
