# 本機開發

## 啟動

```bash
npm ci
npm run dev        # API（:3001，含本機 DB/Redis）＋ Web（:3000）
```

本機 DB：`postgresql://windcock:windcock@localhost:5432/windcock`（見 `apps/api/.env.example`），由 `scripts/devdb.sh` 啟動。

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

- 全量 API suite：22 suites／124 tests 全過（`src/topics` 佔 10 suites／54 tests）。
- 全量 API suite 應全數通過；CI（`.github/workflows/ci.yml`，跑全量 `npm run test`）紅燈時優先處理，不得直接合併。
- Web 以 vitest 覆蓋純函數（`utils/questionBuilder`、`utils/topic`），元件以 `typecheck`＋`build` 驗證。

## 工作區規範

- 大量未提交變更時不得回退非本次檔案；commit 前檢查 `git status`、`git diff`。
- 不更新 git config、不 force-push、不略過 hooks。
- 不得提交 secrets（`.env` 已 ignore）。
