const express = require('express');
const { Pool } = require('pg');
const os = require('os');

const app = express();
const PORT = Number(process.env.APP_PORT || 3000);
const SERVICE_NAME = process.env.SERVICE_NAME || 'node-api';

app.use(express.json({ limit: '64kb' }));

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password123',
  database: process.env.DB_NAME || 'homework_db',
  port: Number(process.env.DB_PORT || 5432),
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('[pg] idle client error:', err.message));

const startedAt = Date.now();

async function dbSnapshot() {
  const res = await pool.query(
    'SELECT NOW() AS now, version() AS version, current_database() AS database'
  );
  return res.rows[0];
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', database: 'down', error: err.message });
  }
});

app.get('/api/status', async (req, res) => {
  const payload = {
    service: SERVICE_NAME,
    runtime: 'node.js',
    runtimeVersion: process.version,
    hostname: os.hostname(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    database: { status: 'down' },
  };

  try {
    const db = await dbSnapshot();
    payload.database = {
      status: 'up',
      time: db.now,
      version: db.version,
      name: db.database,
    };
  } catch (err) {
    payload.database = { status: 'down', error: err.message };
  }

  res.json(payload);
});

app.get('/api/notes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, author, content, created_at FROM notes ORDER BY id DESC LIMIT 100'
    );
    res.json({ count: result.rowCount, items: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', async (req, res) => {
  const { content, author } = req.body || {};
  if (typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'content is required' });
  }
  if (content.length > 500) {
    return res.status(400).json({ error: 'content must be 500 characters or fewer' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO notes (content, author) VALUES ($1, $2) RETURNING id, author, content, created_at',
      [content.trim(), (author || 'anonymous').toString().slice(0, 40)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  try {
    const result = await pool.query('DELETE FROM notes WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ deleted: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((req, res) => res.status(404).json({ error: 'not found' }));

// 統一錯誤處理：例如 JSON 格式錯誤時回傳乾淨的 JSON
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  console.error('[error]', err.message);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] listening on port ${PORT}`);
});
