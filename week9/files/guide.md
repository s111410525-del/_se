# 邊緣筆記使用手冊

歡迎來到邊緣筆記。這個檔案放在 Cloudflare R2，由 Worker 以串流方式提供下載。

## 這個網站有什麼

- 文章列表與單篇文章（D1）
- 每篇文章下方的留言板（D1）
- 檔案下載頁（R2）

## 本機開發

```bash
npm install
npm run setup:local
npm run dev
```

打開 http://localhost:8787 就能看到網站。

## 新增一篇文章

文章存在 D1 的 `posts` 表。最直接的方式是執行 SQL：

```bash
npx wrangler d1 execute edgeblog-db --local --command \
  "INSERT INTO posts (slug, title, excerpt, body) VALUES ('my-post', '我的文章', '摘要', '正文')"
```

線上環境把 `--local` 換成 `--remote`。

## 上傳一個檔案

```bash
npx wrangler r2 object put edgeblog-files/notes/hello.txt --file=./hello.txt --local
```

線上環境拿掉 `--local`，並先建立 bucket：

```bash
npx wrangler r2 bucket create edgeblog-files
```

## 部署

```bash
npx wrangler login
npx wrangler d1 create edgeblog-db
# 把輸出的 database_id 填進 wrangler.jsonc
npx wrangler d1 execute edgeblog-db --remote --file=schema.sql
npx wrangler d1 execute edgeblog-db --remote --file=seed.sql
npx wrangler r2 bucket create edgeblog-files
npx wrangler deploy
```

部署完成後，wrangler 會印出 `https://edgeblog.<你的子網域>.workers.dev`。
