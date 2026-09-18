# 部署

## 建議架構（Zeabur，免費免綁卡）

| 元件 | 服務 | 說明 |
|---|---|---|
| Nuxt Web | Zeabur 服務（`apps/web/Dockerfile`） | SSR，Node 20 |
| NestJS API＋Socket.IO | Zeabur 服務（`apps/api/Dockerfile`），**固定單一 replica** | 長駐 process，WebSocket rooms 在記憶體 |
| PostgreSQL | Zeabur 一鍵資料庫模板 | 服務間變數引用 |
| Redis | Zeabur 一鍵資料庫模板 | 內網 host／port（現有 client 即可） |
| 媒體檔 | API 服務掛 volume → `MEDIA_ROOT` | 重啟不遺失 |

API 不適合 serverless（Vercel Functions）：長駐 `app.listen()`、Socket.IO process-local rooms、本機磁碟媒體、process-local timers／queues。

免費版限制：服務閒置會自動休眠（喚醒慢幾秒）；無自動資料庫備份；日誌保留 48 小時。需不休眠／備份時升級 Dev（$5/月）。

## Zeabur 部署步驟

1. 建專案，綁定 GitHub repo；一鍵新增 PostgreSQL、Redis。
2. 新增 API 服務：build context 設為 repo 根，Dockerfile 路徑填 `apps/api/Dockerfile`，掛 volume 到 `MEDIA_ROOT`（如 `/data/media`）。
3. 新增 Web 服務：build context 設為 repo 根，Dockerfile 路徑填 `apps/web/Dockerfile`。
4. 設定環境變數（下表），兩服務皆需對應值。
5. 部署前在本機對遠端 DB 執行 migration（失敗則擋 release）：
   ```bash
   DATABASE_URL="<Zeabur PG 公網連線字串>" npm run prisma:deploy -w apps/api
   ```
6. 部署 API → 驗證 `GET /api/v1/health` → 部署 Web → 驗收註冊登入、投票即時更新、圖片顯示。

## 手動部署步驟（通用）

```bash
# API
npm ci
npm run build -w apps/api
npm run prisma:deploy -w apps/api   # pre-deploy 單獨執行，失敗則擋 release
npm run start:prod -w apps/api      # = node dist/main.js
# 健康檢查：GET /api/v1/health
```

```bash
# Web（Vercel）
npm ci
npm run build -w apps/web
```

## 環境變數

Web：

```text
NUXT_PUBLIC_API_BASE=https://api.example.com/api/v1
NUXT_PUBLIC_WS_BASE=https://api.example.com
```

API（核心）：

```text
NODE_ENV=production
PORT=                                                        # 平台注入
DATABASE_URL=
JWT_SECRET=                                                  # 高熵，必填
JWT_EXPIRES_IN=
CORS_ORIGINS=https://www.example.com
REDIS_HOST=
REDIS_PORT=
PROFILE_ENCRYPTION_KEY=                                      # 32 bytes Base64，缺少無法啟動
PROFILE_ENCRYPTION_KEY_VERSION=
PROFILE_HASH_PEPPER=
MEDIA_ROOT=/data/media
MEDIA_PUBLIC_BASE_URL=https://api.example.com/api/v1
```

登入／註冊：`SMS_PROVIDER`（監護人 OTP 用）、註冊／登入限流（`REGISTER_MAX_PER_IP_DAY`、`LOGIN_MAX_PER_IP_DAY`、`LOGIN_MAX_PER_ACCT_HOUR`）、`TURNSTILE_SECRET`＋`NUXT_PUBLIC_TURNSTILE_SITE_KEY`。

## 上線阻擋事項（尚未完成）

1. 簡訊供應商未實作：不影響帳密登入，但監護人手機驗證 OTP 在 production 無法發送。
2. Email v1 不發驗證信、無忘記密碼流程；公開上線前需決定郵件方案。
3. Redis client 只支援 host／port，不支援 URL、密碼、TLS（Zeabur 內網可用；Upstash 等需改程式）。
4. Socket.IO CORS 尚未限制正式 origin。
