# 部署

## 建議架構

| 元件 | 平台 |
|---|---|
| Nuxt Web | Vercel（Node 20） |
| NestJS API＋Socket.IO | Railway／Render／Fly.io 長駐服務，**固定單一 replica** |
| PostgreSQL | Managed PostgreSQL（含備份／PITR） |
| Redis | Managed／private Redis |
| 媒體檔 | 初期 API persistent volume，長期遷 S3／R2 |

API 不適合 Vercel Functions：長駐 `app.listen()`、Socket.IO process-local rooms、本機磁碟媒體、process-local timers／queues。

## 部署步驟

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

登入／簡訊：`ALLOWED_LOGIN_PHONES`、`SMS_PROVIDER`、OTP 限流（`OTP_MAX_PER_*`）、`TURNSTILE_SECRET`。

## 上線阻擋事項（尚未完成）

1. 簡訊供應商未實作：production 發 OTP 直接 503。
2. 登入受門號白名單限制，公開上線需調整。
3. Redis client 只支援 host／port，不支援 URL、密碼、TLS。
4. 媒體寫本機：API 需掛 persistent volume，重啟不得遺失。
5. 選項圖片為相對 URL，Web／API 分網域需 rewrite 或改絕對 URL。
6. Socket.IO CORS 尚未限制正式 origin；Turnstile 前端尚未送 token。
