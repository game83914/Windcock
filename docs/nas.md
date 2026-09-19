# 群暉 NAS 自託管（DS925+，先區網）

映像檔由 CI 建好推到 GHCR（`ghcr.io/game83914/windcock-api|web:latest`，另有 `:<sha>` 版），NAS 只負責拉取執行，不在 NAS 上編譯。

## 前置準備

1. NAS 安裝 **Container Manager** 套件；建議給 NAS 綁定區網固定 IP（或 DHCP 保留）。
2. `nas.env.example` 複製為 `nas.env` 並填寫（至少填 `NAS_IP`，把所有 `192.168.1.100` 換成實際 IP）：
   - `POSTGRES_PASSWORD`：高熵隨機字串，必填（compose 不再提供預設密碼）。
   - `JWT_SECRET`：至少 32 字元高熵隨機字串，必填（缺失／預設值／過短會拒絕啟動）。
   - `PROFILE_ENCRYPTION_KEY`：`openssl rand -base64 32` 產生，必填（缺了 API 無法啟動）。
   - `PROFILE_HASH_PEPPER`：另一組高熵隨機字串，必填。
   - 區網階段其餘預設值即可；`TRUST_PROXY` 保持 `false`（直連部署）。
3. 登入私密映像檔：Container Manager → **登錄** → 新增 → Registry URL 填 `https://ghcr.io`、使用者名稱填 GitHub 帳號、密碼貼上 `read:packages` 的 classic token。之後本文件所有拉取動作都會自動帶認證；映像檔保持私密，外人看不到也拉不到。

## 部署步驟

1. Container Manager → **專案** → 新增 → 貼上本 repo `docker-compose.yml` 內容（或上傳檔案），專案名稱如 `windcock`。**注意**：repo 版 compose 已移除 `db`／`redis` 對外 ports 並刪除 `build` 段依賴（NAS 只拉 GHCR 映像）；若你沿用舊自訂 compose（含 `15432:5432` 這類維運用映射），migration 仍可走舊流程，但建議改用新版。
2. 在專案的環境變數處匯入填好的 `nas.env`（或同目錄放 `.env`）。
3. 啟動專案：`migrate` one-shot 服務會先對內網 DB 執行 `prisma migrate deploy`，成功後才啟動 `api`、`web`（失敗則 api 不啟動，先看 `windcock-migrate` 日誌排查）。
4. 維運機直連 DB（備份／除錯）才需要臨時映射 port；日常保持關閉，用完即關。
5. migration 會建立所有分類；首次部署只需以自訂帳密初始化最高管理員（維運機執行，`DATABASE_URL` 指 NAS DB；若無直連 port，先臨時加映射）：
    ```bash
    DATABASE_URL="postgresql://windcock:windcock@<NAS_IP>:5432/windcock?schema=public" \
    ADMIN_EMAIL="admin@example.com" \
    ADMIN_PASSWORD="至少 8 字元的高熵密碼" \
    npm run prisma:provision-admin
    ```
    正式環境執行 `prisma:seed:demo` 必須同時符合 `ALLOW_DEMO_SEED=true` 且 `NODE_ENV != production`；它只供本機開發建立測試議題、示範組織與 GIF。
    曾執行舊版 seed 的 NAS 可先 dry-run（`npm run prisma:remove-demo-content`）預覽，再設 `CONFIRM_REMOVE_DEMO_CONTENT=yes` 執行，一次性移除已知 demo 記錄；已有真實投票的議題會被拒刪。
6. 驗收：`http://<NAS_IP>:3001/api/v1/health` 回 200 → 開 `http://<NAS_IP>:3000` 註冊／登入 → 發一則快問並投票 → 上傳一張圖片確認顯示。

## 日常更新

1. 推上 master 且 CI 綠燈後，GHCR 會產生新的 `:latest`（想鎖版就用 `:<sha>`，以 commit hash 對照）。
2. NAS 專案 → 重新拉取映像檔 → 重啟容器；有新 migration 時先重複步驟 4 再重啟 `api`。
3. 備份：Container Manager 匯出專案設定；資料庫用 Hyper Backup 或 `pg_dump` 定期備份（`dbdata`＋`mediadata` 兩個 volume 為必備份標的）。

## 未來公開到網際網路（另起一輪再做）

Synology DDNS（或自有網域）＋路由器轉發＋DSM 反向代理＋Let's Encrypt；屆時只需把 env 的 IP 全換成 `https://你的網域` 並同步更新 `CORS_ORIGINS`，compose 與映像檔不用動。
