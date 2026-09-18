# 群暉 NAS 自託管（DS925+，先區網）

映像檔由 CI 建好推到 GHCR（`ghcr.io/game83914/windcock-api|web:latest`，另有 `:<sha>` 版），NAS 只負責拉取執行，不在 NAS 上編譯。

## 前置準備

1. NAS 安裝 **Container Manager** 套件；建議給 NAS 綁定區網固定 IP（或 DHCP 保留）。
2. `nas.env.example` 複製為 `nas.env` 並填寫（至少填 `NAS_IP`，把所有 `192.168.1.100` 換成實際 IP）：
   - `JWT_SECRET`：換高熵隨機字串。
   - `PROFILE_ENCRYPTION_KEY`：`openssl rand -base64 32` 產生，必填（缺了 API 無法啟動）。
   - 區網階段其餘預設值即可。
3. 登入私密映像檔：Container Manager → **登錄** → 新增 → Registry URL 填 `https://ghcr.io`、使用者名稱填 GitHub 帳號、密碼貼上 `read:packages` 的 classic token。之後本文件所有拉取動作都會自動帶認證；映像檔保持私密，外人看不到也拉不到。

## 部署步驟

1. Container Manager → **專案** → 新增 → 貼上本 repo `docker-compose.yml` 內容（或上傳檔案），專案名稱如 `windcock`。
2. 在專案的環境變數處匯入填好的 `nas.env`。
3. 啟動專案（會自動 `pull` GHCR `:latest` 並啟動 `db`、`redis`、`api`、`web`）。
4. 在 Mac 上對 NAS 的資料庫執行 migration（`apps/api` 底下）：
   ```bash
   DATABASE_URL="postgresql://windcock:windcock@<NAS_IP>:5432/windcock?schema=public" npm run prisma:deploy
   ```
5. 首次部署執行 seed（建分類＋最高管理員；**分類為空則開不了快問**）：
   ```bash
   DATABASE_URL="postgresql://windcock:windcock@<NAS_IP>:5432/windcock?schema=public" npm run prisma:seed
   ```
   完成後立即用 `admin@windcock.local` 登入並**修改密碼**（會員中心 → 修改密碼）。
6. 驗收：`http://<NAS_IP>:3001/api/v1/health` 回 200 → 開 `http://<NAS_IP>:3000` 註冊／登入 → 發一則快問並投票 → 上傳一張圖片確認顯示。

## 日常更新

1. 推上 master 且 CI 綠燈後，GHCR 會產生新的 `:latest`（想鎖版就用 `:<sha>`，以 commit hash 對照）。
2. NAS 專案 → 重新拉取映像檔 → 重啟容器；有新 migration 時先重複步驟 4 再重啟 `api`。
3. 備份：Container Manager 匯出專案設定；資料庫用 Hyper Backup 或 `pg_dump` 定期備份（`dbdata`＋`mediadata` 兩個 volume 為必備份標的）。

## 未來公開到網際網路（另起一輪再做）

Synology DDNS（或自有網域）＋路由器轉發＋DSM 反向代理＋Let's Encrypt；屆時只需把 env 的 IP 全換成 `https://你的網域` 並同步更新 `CORS_ORIGINS`，compose 與映像檔不用動。
