/** HTML 轉義與顯示格式化工具。 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** 將任意文字轉為可安全嵌入 HTML 的字串。所有使用者輸入都必須經過這裡。 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

export type AttrValue = string | number | boolean | null | undefined;

export function attrs(map: Record<string, AttrValue>): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(map)) {
    if (value === false || value === null || value === undefined) continue;
    if (value === true) {
      parts.push(name);
      continue;
    }
    parts.push(`${name}="${escapeHtml(value)}"`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatDate(iso)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatNumber(value: number): string {
  return Math.trunc(value).toLocaleString('zh-TW');
}

/** 金額顯示；求職平台以整數新台幣為主。 */
export function formatMoney(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `NT$ ${rounded.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`;
}

/** 月薪區間；若未提供則顯示面議。 */
export function formatSalary(min: number, max: number, note = ''): string {
  if (note.trim() !== '') return note.trim();
  if (min <= 0 && max <= 0) return '面議';
  const low = min > 0 ? formatMoney(min) : '依公司規定';
  if (max <= 0 || max === min) return `${low} / 月`;
  return `${low} – ${formatMoney(max)} / 月`;
}

/** 將長文字截短，避免卡片被撐開。 */
export function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
}

/** 把 `a b c`、`a,b` 或 `a、b` 切成陣列。 */
export function splitTokens(value: string): string[] {
  return value
    .split(/[\s,、]+/u)
    .map((token) => token.trim())
    .filter((token) => token !== '');
}

/** 依字串產生穩定的 0～4 色票索引。 */
export function colorIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 5;
}

/** 把純文字內容轉成段落 HTML（先轉義，再保留換行）。 */
export function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter((block) => block !== '')
    .map((block) => `<p>${escapeHtml(block).replace(/\n/gu, '<br>')}</p>`)
    .join('\n');
}

/** 相對時間，例如「3 小時前」。 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 個月前`;
  return `${Math.floor(months / 12)} 年前`;
}
