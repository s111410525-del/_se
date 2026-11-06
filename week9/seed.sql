-- EdgeMemo 範例內容。可重複執行，不會產生重複備忘錄。
-- 本機：npx wrangler d1 execute edgememo-db --local --file=seed.sql
-- 線上：npx wrangler d1 execute edgememo-db --remote --file=seed.sql

INSERT INTO notes (title, content, color, pinned, created_at, updated_at)
SELECT
  '歡迎來到 EdgeMemo',
  '這是你的第一則備忘錄。

EdgeMemo 是一個跑在 Cloudflare Workers 上的備忘錄網站，資料存在 D1。你可以：
- 新增、編輯、刪除備忘錄
- 用六種色紙分類
- 把重要的備忘錄釘選在最前面
- 用關鍵字搜尋標題與內容

按右上角的「新增備忘錄」開始寫下第一個想法。',
  'sand',
  1,
  '2026-11-03 09:00:00',
  '2026-11-06 08:40:00'
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE title = '歡迎來到 EdgeMemo');

INSERT INTO notes (title, content, color, pinned, created_at, updated_at)
SELECT
  'Cloudflare 部署速記',
  '第一次部署：

npx wrangler login
npx wrangler d1 create edgememo-db
# 把 database_id 填進 wrangler.jsonc
npx wrangler d1 execute edgememo-db --remote --file=schema.sql
npx wrangler d1 execute edgememo-db --remote --file=seed.sql
npm run deploy

之後更新只要 npm run deploy。',
  'sky',
  0,
  '2026-11-06 07:00:00',
  '2026-11-06 07:10:00'
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE title = 'Cloudflare 部署速記');

INSERT INTO notes (title, content, color, pinned, created_at, updated_at)
SELECT
  '週末採買清單',
  '- 燕麥奶兩瓶
- 雞蛋一盒
- 菠菜與番茄
- 咖啡豆（中焙）
- 洗碗精
- 給桌上的植物換一個新盆子',
  'mint',
  0,
  '2026-11-05 18:20:00',
  '2026-11-05 18:20:00'
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE title = '週末採買清單');

INSERT INTO notes (title, content, color, pinned, created_at, updated_at)
SELECT
  '寫作靈感：把網站放到邊緣',
  '「最快的伺服器，是使用者旁邊那一個。」

把靜態檔案放到 CDN，把短查詢交給邊緣的 Worker，把資料留在 D1。不是為了追逐流行，而是讓每一次請求都少走一點路。',
  'rose',
  0,
  '2026-11-04 21:05:00',
  '2026-11-04 21:05:00'
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE title = '寫作靈感：把網站放到邊緣');

INSERT INTO notes (title, content, color, pinned, created_at, updated_at)
SELECT
  '讀書筆記：網站設計',
  '好的網站設計不是把每個元件都做得很漂亮，而是讓使用者抵達目的的路徑變短。

三個提醒：
1. 先處理內容層級，再處理裝飾。
2. 動線比動畫重要。
3. 手機版不是縮小版，是重新編排的版本。',
  'lilac',
  0,
  '2026-11-02 10:00:00',
  '2026-11-02 10:00:00'
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE title = '讀書筆記：網站設計');

INSERT INTO notes (title, content, color, pinned, created_at, updated_at)
SELECT
  '今天的三個重點',
  '一、把 D1 的查詢加上索引。
二、首頁先載入骨架，再補資料。
三、留一點空白給明天。',
  'sun',
  0,
  '2026-11-06 06:30:00',
  '2026-11-06 06:30:00'
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE title = '今天的三個重點');
