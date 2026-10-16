-- 初始化資料庫：建立表格與預設資料
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    author VARCHAR(40) NOT NULL DEFAULT 'anonymous',
    content VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 範例資料
INSERT INTO notes (author, content) VALUES
('system', 'Docker 微服務系統啟動成功！'),
('demo', '這是一筆預設留言，來自 PostgreSQL 初始化腳本。');
