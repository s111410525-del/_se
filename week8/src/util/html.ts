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

/** 金額顯示，有零錢時保留最多兩位小數。 */
export function formatMoney(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `NT$ ${rounded.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`;
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

/** 依字串產生穩定的 0～4 色票索引，讓封面顏色不會每次重新整理都變。 */
export function colorIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 5;
}

/** 把純文字內容轉成段落 HTML（先轉義，再保留空行）。 */
export function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter((block) => block !== '')
    .map((block) => `<p>${escapeHtml(block).replace(/\n/gu, '<br>')}</p>`)
    .join('\n');
}
