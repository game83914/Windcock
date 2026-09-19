# 部署

群暉 NAS 自託管走 `docs/nas.md`（GHCR 預建映像檔＋Container Manager）；以下為 Zeabur／通用流程。

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

## Docker Compose 自託管

`docker-compose.yml` 內含完整服務（`db`、`redis`、`migrate` one-shot、`api`、`web`；另有 `mediadata` 持久化媒體檔）。`db`／`redis` 不對外開 port，只走內網：

```bash
POSTGRES_PASSWORD='高熵隨機值' \
JWT_SECRET='至少 32 字元高熵隨機值' \
PROFILE_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
PROFILE_HASH_PEPPER='另一組高熵隨機值' \
docker compose up --build -d
# migrate 服務會在 api 啟動前自動執行 prisma migrate deploy；失敗則 api 不啟動（fail-closed）
```

- runtime image 刻意不含 Prisma CLI，**不可** `docker compose exec api npm run prisma:deploy`（該指令已失效）。migration 只走 `migrate` 服務，或維運機用 repo 執行 `npm run prisma:deploy -w apps/api`。
- 只需本機 DB／Redis 開發時：`POSTGRES_PASSWORD=x docker compose up db redis -d`（`npm run dev` 的 `devdb.sh` 走本機二進位制，不經 compose，兩者擇一即可，勿同時佔用 5432／6379）。
- 區網維運需直連 DB 時，自行在 `db` 加 `ports`（如 `'127.0.0.1:15432:5432'`，用完即關），不要長期開放。
- `JWT_SECRET` 缺失／公開預設值／短於 32 字元時 API 拒絕啟動；`TRUST_PROXY` 預設 `false`（直連部署保持關閉，只有反向代理之後才設 `true`）。

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

投票獎勵：`VOTE_REWARD_POINTS`（預設 5，僅正式議題發放）。

AI（預設全關，開發／測試才開）：`AI_AUTHORING_ENABLED`、`OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_RESPONSE_FORMAT`、`AI_AUTHORING_TIMEOUT_MS`、`AI_AUTHORING_MAX_OUTPUT_TOKENS`、`AI_AUTHORING_SESSION_TTL_SECONDS`、世代限流（`AI_AUTHORING_MAX_GENERATIONS_PER_HOUR／_PER_DAY／_PER_IP_HOUR`）、`AI_AUTHORING_MAX_RESPONSE_BYTES`。AI 開發內容 CLI 不需額外變數。

草稿與範本（`/me/drafts`）不需額外環境變數；資料隨 `topic_drafts` 表走正常 migration＋備份。

## 首次部署管理員

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='至少 8 字元的高熵密碼' \
npm run prisma:provision-admin
```

該指令不會無警告接管既有一般帳號；目標 email 已存在且非 ACTIVE 管理員時，必須另設 `ADMIN_ALLOW_TAKEOVER=yes` 才會提升。

分類由 migration 建立；正式環境執行 `prisma:seed:demo` 必須同時符合 `ALLOW_DEMO_SEED=true` 且 `NODE_ENV != production`，該指令只供本機開發建立測試議題、示範組織與 GIF。

曾執行舊版 `prisma:seed` 的環境，可先 dry-run 預覽再一次性移除已知 demo 議題、示範組織與官方 GIF 記錄；已有真實投票／貼文／立場的議題會被拒刪（改用下架），使用者自行建立的議題不會被匹配：

```bash
npm run prisma:remove-demo-content                                    # 預設 dry-run，只列清單不刪除
CONFIRM_REMOVE_DEMO_CONTENT=yes npm run prisma:remove-demo-content    # 確認後執行
```

## 上線阻擋事項（尚未完成）

1. 簡訊供應商未實作：不影響帳密登入，但監護人手機驗證 OTP 在 production 無法發送。
2. Email v1 不發驗證信、無忘記密碼流程；公開上線前需決定郵件方案。
3. Redis client 只支援 host／port，不支援 URL、密碼、TLS（Zeabur 內網可用；Upstash 等需改程式）。
4. Socket.IO CORS 尚未限制正式 origin。
