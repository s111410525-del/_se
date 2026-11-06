// EdgeMemo — Cloudflare Worker
//
//   GET    /api/notes           備忘錄列表（支援 q / color / pinned / limit）
//   POST   /api/notes           新增備忘錄
//   GET    /api/notes/:id       單則備忘錄
//   PATCH  /api/notes/:id       更新備忘錄
//   DELETE /api/notes/:id       刪除備忘錄
//   GET    /api/stats           總數與釘選數
//   GET    /api/health          健康檢查
//   其他                        靜態資產（public/），無副檔名路徑回傳 index.html

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const COLORS = new Set(['sand', 'rose', 'mint', 'sky', 'lilac', 'sun']);
const TITLE_MAX = 120;
const CONTENT_MAX = 20000;

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });

const ok = (data, status = 200) => json({ data }, status);
const fail = (error, status = 400) => json({ error }, status);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireDB(env) {
  if (!env.DB) throw new HttpError(500, '伺服器缺少 D1 綁定 DB');
  return env.DB;
}

async function readJson(request) {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!type.includes('application/json')) {
    throw new HttpError(415, '請以 application/json 格式送出');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'JSON 格式不正確');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '請提供物件格式的內容');
  }

  return body;
}

function parseId(value) {
  if (!/^\d{1,12}$/.test(value)) throw new HttpError(404, '找不到這則備忘錄');
  return Number(value);
}

function hasKey(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function toPinned(value) {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0' || value == null) return 0;
  throw new HttpError(400, '釘選狀態不正確');
}

function toColor(value) {
  const color = String(value ?? '');
  if (!COLORS.has(color)) throw new HttpError(400, '顏色選項不正確');
  return color;
}

function deriveTitle(content) {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine || '未命名備忘錄').slice(0, TITLE_MAX);
}

function normalizeNote(input, existing = null) {
  let title = existing ? existing.title : '';
  let content = existing ? existing.content : '';

  if (hasKey(input, 'title')) title = String(input.title ?? '');
  if (hasKey(input, 'content')) content = String(input.content ?? '');

  title = title.replace(/\r\n?/g, '\n').trim();
  content = content.replace(/\r\n?/g, '\n').trim();

  if (!title && content) title = deriveTitle(content);
  if (!title && !content) throw new HttpError(400, '請輸入標題或內容');
  if (title.length > TITLE_MAX) throw new HttpError(400, `標題最多 ${TITLE_MAX} 個字`);
  if (content.length > CONTENT_MAX) throw new HttpError(400, `內容最多 ${CONTENT_MAX} 個字`);

  const color = hasKey(input, 'color')
    ? toColor(input.color)
    : existing
      ? existing.color
      : 'sand';

  const pinned = hasKey(input, 'pinned')
    ? toPinned(input.pinned)
    : existing
      ? existing.pinned
      : 0;

  return { title, content, color, pinned };
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// ---------- 查詢 ----------

async function findNote(db, id) {
  const note = await db
    .prepare(
      `SELECT id, title, content, color, pinned, created_at, updated_at
         FROM notes WHERE id = ?`
    )
    .bind(id)
    .first();
  if (!note) throw new HttpError(404, '找不到這則備忘錄');
  return note;
}

async function listNotes(env, url) {
  const db = requireDB(env);

  const q = (url.searchParams.get('q') || '').trim();
  if (q.length > 100) throw new HttpError(400, '搜尋關鍵字最多 100 個字');

  const colorParam = url.searchParams.get('color');
  const color = colorParam && colorParam !== 'all' ? toColor(colorParam) : null;
  const pinnedOnly = url.searchParams.get('pinned') === '1';

  const limitParam = url.searchParams.get('limit');
  const requested = limitParam === null || limitParam === '' ? NaN : Number(limitParam);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), 500)
    : 200;

  const where = [];
  const bind = [];

  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push("(title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')");
    bind.push(like, like);
  }
  if (color) {
    where.push('color = ?');
    bind.push(color);
  }
  if (pinnedOnly) {
    where.push('pinned = 1');
  }

  const sql = `SELECT id, title, content, color, pinned, created_at, updated_at
                 FROM notes
                ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                ORDER BY pinned DESC, datetime(updated_at) DESC, id DESC
                LIMIT ?`;

  const { results } = await db.prepare(sql).bind(...bind, limit).all();
  return ok(results);
}

async function getStats(env) {
  const db = requireDB(env);
  const row = await db
    .prepare('SELECT COUNT(*) AS total, COALESCE(SUM(pinned), 0) AS pinned FROM notes')
    .first();
  return ok({ total: row.total, pinned: row.pinned });
}

// ---------- 寫入 ----------

async function createNote(request, env) {
  const db = requireDB(env);
  const input = await readJson(request);
  const note = normalizeNote(input);

  const result = await db
    .prepare(
      `INSERT INTO notes (title, content, color, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(note.title, note.content, note.color, note.pinned)
    .run();

  const created = await findNote(db, result.meta.last_row_id);
  return ok(created, 201);
}

async function updateNote(request, env, id) {
  const db = requireDB(env);
  const existing = await findNote(db, id);
  const input = await readJson(request);
  const note = normalizeNote(input, existing);

  await db
    .prepare(
      `UPDATE notes
          SET title = ?, content = ?, color = ?, pinned = ?, updated_at = datetime('now')
        WHERE id = ?`
    )
    .bind(note.title, note.content, note.color, note.pinned, id)
    .run();

  const updated = await findNote(db, id);
  return ok(updated);
}

async function deleteNote(env, id) {
  const db = requireDB(env);
  const result = await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
  if (!result.meta.changes) throw new HttpError(404, '找不到這則備忘錄');
  return ok({ id });
}

// ---------- 路由 ----------

async function handleApi(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === '/api/health') {
      if (method !== 'GET') throw new HttpError(405, '這個方法不被允許');
      return ok({
        ok: true,
        binding: Boolean(env.DB),
        time: new Date().toISOString(),
      });
    }

    if (path === '/api/stats') {
      if (method !== 'GET') throw new HttpError(405, '這個方法不被允許');
      return await getStats(env);
    }

    if (path === '/api/notes') {
      if (method === 'GET') return await listNotes(env, url);
      if (method === 'POST') return await createNote(request, env);
      throw new HttpError(405, '這個方法不被允許');
    }

    const match = path.match(/^\/api\/notes\/([^/]+)$/);
    if (match) {
      const id = parseId(match[1]);
      if (method === 'GET') return ok(await findNote(requireDB(env), id));
      if (method === 'PATCH') return await updateNote(request, env, id);
      if (method === 'DELETE') return await deleteNote(env, id);
      throw new HttpError(405, '這個方法不被允許');
    }

    throw new HttpError(404, '找不到這個 API');
  } catch (error) {
    if (error instanceof HttpError) return fail(error.message, error.status);
    console.error('Unhandled API error:', error);
    return fail('伺服器發生錯誤，請稍後再試', 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      });
    }

    // 沒有副檔名的路徑交給前端路由（SPA fallback）。
    if (!/\.[a-zA-Z0-9]+$/.test(url.pathname)) {
      return env.ASSETS.fetch(new URL('/index.html', url));
    }

    return env.ASSETS.fetch(request);
  },
};
