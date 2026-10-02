/** HTML 轉義與顯示用格式化工具。 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * 將任意文字轉為可安全嵌入 HTML 的字串。
 *
 * 所有來自使用者輸入的內容都必須經過這個函式，是本專案防護 XSS 的第一道防線。
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

/** HTML 屬性值。 */
export type AttrValue = string | number | boolean | null | undefined;

/** 把屬性物件轉換成 HTML 屬性字串；`false` 與 `null` 的屬性會被省略。 */
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

/** 將 ISO 時間字串格式化為 `2026/01/02`。 */
export function formatDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

/** 將 ISO 時間字串格式化為 `2026/01/02 14:05`。 */
export function formatDateTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 千分位數字。 */
export function formatNumber(value: number): string {
  return value.toLocaleString('zh-TW');
}

/** 金額顯示（不含幣別符號）。 */
export function formatMoney(value: number): string {
  return `NT$ ${formatNumber(value)}`;
}

/** 分數顯示，補上小數位並去掉多餘的 0。 */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** 把 `a b c` 這種以空白分隔的字串切成陣列。 */
export function splitTokens(value: string): string[] {
  return value.split(/[\s,]+/u).map((token) => token.trim()).filter((token) => token !== '');
}