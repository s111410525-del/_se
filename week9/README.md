# 邊緣筆記 Edge Notes

一個可以直接部署到 **Cloudflare Workers** 的部落格網站，包含文章、留言板與檔案下載。依照 [用 Cloudflare 架設網站](https://github.com/cccbook/cccbook2026/tree/main/%E9%9B%BB%E8%85%A6/%E7%B6%B2%E7%AB%99%E8%A8%AD%E8%A8%88/%E7%94%A8Cloudflare%E6%9E%B6%E8%A8%AD%E7%B6%B2%E7%AB%99) 第 6 章的三合一專案實作，並參考 [ccc-cloudflare/test-apps](https://github.com/ccc-cloudflare/test-apps/) 的自包含慣例。

## 功能

| 功能 | 服務 |
|---|---|
| 首頁文章列表、單篇文章頁 | Workers + D1 |
| 文章留言列表與新增留言 | Workers + D1 |
| 檔案列表與下載（支援 Range 續傳） | Workers + R2 |
| 靜態前端（HTML / CSS / JS） | Workers Static Assets |
| SPA 深層連結（`/posts/:slug` 重新整理可用） | Worker 回退 `index.html` |

前端是無框架的 vanilla JavaScript，所有使用者內容都以 `textContent` 輸出，避免 XSS；後端使用 D1 參數化查詢與長度驗證。

## 架構

```
瀏覽器
  │ https://edgeblog.<subdomain>.workers.dev
  ▼
Cloudflare Edge
  ├─ Static Assets  → public/（HTML、CSS、JS，走 CDN 快取）
  └─ Worker /api/*  → D1（文章、留言）
                    → R2（檔案串流）
```

- `/api/*` 由 `run_worker_first` 優先交給 Worker。
- 其他既有靜態檔案由 Assets 直接回應。
- 找不到的「無副檔名」路徑由 Worker 回傳 `index.html`，交給前端路由器處理；缺少的靜態檔仍回 404。

## 目錄

```
week9/
  src/worker.js        Worker：API 路由、D1 查詢、R2 下載
  public/
    index.html         頁面骨架
    app.js             前端路由器與畫面
    style.css          樣式（亮／暗色自動切換）
    favicon.svg
  schema.sql           D1 資料表
  seed.sql             範例文章與留言
  files/               要上傳到 R2 的範例檔案
  wrangler.jsonc       Workers / D1 / R2 / Assets 設定
  package.json
```

## 本機開發

需求：Node.js 18 以上（建議 20+）。

```bash
npm install
npm run setup:local     # 建本機 D1 表、匯入文章、上傳範例檔案到本機 R2
npm run dev             # http://localhost:8787
```

其他指令：

```bash
npm run check           # 檢查 worker 與前端 JS 語法
npm run db:local        # 只重建本機資料表
npm run seed:local      # 只匯入範例文章
npm run files:local     # 只上傳範例檔案到本機 R2
```

本機資料放在 `.wrangler/state/`，已被 gitignore。

## 部署到 Cloudflare

目前 `wrangler.jsonc` 的 D1 `database_id` 是佔位值，第一次部署前要換成真的 id。

```bash
npx wrangler login

# 1. 建立 D1，記下輸出的 database_id
npx wrangler d1 create edgeblog-db

# 2. 把 database_id 填進 wrangler.jsonc，然後建表與匯入範例
npx wrangler d1 execute edgeblog-db --remote --file=schema.sql
npx wrangler d1 execute edgeblog-db --remote --file=seed.sql

# 3. 建立 R2 bucket 並上傳範例檔案
npx wrangler r2 bucket create edgeblog-files
npx wrangler r2 object put edgeblog-files/guide.md --file=files/guide.md --remote
npx wrangler r2 object put edgeblog-files/cloudflare-checklist.md --file=files/cloudflare-checklist.md --remote
npx wrangler r2 object put edgeblog-files/sample-data.csv --file=files/sample-data.csv --remote

# 4. 部署
npm run deploy
```

部署成功後會得到 `https://edgeblog.<你的子網域>.workers.dev`。之後更新只要再執行 `npm run deploy`。

常用維運指令：

```bash
npx wrangler tail              # 即時 log
npx wrangler deployments list  # 部署紀錄
npx wrangler rollback          # 回滾上一版
```

## API

| Method | 路徑 | 說明 |
|---|---|---|
| GET | `/api/health` | 健康檢查，回報 D1 / R2 綁定狀態 |
| GET | `/api/posts?limit=20` | 文章列表（limit 1–50） |
| GET | `/api/posts/:slug` | 單篇文章 |
| GET | `/api/posts/:slug/comments` | 留言列表 |
| POST | `/api/posts/:slug/comments` | 新增留言 `{ author, body }` |
| GET | `/api/files` | R2 檔案列表 |
| GET / HEAD | `/api/files/:key` | 下載檔案，支援 `Range` |

回應格式：

```json
{ "data": { } }
{ "error": "錯誤訊息" }
```

## 資料模型

```sql
posts(id, slug, title, excerpt, body, status, created_at)
comments(id, post_id, author, body, status, created_at)
```

- `slug` 唯一，作為文章網址。
- `comments.post_id` 參照 `posts.id`，刪文時 `ON DELETE CASCADE`。
- `CHECK` 約束限制標題、摘要、內文與留言長度，程式有 bug 時仍擋得住。
- `status` 保留草稿與隱藏留言的擴充空間。

## 安全與限制

- 暱稱最多 30 字、留言最多 500 字，前後端都驗證。
- SQL 全部使用 `.bind()` 參數化查詢。
- 下載 key 限制長度並禁止開頭斜線與 NUL 位元組。
- 回應加上 `X-Content-Type-Options: nosniff`，前端有 CSP。
- 目前沒有會員系統與後台；文章用 SQL 管理。
- 公開留言端點建議再加 Cloudflare Turnstile 或 Rate Limiting 規則，尤其在流量變大之後。
- 前端是 SPA，文章內容由瀏覽器端載入。若需要搜尋引擎看到完整內文，可把文章頁改成 Worker 端 SSR。

## 免費額度

- Workers：每日 100,000 次請求
- D1：5 GB 儲存、每日 500 萬次讀取
- R2：10 GB 儲存、無出口流量費

個人部落格通常用不到上限。免費方案每次請求 CPU 時間有限，本專案的 API 都是短查詢，適合免費方案。

## 授權

MIT
