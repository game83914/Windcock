-- AddCategoryAndFeatured

-- CreateTable
CREATE TABLE "categories" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "soft" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("key")
);

-- AlterTable
ALTER TABLE "topics" ADD COLUMN "featured_order" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "topics_featured_order_key" ON "topics"("featured_order");

-- SeedCategories
INSERT INTO "categories" ("key", "label", "eyebrow", "color", "soft", "sort_order", "is_active", "created_at", "updated_at") VALUES
('politics', '政治', '治理與政策', '#9c3b3b', '#f6e7e7', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('society', '社會', '公共生活', '#37639c', '#e7eff6', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('life', '生活', '生活選擇', '#3f7a58', '#e5f1e9', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('technology', '科技', '科技與數位', '#7a5cbf', '#efeafb', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('entertainment', '娛樂', '娛樂與文化', '#b0761f', '#f8f0e3', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- MapTopicsToCategoryKeys
UPDATE "topics" SET "category" = 'politics' WHERE "category" = '政治';
UPDATE "topics" SET "category" = 'society' WHERE "category" = '社會';
UPDATE "topics" SET "category" = 'life' WHERE "category" = '生活';
UPDATE "topics" SET "category" = 'technology' WHERE "category" = '科技';
UPDATE "topics" SET "category" = 'entertainment' WHERE "category" = '娛樂';