# API 概覽

Base URL：`/api/v1`。完整 schema 見 Swagger `/api/docs`。需登入端點使用 `Authorization: Bearer <JWT>`。

## 認證（`auth`）

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/auth/register` | Email 註冊（密碼 8~72 字、暱稱、選填手機，直接核發 JWT） |
| POST | `/auth/login` | Email＋密碼登入（統一 401 訊息，帳號／IP 限流） |
| POST | `/auth/password/change` | 登入後改密碼（需 JWT） |
| GET | `/auth/me` | 目前登入會員（含 email） |

## 議題（`topics`）

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/topics` | 公開列表；`kind=FORMAL｜QUICK｜SURVEY｜ALL`，子題一律排除 |
| GET | `/topics/:id` | 詳情（含 `myVote`、`responses`；問卷含 `questions` 與作答進度） |
| POST | `/topics/quick` | 建立快問（資深會員，可自動核准） |
| POST | `/topics/surveys` | 建立問卷（2～20 題子題；子題可用全部 15 種快問題型） |
| GET | `/topics/me/quick` | 我的快問 |
| GET | `/topics/me/surveys` | 我的問卷 |
| POST | `/topics/:id/vote` | 首投；複選傳 `optionIds[]` |
| PATCH | `/topics/:id/vote` | 重投（僅 QUICK；複選只更新差異 selections） |
| POST | `/topics/:id/rank` | 排名題作答 |
| POST/DELETE | `/topics/:id/share-link` | 私密連結產生／停用（QUICK、SURVEY） |

## 其他模組

- 會員中心（投票紀錄、議題、通知）、立場樹、留言、迷因／GIF、頭像上傳、選項圖片上傳、頻道追蹤、AI 輔助寫作、人口統計分析。

## 驗證重點

- 全域 `ValidationPipe`：`whitelist + transform + implicit conversion`。
- 手機為選填（`phoneNumber` nullable）；`isPhoneVerified` 語意為「是否已綁定驗證手機」，不再擋登入與 JWT。
- 複選：`optionIds` 去重、全屬該題、至少 1 項、不超過題目 `maxSelections`。
- 量表題：左右端點必填且不可相同；伺服器產生固定刻度選項。
- 簡答上限 500 字；選項 label 上限 50 字。
