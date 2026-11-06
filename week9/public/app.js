const app = document.getElementById('main');
const navLinks = [...document.querySelectorAll('.site-nav a[data-nav]')];

let viewToken = 0;

// ---------- 小工具 ----------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }

  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';

  const response = await fetch(path, { ...options, headers });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // 忽略非 JSON 回應，下方會用 HTTP status 產生錯誤
  }

  if (!response.ok) {
    throw new Error((payload && payload.error) || `請求失敗（HTTP ${response.status}）`);
  }

  return payload ? payload.data : null;
}

function toDate(value) {
  if (!value) return null;
  const raw = String(value);
  const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function isoDate(value) {
  const date = toDate(value);
  return date ? date.toISOString() : undefined;
}

function formatSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return '—';
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function fileBadge(key) {
  const base = String(key).split('/').pop() || '';
  const ext = base.includes('.') ? base.split('.').pop() : '';
  return (ext || 'FILE').slice(0, 4).toUpperCase();
}

function setActiveNav(path) {
  const key = path.startsWith('/posts/') ? '/' : path;
  for (const link of navLinks) {
    if (link.dataset.nav === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function loadingView() {
  return el(
    'div',
    { class: 'loading' },
    el('span', { class: 'spinner', 'aria-hidden': 'true' }),
    '載入中…'
  );
}

function errorView(error) {
  return el(
    'div',
    { class: 'view' },
    el(
      'div',
      { class: 'error-panel' },
      el('h1', {}, '畫面載入失敗'),
      el('p', {}, error.message || '發生未知的錯誤，請稍後再試。'),
      el(
        'button',
        {
          class: 'button',
          type: 'button',
          onclick: () => render(location.pathname + location.search),
        },
        '重新載入'
      )
    )
  );
}

function notFoundView() {
  return el(
    'div',
    { class: 'view' },
    el(
      'div',
      { class: 'error-panel' },
      el('h1', {}, '找不到這一頁'),
      el('p', {}, '網址可能打錯了，或這篇文章已經被移除。'),
      el('a', { class: 'button', href: '/' }, '回到首頁')
    )
  );
}

// ---------- 文章列表 ----------

function postCard(post, featured = false) {
  const href = `/posts/${encodeURIComponent(post.slug)}`;
  const comments = Number(post.comment_count) || 0;

  return el(
    'article',
    { class: featured ? 'post-card featured' : 'post-card' },
    el(
      'p',
      { class: 'card-meta' },
      el('time', { datetime: isoDate(post.created_at) }, formatDate(post.created_at)),
      el('span', { class: 'dot', 'aria-hidden': 'true' }),
      el('span', {}, comments === 0 ? '還沒有留言' : `${comments} 則留言`)
    ),
    el('h2', {}, el('a', { href }, post.title)),
    post.excerpt ? el('p', { class: 'excerpt' }, post.excerpt) : null,
    el(
      'div',
      { class: 'card-foot' },
      el('span', {}, featured ? '編輯精選' : '閱讀全文'),
      el(
        'a',
        { class: 'read-more', href, 'aria-label': `閱讀：${post.title}` },
        '繼續閱讀',
        el('span', { 'aria-hidden': 'true' }, '→')
      )
    )
  );
}

async function renderHome(token) {
  document.title = '邊緣筆記 · Edge Notes';
  const posts = await api('/api/posts?limit=50');
  if (token !== viewToken) return;

  const view = el(
    'div',
    { class: 'view' },
    el(
      'section',
      { class: 'hero' },
      el('p', { class: 'eyebrow' }, 'Cloudflare Workers · D1 · R2'),
      el('h1', {}, '把想法寫在離讀者', el('em', {}, '最近的節點'), '。'),
      el(
        'p',
        { class: 'lede' },
        '一個在邊緣運行的部落格：文章與留言存在 D1，檔案放在 R2，前端由全球節點直接快取。沒有主機要維護，只有你想寫的故事。'
      ),
      el(
        'div',
        { class: 'hero-links' },
        el('a', { class: 'button', href: '/files' }, '看看可下載的檔案'),
        el('a', { class: 'button ghost', href: '/about' }, '這個網站怎麼做的')
      )
    )
  );

  if (posts.length === 0) {
    view.append(
      el(
        'div',
        { class: 'empty' },
        el('strong', {}, '資料庫裡還沒有文章'),
        '執行 npm run seed:local 匯入範例文章，或直接寫入 D1。'
      )
    );
    app.replaceChildren(view);
    app.focus({ preventScroll: true });
    return;
  }

  const [featured, ...rest] = posts;
  const grid = el('div', { class: 'post-grid' }, postCard(featured, true), ...rest.map((p) => postCard(p)));

  view.append(
    el(
      'section',
      { 'aria-labelledby': 'latest-heading' },
      el(
        'div',
        { class: 'section-head' },
        el('h2', { id: 'latest-heading' }, '最新文章'),
        el('span', { class: 'count' }, `${posts.length} 篇`)
      ),
      grid
    )
  );

  app.replaceChildren(view);
  app.focus({ preventScroll: true });
}

// ---------- 單篇文章與留言 ----------

function commentNode(comment) {
  return el(
    'article',
    { class: 'comment' },
    el(
      'header',
      {},
      el('strong', {}, comment.author),
      el('time', { datetime: isoDate(comment.created_at) }, formatDateTime(comment.created_at))
    ),
    el('p', {}, comment.body)
  );
}

function commentsSection(post, comments) {
  let count = comments.length;

  const list = el(
    'div',
    { class: 'comment-list' },
    count === 0
      ? el('div', { class: 'empty' }, el('strong', {}, '還沒有留言'), '成為第一個留言的人吧。')
      : comments.map(commentNode)
  );

  const countLabel = el('span', { class: 'count' }, `${count} 則留言`);

  const nameInput = el('input', {
    id: 'comment-author',
    name: 'author',
    type: 'text',
    maxlength: '30',
    required: true,
    autocomplete: 'nickname',
    placeholder: '你的暱稱',
  });

  const bodyInput = el('textarea', {
    id: 'comment-body',
    name: 'body',
    maxlength: '500',
    required: true,
    rows: '4',
    placeholder: '寫下你的想法…',
  });

  const status = el('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const submit = el('button', { class: 'button', type: 'submit' }, '送出留言');

  const form = el(
    'form',
    { class: 'comment-form' },
    el('h3', {}, '留下你的想法'),
    el(
      'div',
      { class: 'field' },
      el('label', { for: 'comment-author' }, '暱稱'),
      nameInput
    ),
    el(
      'div',
      { class: 'field' },
      el('label', { for: 'comment-body' }, '留言'),
      bodyInput
    ),
    el(
      'div',
      { class: 'form-row' },
      status,
      submit
    )
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.className = 'form-status';
    status.textContent = '送出中…';

    try {
      const created = await api(`/api/posts/${encodeURIComponent(post.slug)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ author: nameInput.value, body: bodyInput.value }),
      });

      const empty = list.querySelector('.empty');
      if (empty) empty.remove();
      list.append(commentNode(created));

      count += 1;
      countLabel.textContent = `${count} 則留言`;
      bodyInput.value = '';
      status.className = 'form-status success';
      status.textContent = '留言已送出，謝謝你！';
    } catch (error) {
      status.className = 'form-status error';
      status.textContent = error.message || '送出失敗，請稍後再試。';
    } finally {
      submit.disabled = false;
    }
  });

  return el(
    'section',
    { class: 'comments', 'aria-labelledby': 'comments-heading' },
    el(
      'div',
      { class: 'section-head' },
      el('h2', { id: 'comments-heading' }, '留言'),
      countLabel
    ),
    list,
    form
  );
}

function bodyNodes(body) {
  return String(body || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => el('p', {}, paragraph));
}

async function renderPost(token, slug) {
  const encoded = encodeURIComponent(slug);
  const [post, comments] = await Promise.all([
    api(`/api/posts/${encoded}`),
    api(`/api/posts/${encoded}/comments`),
  ]);
  if (token !== viewToken) return;

  document.title = `${post.title} · 邊緣筆記`;

  const view = el(
    'div',
    { class: 'view' },
    el('a', { class: 'back-link', href: '/' }, '← 回文章列表'),
    el(
      'article',
      { class: 'article' },
      el(
        'header',
        { class: 'article-header' },
        el(
          'p',
          { class: 'article-meta' },
          el('time', { datetime: isoDate(post.created_at) }, formatDate(post.created_at)),
          el('span', { class: 'dot', 'aria-hidden': 'true' }),
          el('span', {}, comments.length === 0 ? '還沒有留言' : `${comments.length} 則留言`)
        ),
        el('h1', {}, post.title),
        post.excerpt ? el('p', { class: 'article-excerpt' }, post.excerpt) : null
      ),
      el('div', { class: 'article-body' }, bodyNodes(post.body))
    ),
    commentsSection(post, comments)
  );

  app.replaceChildren(view);
  app.focus({ preventScroll: true });
}

// ---------- 檔案下載 ----------

function fileRow(file) {
  const href = `/api/files/${encodeURIComponent(file.key)}`;
  const name = String(file.key).split('/').pop() || file.key;

  return el(
    'li',
    { class: 'file-row' },
    el('span', { class: 'file-badge', 'aria-hidden': 'true' }, fileBadge(file.key)),
    el(
      'div',
      { class: 'file-info' },
      el('strong', { title: file.key }, name),
      el('span', {}, `${formatSize(file.size)} · 上傳於 ${formatDate(file.uploaded)}`)
    ),
    el('a', { class: 'button small ghost', href, download: name }, '下載')
  );
}

async function renderFiles(token) {
  document.title = '檔案下載 · 邊緣筆記';
  const files = await api('/api/files');
  if (token !== viewToken) return;

  const view = el(
    'div',
    { class: 'view' },
    el(
      'header',
      { class: 'files-intro' },
      el('p', { class: 'eyebrow' }, 'R2 Object Storage'),
      el('h1', {}, '檔案下載'),
      el(
        'p',
        { class: 'lede' },
        '這裡的檔案放在 Cloudflare R2，透過 Worker 串流下載。大型檔案也支援 HTTP Range，瀏覽器可以續傳。'
      )
    )
  );

  if (files.length === 0) {
    view.append(
      el(
        'div',
        { class: 'empty' },
        el('strong', {}, '目前沒有檔案'),
        '用 wrangler r2 object put 上傳檔案後，重新整理即可看到。'
      )
    );
  } else {
    view.append(
      el(
        'div',
        { class: 'section-head' },
        el('h2', {}, '全部檔案'),
        el('span', { class: 'count' }, `${files.length} 個`)
      ),
      el('ul', { class: 'file-list' }, files.map(fileRow))
    );
  }

  app.replaceChildren(view);
  app.focus({ preventScroll: true });
}

// ---------- 關於 ----------

async function renderAbout(token) {
  document.title = '關於 · 邊緣筆記';
  if (token !== viewToken) return;

  const view = el(
    'div',
    { class: 'view' },
    el(
      'article',
      { class: 'about' },
      el('p', { class: 'eyebrow' }, 'About this site'),
      el('h1', {}, '一個最小的全端邊緣網站'),
      el(
        'p',
        {},
        '邊緣筆記是為了練習 Cloudflare 開發者平台而做的專案。它把書中的三合一網站——部落格、留言板、檔案下載——壓縮成一個自包含的 Worker 專案：clone、安裝、建表、部署，四個步驟就能上線。'
      ),
      el('h2', {}, '技術堆疊'),
      el(
        'ul',
        {},
        el('li', {}, el('strong', {}, 'Cloudflare Workers'), '：處理 /api/* 請求和 SPA 回退，使用 V8 Isolate，冷啟動極低。'),
        el('li', {}, el('strong', {}, 'D1'), '：儲存文章與留言，用參數化 SQL 查詢，資料表有 CHECK 約束作為最後防線。'),
        el('li', {}, el('strong', {}, 'R2'), '：儲存可下載檔案，Worker 以串流回應，支援 Range 續傳。'),
        el('li', {}, el('strong', {}, 'Static Assets'), '：HTML、CSS、JavaScript 由邊緣直接快取，不經過 Worker。')
      ),
      el('h2', {}, 'API'),
      el(
        'pre',
        { class: 'code-block' },
        'GET  /api/posts\n' +
          'GET  /api/posts/:slug\n' +
          'GET  /api/posts/:slug/comments\n' +
          'POST /api/posts/:slug/comments\n' +
          'GET  /api/files\n' +
          'GET  /api/files/:key\n' +
          'GET  /api/health'
      ),
      el('h2', {}, '設計取捨'),
      el(
        'p',
        {},
        '這個專案刻意保持小：沒有會員系統、沒有後台編輯器、沒有圖片上傳。文章用 SQL 寫入，留言用暱稱辨識，檔案用 wrangler 上傳。把範圍縮小，才能把每一個環節講清楚。'
      ),
      el(
        'p',
        {},
        '安全上，前端只用 textContent 輸出內容以避免 XSS；後端驗證長度與型別、使用 D1 參數化查詢、下載時限制 key 格式。免費方案若要公開上線，建議再加上 Turnstile 與 Rate Limiting 規則。'
      ),
      el(
        'div',
        { class: 'fact-grid' },
        el('div', { class: 'fact' }, el('span', {}, 'Runtime'), el('strong', {}, 'Workers')),
        el('div', { class: 'fact' }, el('span', {}, 'Database'), el('strong', {}, 'D1 · SQLite')),
        el('div', { class: 'fact' }, el('span', {}, 'Storage'), el('strong', {}, 'R2 · Stream'))
      )
    )
  );

  app.replaceChildren(view);
  app.focus({ preventScroll: true });
}

// ---------- 路由 ----------

async function render(path) {
  const token = ++viewToken;
  setActiveNav(new URL(path, location.origin).pathname);
  app.replaceChildren(loadingView());

  try {
    const url = new URL(path, location.origin);
    const pathname = url.pathname;

    if (pathname === '/') return await renderHome(token);
    if (pathname === '/files') return await renderFiles(token);
    if (pathname === '/about') return await renderAbout(token);

    const match = pathname.match(/^\/posts\/([^/]+)$/);
    if (match) {
      return await renderPost(token, decodeURIComponent(match[1]));
    }

    if (token === viewToken) {
      document.title = '找不到頁面 · 邊緣筆記';
      app.replaceChildren(notFoundView());
    }
  } catch (error) {
    if (token !== viewToken) return;
    document.title = '發生錯誤 · 邊緣筆記';
    app.replaceChildren(errorView(error));
  }
}

function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);

  window.scrollTo(0, 0);
  render(path);
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const anchor = event.target.closest('a');
  if (!anchor) return;
  if (anchor.target && anchor.target !== '_self') return;
  if (anchor.hasAttribute('download')) return;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.preventDefault();
  navigate(url.pathname + url.search + url.hash);
});

window.addEventListener('popstate', () => {
  render(location.pathname + location.search);
});

render(location.pathname + location.search);
