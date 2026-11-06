// edgeblog — Cloudflare Worker
//
//   /api/posts                 文章列表（D1）
//   /api/posts/:slug           單篇文章（D1）
//   /api/posts/:slug/comments  留言列表 / 新增留言（D1）
//   /api/files                 R2 檔案列表
//   /api/files/:key            R2 檔案下載（支援 Range）
//   其他                       靜態資產（public/），SPA 由前端路由處理

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

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

function decodeParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(400, '網址格式不正確');
  }
}

function validSlug(slug) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    throw new HttpError(404, '找不到這篇文章');
  }
  return slug;
}

async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) {
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

function requireDB(env) {
  if (!env.DB) throw new HttpError(500, '伺服器缺少 D1 綁定 DB');
  return env.DB;
}

function requireBucket(env) {
  if (!env.BUCKET) throw new HttpError(500, '伺服器缺少 R2 綁定 BUCKET');
  return env.BUCKET;
}

// ---------- 文章 ----------

async function listPosts(env, url) {
  const db = requireDB(env);
  const requested = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 50) : 20;

  const { results } = await db
    .prepare(
      `SELECT p.id, p.slug, p.title, p.excerpt, p.created_at,
              (SELECT COUNT(*) FROM comments c
                WHERE c.post_id = p.id AND c.status = 'visible') AS comment_count
         FROM posts p
        WHERE p.status = 'published'
        ORDER BY datetime(p.created_at) DESC, p.id DESC
        LIMIT ?`
    )
    .bind(limit)
    .all();

  return ok(results);
}

async function getPost(env, slug) {
  const db = requireDB(env);
  const post = await db
    .prepare(
      `SELECT p.id, p.slug, p.title, p.excerpt, p.body, p.created_at,
              (SELECT COUNT(*) FROM comments c
                WHERE c.post_id = p.id AND c.status = 'visible') AS comment_count
         FROM posts p
        WHERE p.slug = ? AND p.status = 'published'`
    )
    .bind(slug)
    .first();

  if (!post) throw new HttpError(404, '找不到這篇文章');
  return ok(post);
}

// ---------- 留言 ----------

async function findPostId(env, slug) {
  const db = requireDB(env);
  const post = await db
    .prepare("SELECT id FROM posts WHERE slug = ? AND status = 'published'")
    .bind(slug)
    .first();
  if (!post) throw new HttpError(404, '找不到這篇文章');
  return post.id;
}

async function listComments(env, slug) {
  const db = requireDB(env);
  const postId = await findPostId(env, slug);
  const { results } = await db
    .prepare(
      `SELECT id, author, body, created_at
         FROM comments
        WHERE post_id = ? AND status = 'visible'
        ORDER BY id ASC`
    )
    .bind(postId)
    .all();
  return ok(results);
}

async function createComment(request, env, slug) {
  const db = requireDB(env);
  const postId = await findPostId(env, slug);
  const input = await readJson(request);

  const author = String(input.author ?? '').replace(/\s+/g, ' ').trim();
  const body = String(input.body ?? '').replace(/\r\n?/g, '\n').trim();

  if (!author) throw new HttpError(400, '請留下暱稱');
  if (author.length > 30) throw new HttpError(400, '暱稱最多 30 個字');
  if (!body) throw new HttpError(400, '留言不能是空的');
  if (body.length > 500) throw new HttpError(400, '留言最多 500 個字');

  const result = await db
    .prepare('INSERT INTO comments (post_id, author, body) VALUES (?, ?, ?)')
    .bind(postId, author, body)
    .run();

  const comment = await db
    .prepare('SELECT id, author, body, created_at FROM comments WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first();

  return ok(comment, 201);
}

// ---------- 檔案（R2）----------

async function listFiles(env) {
  const bucket = requireBucket(env);
  const files = [];
  let cursor;

  do {
    const page = await bucket.list({ limit: 1000, cursor });
    for (const object of page.objects) {
      files.push({
        key: object.key,
        size: object.size,
        uploaded: object.uploaded instanceof Date ? object.uploaded.toISOString() : null,
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  files.sort((a, b) => {
    const byDate = String(b.uploaded || '').localeCompare(String(a.uploaded || ''));
    return byDate || a.key.localeCompare(b.key);
  });

  return ok(files);
}

const CONTENT_TYPES = {
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  html: 'text/html; charset=utf-8',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  zip: 'application/zip',
};

function guessType(key) {
  const ext = key.split('.').pop().toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function contentDisposition(key) {
  const name = key.split('/').pop() || 'download';
  const fallback = name
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\\r\n]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

async function downloadFile(request, env, key) {
  const bucket = requireBucket(env);

  if (!key || key.length > 512 || key.startsWith('/') || key.includes('\0')) {
    throw new HttpError(400, '檔案名稱不正確');
  }

  const range = request.headers.get('Range');
  const object = await bucket.get(key, range ? { range: request.headers } : undefined);
  if (!object) throw new HttpError(404, '找不到這個檔案');

  const headers = new Headers();
  if (typeof object.writeHttpMetadata === 'function') object.writeHttpMetadata(headers);

  if (!headers.get('Content-Type')) headers.set('Content-Type', guessType(key));
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Disposition', contentDisposition(key));
  if (object.httpEtag) headers.set('ETag', object.httpEtag);

  let status = 200;
  if (range && object.range) {
    const { offset, length } = object.range;
    const end = offset + length - 1;
    headers.set('Content-Range', `bytes ${offset}-${end}/${object.size}`);
    headers.set('Content-Length', String(length));
    status = 206;
  } else {
    headers.set('Content-Type', headers.get('Content-Type') || guessType(key));
    headers.set('Content-Length', String(object.size));
  }

  const body = request.method === 'HEAD' ? null : object.body;
  return new Response(body, { status, headers });
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
        bindings: { db: Boolean(env.DB), bucket: Boolean(env.BUCKET) },
        time: new Date().toISOString(),
      });
    }

    if (path === '/api/posts') {
      if (method !== 'GET') throw new HttpError(405, '這個方法不被允許');
      return await listPosts(env, url);
    }

    let match = path.match(/^\/api\/posts\/([^/]+)\/comments$/);
    if (match) {
      const slug = validSlug(decodeParam(match[1]));
      if (method === 'GET') return await listComments(env, slug);
      if (method === 'POST') return await createComment(request, env, slug);
      throw new HttpError(405, '這個方法不被允許');
    }

    match = path.match(/^\/api\/posts\/([^/]+)$/);
    if (match) {
      if (method !== 'GET') throw new HttpError(405, '這個方法不被允許');
      return await getPost(env, validSlug(decodeParam(match[1])));
    }

    if (path === '/api/files') {
      if (method !== 'GET') throw new HttpError(405, '這個方法不被允許');
      return await listFiles(env);
    }

    if (path.startsWith('/api/files/')) {
      if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, '這個方法不被允許');
      return await downloadFile(request, env, decodeParam(path.slice('/api/files/'.length)));
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

    // 沒有副檔名的路徑交給前端路由（例如 /posts/hello-edge）。
    if (!/\.[a-zA-Z0-9]+$/.test(url.pathname)) {
      return env.ASSETS.fetch(new URL('/index.html', url));
    }

    return env.ASSETS.fetch(request);
  },
};
