-- edgeblog 的 D1 資料表結構。
-- 本機：npx wrangler d1 execute edgeblog-db --local --file=schema.sql
-- 線上：npx wrangler d1 execute edgeblog-db --remote --file=schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  excerpt TEXT NOT NULL DEFAULT '' CHECK (length(excerpt) <= 300),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (length(author) BETWEEN 1 AND 30),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 查詢模式固定是「某篇文章的留言、由新到舊」
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at DESC);
