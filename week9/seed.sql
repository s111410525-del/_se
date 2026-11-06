-- 範例內容。可重複執行，不會產生重複文章或留言。
-- 本機：npx wrangler d1 execute edgeblog-db --local --file=seed.sql
-- 線上：npx wrangler d1 execute edgeblog-db --remote --file=seed.sql

INSERT INTO posts (slug, title, excerpt, body, status) VALUES
(
  'hello-edge',
  '在 Cloudflare 邊緣寫下第一行字',
  '一支 Worker、一個 D1 資料庫、一個 R2 bucket，就能把部落格放到離讀者最近的節點。',
  '這個網站不是跑在某台固定的伺服器上，而是跑在 Cloudflare 全球數百個節點裡。當你打開這一頁，請求會先抵達離你最近的節點，靜態的 HTML、CSS、JavaScript 直接從邊緣快取回傳；需要資料時，才由 Worker 向 D1 查詢。

這件事的意義不只是「快」。它把維運的形狀改變了：沒有主機要更新，沒有作業系統要打補丁，也沒有半夜被告警叫醒的服務。你寫的是一段請求進來時才會執行的程式，Cloudflare 負責其餘的一切。

這個網站本身就是教材。文章存在 D1，留言寫回 D1，檔案放在 R2，前端是三個靜態檔案。全部都在同一個專案裡，執行 npx wrangler deploy 就能上線。

如果你也想做一個，先從最小的地方開始：一個首頁、一張表、一個 API。等它真的跑起來，再慢慢加東西。',
  'published'
),
(
  'why-edge',
  '為什麼把網站放到邊緣？',
  '從 CDN 快取到 V8 Isolate，理解邊緣運算解決了什麼問題，以及它不適合什麼。',
  '傳統網站的請求路徑很長：使用者 → 網路 → 你的伺服器 → 資料庫 → 再原路返回。即使程式寫得再好，光速仍然是個冷酷的限制。把內容放到離使用者更近的地方，是最直接的解法。

CDN 先解決了靜態檔案的問題。圖片、CSS、JavaScript 一旦快取在邊緣，後續請求就不用回到origin。但動態內容怎麼辦？早期的做法是讓 CDN 回源，瓶頸仍在 origin。邊緣運算則是把「執行程式」也搬過去。

Cloudflare Workers 用 V8 Isolate 執行程式，而不是為每個請求開一個容器。Isolate 的啟動成本極低，所以冷啟動幾乎不存在。這讓「每個請求都跑一段程式」變得可行。

但邊緣不是萬靈丹。它適合短時間、無狀態、靠近使用者的工作：改寫請求、驗證權杖、查一筆資料、回一個 API。它不適合長時間的影片轉檔、複雜的機器學習推論，或需要大量本機磁碟的任務。

理解這個界線，比記住任何產品名稱都重要。',
  'published'
),
(
  'd1-and-r2',
  'D1 與 R2：把資料與檔案留在雲端',
  'D1 是邊緣上的 SQLite，R2 是沒有出口流量費的物件儲存。兩者搭配，剛好補齊關聯式資料與大檔案。',
  'D1 建構在 SQLite 之上。你寫的是熟悉的 SQL，資料庫卻由 Cloudflare 代管，並且可以從 Worker 用 binding 直接存取，不必繞到公網。對部落格這種讀多寫少、資料量不大的應用來說，它非常合適。

R2 則是物件儲存。檔案用 key 定位，透過 Worker 串流下載。它和 S3 最大的差別之一是沒有出口流量費，對提供檔案下載的網站來說，這個差別會隨流量放大。

這個網站的資料模型只有兩張表：posts 與 comments。文章用 slug 當網址，留言用 post_id 關聯，刪文時串聯刪除。檔案不進資料庫，只把 key 交給 R2。

當需求長大時，再問自己：這筆資料需要關聯查詢嗎？需要就留在 D1；它是大型二進位資料嗎？是就放 R2；只是短期快取嗎？那也許 KV 更適合。

選對工具，比把一個工具用到極限更重要。',
  'published'
)
ON CONFLICT(slug) DO NOTHING;

-- 固定範例文章的日期，讓首頁排序穩定（新到舊）
UPDATE posts SET created_at = '2026-11-03 09:00:00' WHERE slug = 'hello-edge';
UPDATE posts SET created_at = '2026-11-02 09:00:00' WHERE slug = 'why-edge';
UPDATE posts SET created_at = '2026-11-01 09:00:00' WHERE slug = 'd1-and-r2';

INSERT INTO comments (post_id, author, body)
SELECT p.id, '阿硯', '第一次把網站部署到邊緣，最有感的是部署完那一刻：沒有等待開機，也沒有設定伺服器。'
FROM posts p
WHERE p.slug = 'hello-edge'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.post_id = p.id AND c.author = '阿硯' AND c.body LIKE '第一次把網站%'
  );

INSERT INTO comments (post_id, author, body)
SELECT p.id, '小金', '想請問留言板如果被機器人洗版，免費方案有什麼做法？'
FROM posts p
WHERE p.slug = 'hello-edge'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.post_id = p.id AND c.author = '小金'
  );

INSERT INTO comments (post_id, author, body)
SELECT p.id, '站長', '可以先從長度限制與 Turnstile 開始，流量真的上來再加 Rate Limiting 規則。程式端的驗證也要留在，資料庫的 CHECK 是最後一道防線。'
FROM posts p
WHERE p.slug = 'hello-edge'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.post_id = p.id AND c.author = '站長'
  );
