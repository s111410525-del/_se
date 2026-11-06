const state = {
  notes: [],
  q: '',
  filter: 'all',
  color: 'all',
  editing: null,
  selectedColor: 'sand',
  busy: false,
  seq: 0,
};

const region = document.getElementById('notes-region');
const grid = document.getElementById('notes-grid');
const loading = document.getElementById('loading');
const empty = document.getElementById('empty');
const emptyTitle = document.getElementById('empty-title');
const emptyText = document.getElementById('empty-text');
const emptyAction = document.getElementById('empty-action');
const statsEl = document.getElementById('stats');

const searchInput = document.getElementById('search');
const clearSearch = document.getElementById('clear-search');
const chips = [...document.querySelectorAll('[data-filter]')];
const colorDots = [...document.querySelectorAll('.color-filter [data-color]')];
const newButtons = [...document.querySelectorAll('[data-action="new"]')];

const dialog = document.getElementById('note-dialog');
const form = document.getElementById('note-form');
const dialogTitle = document.getElementById('dialog-title');
const titleInput = document.getElementById('note-title');
const contentInput = document.getElementById('note-content');
const pinnedInput = document.getElementById('note-pinned');
const colorButtons = [...document.querySelectorAll('.color-picker [data-color]')];
const counter = document.getElementById('note-counter');
const editorError = document.getElementById('editor-error');
const saveButton = document.getElementById('note-save');
const deleteButton = document.getElementById('note-delete');
const dialogFoot = document.getElementById('dialog-foot');
const deleteConfirm = document.getElementById('delete-confirm');
const deleteCancel = document.getElementById('delete-cancel');
const deleteConfirmButton = document.getElementById('delete-confirm-button');
const toastEl = document.getElementById('toast');

// ---------- 小工具 ----------

const NS = 'http://www.w3.org/2000/svg';

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

function svgIcon(pathData) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}

function pinIcon() {
  return svgIcon(
    'M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z'
  );
}

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';

  const response = await fetch(path, { ...options, headers });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // 非 JSON 回應交給下方 status 處理
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

function isoDate(value) {
  const date = toDate(value);
  return date ? date.toISOString() : undefined;
}

function formatRelative(value) {
  const date = toDate(value);
  if (!date) return '剛剛';

  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '剛剛';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分鐘前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小時前`;
  if (diff < 172_800_000) return '昨天';
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} 天前`;

  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

let toastTimer;

function toast(message, kind = 'success') {
  clearTimeout(toastTimer);
  toastEl.hidden = false;
  toastEl.textContent = message;
  toastEl.className = `toast ${kind === 'error' ? 'error' : ''}`;

  requestAnimationFrame(() => toastEl.classList.add('is-visible'));

  toastTimer = setTimeout(() => {
    toastEl.classList.remove('is-visible');
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 250);
  }, 2800);
}

// ---------- 列表 ----------

function noteCard(note) {
  const hasContent = Boolean(note.content);

  return el(
    'article',
    {
      class: `note-card color-${note.color}${note.pinned ? ' is-pinned' : ''}`,
    },
    el(
      'button',
      {
        class: 'pin-toggle',
        type: 'button',
        'aria-pressed': note.pinned ? 'true' : 'false',
        'aria-label': note.pinned ? '取消釘選' : '釘選這則備忘錄',
        dataset: { id: note.id },
      },
      pinIcon()
    ),
    el(
      'button',
      {
        class: 'note-open',
        type: 'button',
        dataset: { id: note.id },
        'aria-label': `編輯備忘錄：${note.title}`,
      },
      el('h2', {}, note.title),
      el(
        'p',
        { class: hasContent ? 'note-preview' : 'note-preview is-empty' },
        hasContent ? note.content : '沒有內容'
      ),
      el(
        'footer',
        { class: 'note-foot' },
        el('time', { datetime: isoDate(note.updated_at) }, formatRelative(note.updated_at)),
        el('span', { class: 'note-open-hint' }, '編輯')
      )
    )
  );
}

function updateStats(stats) {
  statsEl.textContent = `共 ${stats.total} 則備忘錄 · ${stats.pinned} 則釘選`;
}

function renderNotes() {
  grid.replaceChildren(...state.notes.map(noteCard));

  const hasFilters = Boolean(state.q) || state.filter !== 'all' || state.color !== 'all';

  if (state.notes.length > 0) {
    grid.hidden = false;
    empty.hidden = true;
    return;
  }

  grid.hidden = true;
  empty.hidden = false;

  if (hasFilters) {
    emptyTitle.textContent = '找不到符合的備忘錄';
    emptyText.textContent = '試試其他關鍵字，或清除篩選條件再看一次。';
    emptyAction.textContent = '清除篩選';
    emptyAction.dataset.action = 'clear';
  } else {
    emptyTitle.textContent = '還沒有任何備忘錄';
    emptyText.textContent = '把第一個想法寫下來，它會出現在這裡。';
    emptyAction.textContent = '新增備忘錄';
    emptyAction.dataset.action = 'new';
  }
}

function showLoadError(error) {
  grid.hidden = true;
  empty.hidden = false;
  emptyTitle.textContent = '載入失敗';
  emptyText.textContent = error.message || '請稍後再試一次。';
  emptyAction.textContent = '重新載入';
  emptyAction.dataset.action = 'reload';
  statsEl.textContent = '無法載入備忘錄';
}

async function refresh() {
  const seq = ++state.seq;
  region.setAttribute('aria-busy', 'true');

  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.filter === 'pinned') params.set('pinned', '1');
  if (state.color !== 'all') params.set('color', state.color);
  params.set('limit', '500');

  try {
    const [notes, stats] = await Promise.all([
      api(`/api/notes?${params.toString()}`),
      api('/api/stats'),
    ]);

    if (seq !== state.seq) return;

    state.notes = notes;
    updateStats(stats);
    renderNotes();
  } catch (error) {
    if (seq !== state.seq) return;
    showLoadError(error);
    toast(error.message, 'error');
  } finally {
    if (seq === state.seq) {
      loading.hidden = true;
      region.setAttribute('aria-busy', 'false');
    }
  }
}

function resetFilters() {
  state.q = '';
  state.filter = 'all';
  state.color = 'all';
  searchInput.value = '';
  clearSearch.hidden = true;

  for (const chip of chips) chip.classList.toggle('is-active', chip.dataset.filter === 'all');
  for (const dot of colorDots) dot.classList.toggle('is-active', dot.dataset.color === 'all');

  refresh();
}

// ---------- 編輯器 ----------

function updateColorPicker() {
  for (const button of colorButtons) {
    const active = button.dataset.color === state.selectedColor;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function updateCounter() {
  counter.textContent = `${contentInput.value.length} / 20000`;
}

function openEditor(note) {
  state.editing = note;
  state.selectedColor = note ? note.color : 'sand';
  state.busy = false;

  dialogTitle.textContent = note ? '編輯備忘錄' : '新增備忘錄';
  titleInput.value = note ? note.title : '';
  contentInput.value = note ? note.content : '';
  pinnedInput.checked = note ? Boolean(note.pinned) : false;
  deleteButton.hidden = !note;
  dialogFoot.hidden = false;
  deleteConfirm.hidden = true;
  editorError.textContent = '';

  updateColorPicker();
  updateCounter();

  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => titleInput.focus());
}

// ---------- 事件 ----------

let searchTimer;

searchInput.addEventListener('input', () => {
  state.q = searchInput.value.trim();
  clearSearch.hidden = searchInput.value.length === 0;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 260);
});

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  state.q = '';
  clearSearch.hidden = true;
  searchInput.focus();
  refresh();
});

for (const chip of chips) {
  chip.addEventListener('click', () => {
    state.filter = chip.dataset.filter;
    for (const item of chips) item.classList.toggle('is-active', item === chip);
    refresh();
  });
}

for (const dot of colorDots) {
  dot.addEventListener('click', () => {
    state.color = dot.dataset.color;
    for (const item of colorDots) item.classList.toggle('is-active', item === dot);
    refresh();
  });
}

for (const button of newButtons) {
  button.addEventListener('click', () => openEditor(null));
}

emptyAction.addEventListener('click', () => {
  const action = emptyAction.dataset.action;
  if (action === 'clear') resetFilters();
  else if (action === 'reload') refresh();
  else openEditor(null);
});

grid.addEventListener('click', (event) => {
  const pinButton = event.target.closest('.pin-toggle');
  if (pinButton) {
    event.preventDefault();
    togglePin(Number(pinButton.dataset.id));
    return;
  }

  const openButton = event.target.closest('.note-open');
  if (openButton) {
    const note = state.notes.find((item) => item.id === Number(openButton.dataset.id));
    if (note) openEditor(note);
  }
});

async function togglePin(id) {
  const note = state.notes.find((item) => item.id === id);
  if (!note) return;

  try {
    await api(`/api/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned: !note.pinned }),
    });
    toast(note.pinned ? '已取消釘選' : '已釘選備忘錄');
    await refresh();
  } catch (error) {
    toast(error.message, 'error');
  }
}

for (const button of colorButtons) {
  button.addEventListener('click', () => {
    state.selectedColor = button.dataset.color;
    updateColorPicker();
  });
}

contentInput.addEventListener('input', updateCounter);

for (const button of document.querySelectorAll('#note-dialog [data-close]')) {
  button.addEventListener('click', () => dialog.close());
}

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener('close', () => {
  state.editing = null;
  state.busy = false;
  dialogFoot.hidden = false;
  deleteConfirm.hidden = true;
  editorError.textContent = '';
});

deleteButton.addEventListener('click', () => {
  if (!state.editing) return;
  dialogFoot.hidden = true;
  deleteConfirm.hidden = false;
  deleteConfirmButton.focus();
});

deleteCancel.addEventListener('click', () => {
  deleteConfirm.hidden = true;
  dialogFoot.hidden = false;
  deleteButton.focus();
});

deleteConfirmButton.addEventListener('click', async () => {
  if (!state.editing) return;

  const id = state.editing.id;
  deleteConfirmButton.disabled = true;

  try {
    await api(`/api/notes/${id}`, { method: 'DELETE' });
    dialog.close();
    toast('備忘錄已刪除');
    await refresh();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    deleteConfirmButton.disabled = false;
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title && !content) {
    editorError.textContent = '請輸入標題或內容';
    titleInput.focus();
    return;
  }

  const isEditing = Boolean(state.editing);
  const editingId = state.editing ? state.editing.id : null;

  state.busy = true;
  saveButton.disabled = true;
  saveButton.textContent = '儲存中…';
  editorError.textContent = '';

  try {
    const payload = {
      title: titleInput.value,
      content: contentInput.value,
      color: state.selectedColor,
      pinned: pinnedInput.checked,
    };

    if (isEditing) {
      await api(`/api/notes/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/notes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    dialog.close();
    toast(isEditing ? '備忘錄已更新' : '備忘錄已新增');
    await refresh();
  } catch (error) {
    editorError.textContent = error.message || '儲存失敗，請稍後再試。';
  } finally {
    state.busy = false;
    saveButton.disabled = false;
    saveButton.textContent = '儲存';
  }
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && dialog.open) {
    event.preventDefault();
    form.requestSubmit();
  }
});

refresh();
