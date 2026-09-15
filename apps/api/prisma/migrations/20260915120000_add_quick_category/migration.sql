-- AddQuickCategory
-- 快問不再使用生活分類，統一歸入「快問」分類。

INSERT INTO "categories" ("key", "label", "eyebrow", "color", "soft", "sort_order", "is_active", "created_at", "updated_at") VALUES
('quick', '快問', 'UGC 微投票', '#b0761f', '#f8ecd6', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "eyebrow" = EXCLUDED."eyebrow",
  "color" = EXCLUDED."color",
  "soft" = EXCLUDED."soft",
  "sort_order" = EXCLUDED."sort_order",
  "is_active" = true;

-- 既有快問全部回填到「快問」分類
UPDATE "topics" SET "category" = 'quick' WHERE "kind" = 'QUICK';