const $ = (sel) => document.querySelector(sel);

function setStatus(service, up, message) {
    const el = document.querySelector(`.status[data-service="${service}"]`);
    if (!el) return;
    const dot = el.querySelector('.dot');
    dot.className = 'dot ' + (up ? 'up' : 'down');
    el.querySelector('small').textContent = message;
}

async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

let lastApiDetail = null;

async function refreshStatus() {
    // Nginx（透過它自己的健康檢查端點）
    try {
        const res = await fetch('/healthz', { cache: 'no-store' });
        setStatus('nginx', res.ok, res.ok ? '運行中 (port 80)' : '無回應');
    } catch {
        setStatus('nginx', false, '無回應');
    }

    // Node.js API + 從它取得資料庫狀態
    try {
        const data = await fetchJson('/api/status');
        setStatus('api', true, `Node ${data.runtimeVersion} · up ${data.uptimeSeconds}s`);
        lastApiDetail = data;
        const dbUp = data.database.status === 'up';
        setStatus('db', dbUp, dbUp ? `已連線 (${data.database.name})` : '未連線');
        $('#apiDetail').textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        setStatus('api', false, '無回應');
        setStatus('db', false, '未知');
        $('#apiDetail').textContent = '無法取得 API 狀態：' + err.message;
    }

    // Python Analyzer
    try {
        const info = await fetchJson('/py/info');
        setStatus('python', true, `Python ${info.pythonVersion}`);
    } catch {
        setStatus('python', false, '無回應');
    }

    $('#updated').textContent = new Date().toLocaleTimeString();
}

async function loadNotes() {
    const list = $('#noteList');
    try {
        const data = await fetchJson('/api/notes');
        if (!data.items.length) {
            list.innerHTML = '<li class="muted">目前沒有留言，新增第一筆吧！</li>';
            return;
        }
        list.innerHTML = data.items.map((n) => `
            <li>
                <div>
                    <span class="meta">#${n.id} · ${escapeHtml(n.author)} · ${new Date(n.created_at).toLocaleString()}</span>
                    ${escapeHtml(n.content)}
                </div>
                <button class="del" data-id="${n.id}">刪除</button>
            </li>`).join('');
    } catch (err) {
        list.innerHTML = `<li class="muted">載入失敗：${err.message}</li>`;
    }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

async function addNote(event) {
    event.preventDefault();
    const author = $('#noteAuthor').value.trim();
    const content = $('#noteContent').value.trim();
    if (!content) return;
    await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, content }),
    });
    $('#noteContent').value = '';
    loadNotes();
}

async function deleteNote(id) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    loadNotes();
}

async function analyze() {
    const text = $('#analyzeText').value;
    const box = $('#analyzeResult');
    box.textContent = '分析中…';
    try {
        const data = await fetchJson('/py/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        const top = data.topWords.map((w) => `${w.word} (${w.count})`).join(', ') || '—';
        box.textContent =
            `字元數：${data.characters}\n` +
            `不含空白字元：${data.charactersNoSpaces}\n` +
            `單字數：${data.words}\n` +
            `不重複單字：${data.uniqueWords}\n` +
            `句子數：${data.sentences}\n` +
            `常見詞彙：${top}`;
    } catch (err) {
        box.textContent = '分析失敗：' + err.message;
    }
}

// 事件綁定
$('#noteForm').addEventListener('submit', addNote);
$('#analyzeBtn').addEventListener('click', analyze);
$('#refreshBtn').addEventListener('click', refreshStatus);
$('#noteList').addEventListener('click', (e) => {
    if (e.target.classList.contains('del')) deleteNote(e.target.dataset.id);
});

// 啟動
refreshStatus();
loadNotes();
setInterval(refreshStatus, 5000);
