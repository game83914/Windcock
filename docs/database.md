# 資料模型與 Migration

Schema：`apps/api/prisma/schema.prisma`（PostgreSQL，Prisma 6）。

## 核心資料表

- `topics`：議題本體。問卷子題以 `parent_topic_id`＋`sort_order` 自關聯；量表端點（`scale_min_label`／`scale_max_label`）、複選上限（`max_selections`）存於本表。
- `topic_options`：選項，`vote_count` 累計被選次數；`data`（JSON）放 `imageUrl`／`match`／`weight`／`value`。
- `votes`：每人每題一筆（`@@unique([userId, topicId])`），容納單一 `option_id`、`spectrum_value` 或 `answer_text`。
- `vote_selections`：複選關聯（`vote_id, option_id` 複合主鍵；vote cascade、option restrict）。
- `topic_rank_results`、`topic_content_blocks`、`topic_share_links`、`channel_follows`、`vote_demographic_snapshots` 等。

## 計數語意

- `topics.total_votes`／`voter_count`：作答人次／人數，複選一人只加 1。
- `topic_options.vote_count`：被選次數；複選題各選項百分比加總可超過 100%。

## Migration 流程（強制）

DB 存在既有 drift，**禁止** `prisma migrate dev` 與 `prisma migrate reset`：

```bash
# apps/api 底下執行
npx prisma db execute --file "prisma/migrations/<name>/migration.sql" --schema "prisma/schema.prisma"
npx prisma migrate resolve --applied <name>
npx prisma generate
```

部署環境一律使用：

```bash
npm run prisma:deploy -w apps/api   # = prisma migrate deploy
```

PostgreSQL enum 新增一律用 `ALTER TYPE ... ADD VALUE`，不可 rollback enum 值。
