# 本機開發

## 啟動

```bash
npm ci
npm run dev        # API（:3001，含本機 DB/Redis）＋ Web（:3000）
```

本機 DB：`postgresql://windcock:windcock@localhost:5432/windcock`（見 `apps/api/.env.example`），由 `scripts/devdb.sh` 啟動。

需要完整展示資料時可明確執行開發專用 seed；它會建立固定管理員、測試議題、示範組織與 GIF，不得用於正式部署：

```bash
ALLOW_DEMO_SEED=true npm run prisma:seed:demo
```

## 驗證指令

```bash
# API（apps/api 底下）
npm run build
npx jest src/topics --runInBand

# Web（apps/web 底下）
npm run typecheck
npm run build

# repo 根
git diff --check
```

## 測試現況

- 全量 API suite：30 suites／185 tests 全過（topics、authoring、drafts 皆含）。
- 全量 API suite 應全數通過；CI（`.github/workflows/ci.yml`，跑全量 `npm run test`＋Web 測試＋雙鏡像建置）紅燈時優先處理，不得直接合併。
- Web 以 vitest 覆蓋純函數（`utils/questionBuilder`、`utils/topic`、`utils/quickImport`、`utils/draftSerializer`、`utils/format`，共 5 檔／41 tests），元件以 `typecheck`＋`build` 驗證。

## AI 開發內容 CLI（`apps/api` 底下）

開發初期用 AI 產生假資料（正式議題、快問、問卷）。需先在 `.env` 設定 `AI_AUTHORING_ENABLED=true`、`OPENAI_API_KEY`、`OPENAI_MODEL`。

```bash
# 預覽：只產生 JSON，不寫入 DB（stdout 為機器可讀的結果摘要）
npm run ai:dev-content -- --kind quick,survey --count 3 --brief "通勤與午餐" --out /tmp/ai-quick.json

# 確認 JSON 無誤後寫入開發 DB（掛名 admin@windcock.local，需已存在）
npm run ai:dev-content -- --kind quick --count 3 --out /tmp/ai-quick.json --apply

# AI agent 呼叫範例：解析 stdout JSON 的 ok / generated / written / skipped 欄位接續處理
npm run ai:dev-content -- --kind formal --count 5 --out /tmp/ai-formal.json --apply --email admin@windcock.local
```

參數：`--kind formal|quick|survey`（可重複或逗號分隔）、`--count 1~10`（每種筆數）、`--brief`、`--out`、`--apply`、`--email`、`--help`。production 環境拒絕執行；標題已存在會跳過並列在 `skipped`。

## 工作區規範

- 大量未提交變更時不得回退非本次檔案；commit 前檢查 `git status`、`git diff`。
- 不更新 git config、不 force-push、不略過 hooks。
- 不得提交 secrets（`.env` 已 ignore）。
