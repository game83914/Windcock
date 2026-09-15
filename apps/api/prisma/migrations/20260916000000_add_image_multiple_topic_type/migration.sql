-- AddImageMultipleTopicType
-- 圖片選項題：每個選項需附圖片（圖下方可帶說明文字），先於 enum 尾端新增以相容既有資料

ALTER TYPE "TopicType" ADD VALUE IF NOT EXISTS 'IMAGE_MULTIPLE';