-- EdgeMemo 的 D1 資料表結構。
-- 本機：npx wrangler d1 execute edgememo-db --local --file=schema.sql
-- 線上：npx wrangler d1 execute edgememo-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  content TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 20000),
  color TEXT NOT NULL DEFAULT 'sand' CHECK (color IN ('sand', 'rose', 'mint', 'sky', 'lilac', 'sun')),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 列表查詢固定是「釘選優先、更新時間新到舊」
CREATE INDEX IF NOT EXISTS idx_notes_order ON notes(pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_color ON notes(color);
