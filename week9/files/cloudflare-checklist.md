# Cloudflare 上線檢查清單

## 部署前

- [ ] `npx wrangler whoami` 確認已登入正確帳號
- [ ] `wrangler.jsonc` 的 `database_id` 已換成遠端 D1 的 id
- [ ] 已執行 `schema.sql` 與 `seed.sql` 到遠端 D1
- [ ] 已建立 R2 bucket，且需要公開的檔案已上傳
- [ ] `npm run check` 通過
- [ ] 本機 `npm run dev` 煙霧測試通過

## 上線後

- [ ] 打開首頁、文章頁、檔案頁，確認資料正確
- [ ] 測試新增留言，確認 HTTP 201 且重新整理後仍存在
- [ ] 測試下載檔案，確認 Content-Type 與檔名正確
- [ ] 用 `npx wrangler tail` 觀察有沒有 5xx
- [ ] 在 Dashboard 開啟 Workers Observability

## 安全

- [ ] 前端以 `textContent` 輸出使用者內容（防 XSS）
- [ ] API 驗證長度、型別與 slug 格式
- [ ] SQL 全部使用參數化查詢
- [ ] 公開留言端點加上 Turnstile 或 Rate Limiting
- [ ] 不要把金鑰寫進 repo；需要時用 `wrangler secret put`

## 成本

- Workers 免費方案：每日 100,000 次請求
- D1 免費方案：5 GB 儲存、每日 500 萬次讀取
- R2 免費方案：10 GB 儲存，無出口流量費

對個人部落格而言，這些額度通常非常充裕。超過時再評估 Workers Paid。
