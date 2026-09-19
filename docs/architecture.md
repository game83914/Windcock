# 系統架構

## 拓撲

```text
瀏覽器 ──HTTPS──▶ Nuxt Web（SSR）
   │                    │  REST /api/v1
   │                    │  WebSocket（Socket.IO handshake 帶 JWT）
   │                    ▼
   │              NestJS API（單一長駐 process）
   │                    ├── PostgreSQL（Prisma）
   │                    ├── Redis（OTP、限流、AI session）
   │                    └── 本機磁碟 MEDIA_ROOT（頭像 / GIF / 選項圖片）
```

## 前端（apps/web）

- Nuxt 3.21 + Vue 3.5，`ssr: true`；登入狀態存於 `localStorage`，SSR 只渲染公開內容，hydration 後恢復登入態。
- JWT 以 `Authorization: Bearer` 傳送；WebSocket token 放 handshake auth。
- 題目建立共用元件 `components/topics/TopicQuestionBuilder.vue`（快問與問卷共用），規則集中於 `utils/questionBuilder.ts`；JSON 匯入走 `utils/quickImport.ts`（範例產生＋解析驗證）。
- 作答統一經 `components/quick/QuickVotePanel.vue`（協調器）分發到各題型元件：`VoteSpectrum`／`VoteShortAnswer`／`VoteRating`／`VoteMultiSelect`／`games/`（轉盤、搖獎、連連看、拼圖、刮刮卡）；問卷容器為 `components/survey/SurveyPanel.vue`，回合制由詳情頁 rounds 渲染。
- 投票狀態機共用 `composables/useVotingGate.ts`，送票／改票／重置共用 `composables/useVoteMutation.ts`。
- 草稿與範本：發起頁（`pages/topics/quick.vue`、`pages/topics/survey.vue`）經 `utils/draftSerializer.ts`＋`composables/useDrafts.ts` 存取；管理頁為 `pages/me/drafts.vue`。

## 後端（apps/api）

- NestJS，`trust proxy = 1`，全域 `ValidationPipe（whitelist + transform + implicit conversion）`。
- 健康檢查：`GET /api/v1/health`（檢查 PostgreSQL `SELECT 1`）。
- 即時更新：Socket.IO rooms，狀態保存在 process 記憶體（見部署限制）。
- 背景工作皆為 process-local：GIF 清理（每小時）、圖片處理 queue、room expiry timer。

## 議題模型

- `TopicKind`：`FORMAL`（正式議題）、`QUICK`（快問）、`SURVEY`（問卷容器）、`STAGED`（回合制容器）。
- `TopicType`：`BINARY`、`MULTIPLE`（多選項單選，UI 稱「單選題」）、`IMAGE_MULTIPLE`、`IMAGE_RANK`、`SPECTRUM`、`SHORT_ANSWER`、`MATCHING`、`PUZZLE`、`SCRATCH`、`SPIN_WHEEL`、`LOTTERY`、`STAR_RATING`、`LIKERT`（3～10 點，舊 `LIKERT_5`／`LIKERT_7` 已合併）、`MULTI_SELECT`、`SURVEY`、`STAGED`。
- 問卷 = 父層 `SURVEY` topic＋子題 `QUICK` topics（`parentTopicId`、`sortOrder`）；回合制 = 父層 `STAGED`＋各回合 `QUICK` 子題；公開列表一律排除子題。
- 抽獎類題型（刮刮樂、搖獎、轉盤）：結果與權重存於選項 `data`（`weight`，刮刮樂另含 `scratchCoverImageUrl`／`scratchRevealImageUrl`／`scratchShowText`），一律由伺服器端 CSPRNG 加權抽取（`POST /topics/:id/scratch-draw`／`POST /topics/:id/game-draw`，冪等、不發獎勵）；前端動畫只呈現伺服器回傳的落點。一般投票／改票路徑拒絕這三種題型，可重置重抽（問卷子題除外）。
- 投票 = 每人每題一筆 `Vote`（`@@unique([userId, topicId])`）；複選另存 `VoteSelection` 關聯，topic 票數每人只加 1，選項票數逐項累計，選取率加總可超過 100%。
- 投票獎勵：只有 `FORMAL` 議題發放（`VOTE_REWARD_POINTS`，冪等）；問卷完成標記只計數、不發點數；快問子題與回合子題不發獎勵。取消投票不回收已發點數。
- 會員草稿／範本：`topic_drafts`（`kind`＋`isTemplate` 區分快問／問卷、草稿／範本，各上限 20 份），完整題型驗證留到正式發佈時。

## 認證

- Email＋密碼註冊／登入；手機為選填，`isPhoneVerified` 僅表示是否已綁定驗證手機。
- 註冊／登入經 Cloudflare Turnstile 人機驗證（`TURNSTILE_SECRET`＋`NUXT_PUBLIC_TURNSTILE_SITE_KEY`）。
- `SMS_PROVIDER` 未設定時 dev 模式僅 console 顯示 OTP（監護人流程用），production 直接 503。
- JWT 預設效期 7 天（`JWT_EXPIRES_IN`）。

## 關鍵架構決策

1. 複選不拆成多筆 Vote，而用 `VoteSelection` join table：保住一人一題一筆作答、獎勵冪等、問卷完成判定、人口快照一人一份。
2. 既有 `MULTIPLE` 語意凍結為單選，不做資料遷移；真正複選另開 `MULTI_SELECT`。
3. 評分／量表由伺服器產生固定數字選項，不信任前端自訂選項。
4. API 維持單副本：Socket.IO rooms、本機媒體磁碟、process-local timers 都不支援多副本。
