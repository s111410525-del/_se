# EdgeMemo · 邊緣備忘錄

一個可以直接部署到 **Cloudflare Workers** 的備忘錄網站。用溫暖的紙張色調與卡片牆呈現備忘錄，支援新增、編輯、刪除、色紙分類、釘選與全文搜尋；資料儲存在 **Cloudflare D1**，前端由 **Workers Static Assets** 提供。

這個專案依照 [用 Cloudflare 架設網站](https://github.com/cccbook/cccbook2026/tree/main/%E9%9B%BB%E8%85%A6/%E7%B6%B2%E7%AB%99%E8%A8%AD%E8%A8%88/%E7%94%A8Cloudflare%E6%9E%B6%E8%A8%AD%E7%B6%B2%E7%AB%99) 的邊緣架構實作，並參考 [ccc-cloudflare/test-apps](https://github.com/ccc-cloudflare/test-apps/) 的自包含慣例。

線上版本：<https://edgememo.edgememo.workers.dev>

## 網站說明

EdgeMemo 是一個「打開就能寫」的個人備忘錄牆：

- 首頁是一面卡片牆，每則備忘錄都是一張有色紙，依「釘選優先、更新時間新到舊」排列。
- 點擊卡片會開啟編輯器對話框，可以修改標題、內容、色紙與釘選狀態。
- 工具列提供即時搜尋、釘選篩選與顏色篩選，適合快速找回某則筆記。
- 手機版會把編輯器變成全螢幕，卡片牆改為單欄。
- 亮色／暗色模式跟隨系統設定，並保留鍵盤操作與對話框焦點管理。

這是一個沒有登入機制的版本，適合當作個人練習或內部工具。若要放到公開網路給多人使用，建議先加上 Cloudflare Access、Turnstile 或自己的登入系統。

## 功能

| 功能 | 說明 |
|---|---|
| 新增備忘錄 | 標題最多 120 字、內容最多 20,000 字；只寫內容時會自動用第一行當標題 |
| 編輯備忘錄 | 修改標題、內容、顏色與釘選狀態 |
| 刪除備忘錄 | 編輯器內二次確認，刪除後立即更新列表 |
| 六種色紙 | 沙色、玫瑰、薄荷、天空、薰衣草、日光 |
| 釘選 | 重要備忘錄固定排在列表最前面 |
| 搜尋 | 同時搜尋標題與內容，輸入後自動更新 |
| 篩選 | 全部／釘選、六種顏色 |
| 統計 | 顯示備忘錄總數與釘選數量 |
| 深層連結 | 無副檔名路徑由 Worker 回退到 `index.html`，SPA 可直接重新整理 |
| 亮暗模式 | 跟隨系統 `prefers-color-scheme` |
| 無障礙 |  Skip link、對話框標題、`aria-live`、`aria-pressed`、鍵盤 `Ctrl/Cmd + Enter` 儲存 |

## 架構

```
瀏覽器
  │ https://edgememo.<subdomain>.workers.dev
  ▼
Cloudflare Edge
  ├─ Static Assets  → public/（HTML、CSS、JS，走 CDN 快取）
  └─ Worker /api/*  → D1（notes 資料表）
```

- `/api/*` 透過 `run_worker_first` 優先交給 Worker。
- 既有靜態檔案由 Static Assets 直接回應。
- 找不到的「無副檔名」路徑由 Worker 回傳 `index.html`；缺少的靜態檔仍回 404。
- 前端是無框架的 vanilla JavaScript，所有使用者內容以 `textContent` 輸出，避免 XSS。

## 目錄

```
week9/
  src/worker.js        Worker：備忘錄 CRUD API、D1 查詢、SPA fallback
  public/
    index.html         頁面骨架與編輯器對話框
    app.js             前端狀態、列表渲染、搜尋、編輯器互動
    style.css          紙張卡片風格、亮暗模式、響應式版面
    favicon.svg
  schema.sql           D1 資料表與索引
  seed.sql             六則範例備忘錄
  wrangler.jsonc       Workers / D1 / Assets 設定
  package.json
```

## 本機開發

需求：Node.js 18 以上（建議 20+）。

```bash
npm install
npm run setup:local     # 建本機 D1 資料表並匯入六則範例
npm run dev             # http://localhost:8787
```

其他指令：

```bash
npm run check           # 檢查 worker 與前端 JS 語法
npm run db:local        # 只重建本機資料表
npm run seed:local      # 只匯入範例備忘錄
```

本機 D1 資料放在 `.wrangler/state/`，已被 gitignore。

## 部署到 Cloudflare

本專案已建立 D1 `edgememo-db` 並在 `wrangler.jsonc` 填入 `database_id`；以下流程供重建或搬到新帳號時參考。

```bash
npx wrangler login

# 1. 只有新環境才需要建立 D1，記下輸出的 database_id
npx wrangler d1 create edgememo-db

# 2. 把 database_id 填進 wrangler.jsonc，然後建表與匯入範例
npx wrangler d1 execute edgememo-db --remote --file=schema.sql
npx wrangler d1 execute edgememo-db --remote --file=seed.sql

# 3. 部署
npm run deploy
```

目前線上版本部署在 `https://edgememo.edgememo.workers.dev`。之後更新只要再執行 `npm run deploy`。

常用維運指令：

```bash
npx wrangler tail              # 即時 log
npx wrangler deployments list  # 部署紀錄
npx wrangler rollback          # 回滾上一版
```

## API

| Method | 路徑 | 說明 |
|---|---|---|
| GET | `/api/health` | 健康檢查，回報 D1 綁定狀態 |
| GET | `/api/stats` | 備忘錄總數與釘選數 |
| GET | `/api/notes?q=&color=&pinned=1&limit=200` | 列表；支援搜尋、顏色、釘選篩選 |
| POST | `/api/notes` | 新增備忘錄 |
| GET | `/api/notes/:id` | 單則備忘錄 |
| PATCH | `/api/notes/:id` | 更新指定欄位 |
| DELETE | `/api/notes/:id` | 刪除備忘錄 |

新增與更新的請求內容：

```json
{
  "title": "週末採買清單",
  "content": "- 燕麥奶\n- 咖啡豆",
  "color": "mint",
  "pinned": false
}
```

回應格式：

```json
{ "data": { } }
{ "error": "錯誤訊息" }
```

`color` 只接受 `sand`、`rose`、`mint`、`sky`、`lilac`、`sun`；`pinned` 接受布林值或 0/1。

## 資料模型

```sql
notes(
  id,
  title,        -- 1–120 字
  content,      -- 0–20000 字
  color,        -- 六種色紙之一
  pinned,       -- 0 / 1
  created_at,
  updated_at
)
```

- `CHECK` 約束在資料庫層限制標題、內容、顏色與釘選值。
- 列表索引 `(pinned DESC, updated_at DESC)` 對應實際查詢模式。
- 搜尋使用參數化 `LIKE` 查詢，並跳脫 `%`、`_`、`\` 等萬用字元。

## 安全與限制

- 目前**沒有登入與權限控制**，任何能打開網站的人都能新增、修改、刪除備忘錄。公開上線前請加上驗證機制。
- 前端只以 `textContent` 輸出標題與內容，避免 XSS。
- 後端驗證長度、型別、顏色與 slug/id 格式，SQL 全部使用 `.bind()` 參數化查詢。
- 回應加上 `X-Content-Type-Options: nosniff`，靜態頁有 CSP。
- 公開端點建議再加 Cloudflare Turnstile 或 Rate Limiting 規則，尤其在流量變大之後。
- 搜尋結果最多回傳 500 則；若資料量變大，應改成分頁載入。

## 免費額度

- Workers：每日 100,000 次請求
- D1：5 GB 儲存、每日 500 萬次讀取
- 靜態資產：不佔用 Worker 請求

個人備忘錄的使用量通常遠低於免費額度。免費方案每次請求的 CPU 時間有限，本專案的 API 都是短查詢，適合免費方案。

## 授權

MIT

---

本專案使用 [opencode](https://opencode.ai) 完成程式開發、本機測試與文件撰寫。
