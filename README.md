# 輿論測風向（Windcock）

一人一帳號、一人一票的即時公共議題民調平台。支援正式議題、快問投票（單選、圖片、光譜、簡答、連連看、拼圖、刮刮樂、轉盤、搖獎、評分、量表、複選）、多題組合問卷與回合制快問，另有發起草稿／自存範本與 JSON 匯入。

## 架構總覽

npm workspaces monorepo（Node 20）：

| 目錄 | 說明 |
|---|---|
| `apps/web` | Nuxt 3（SSR）前端，port 3000 |
| `apps/api` | NestJS 10 後端，port 3001，API 前綴 `/api/v1` |

詳細說明：`docs/architecture.md`

## 快速啟動

```bash
npm ci
npm run dev      # 同時啟動 API + Web（含本機 PostgreSQL / Redis）
```

- Web：http://localhost:3000
- API：http://localhost:3001/api/v1/health
- Swagger：http://localhost:3001/api/docs

## 常用指令

```bash
npm run build                    # 先 API，後 Web
npm run typecheck -w apps/web
npm run test -w apps/web         # Web vitest（發起頁工具函數等）
npm run build -w apps/api && npx jest src/topics --runInBand  # apps/api 底下執行
```

## 文件索引

- `docs/architecture.md` — 系統架構與模組劃分
- `docs/api.md` — 主要 API 端點
- `docs/database.md` — 資料模型與 migration 流程
- `docs/deployment.md` — 部署架構與環境變數
- `docs/development.md` — 本機開發、驗證與測試現況

## 注意事項

- Email 註冊 v1 只做格式＋唯一性檢查，不發驗證信；忘記密碼流程尚未提供。
- 手機為選填，不再要求綁定驗證即可使用。
- DB 有既有 drift 紀錄：禁止 `prisma migrate dev`／reset，流程見 `docs/database.md`。
