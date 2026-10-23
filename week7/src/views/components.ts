/** 共用的 HTML 元件：卡片、表格、標籤、表單欄位等。 */
import type { AttrValue } from '../util/html.js';
import { attrs, escapeHtml } from '../util/html.js';

/** 依照語意分類的顏色。 */
export type Tone = 'brand' | 'ok' | 'warn' | 'err' | 'info' | 'muted';

/** 產生一個彩色標籤。 */
export function badge(text: string, tone: Tone = 'brand'): string {
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

/** 依分數範圍挑選標籤顏色。 */
export function scoreTone(score: number): Tone {
  if (score >= 90) return 'ok';
  if (score >= 70) return 'ok';
  if (score >= 60) return 'warn';
  return 'err';
}

/** 卡片容器。 */
export function card(title: string | null, body: string, extra = ''): string {
  const heading = title === null ? '' : `<h2>${escapeHtml(title)}</h2>`;
  return `<section class="card">${heading}${body}${extra}</section>`;
}

/** 統計數字方塊。 */
export function stat(label: string, value: string, hint = '', tone: Tone | '' = ''): string {
  const cls = tone === '' ? 'stat' : `stat ${tone}`;
  const hintHtml = hint === '' ? '' : `<div class="hint">${escapeHtml(hint)}</div>`;
  return `<div class="${cls}"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div>${hintHtml}</div>`;
}

/** 表格。 */
export interface Column<T> {
  header: string;
  /** 對齊方式；`num` 會靠右並使用等寬數字。 */
  align?: 'left' | 'num';
  render: (row: T, index: number) => string;
}

export function table<T>(columns: Column<T>[], rows: T[], options: { caption?: string; empty?: string } = {}): string {
  if (rows.length === 0) {
    return `<p class="empty">${escapeHtml(options.empty ?? '目前沒有資料')}</p>`;
  }
  const head = columns
    .map((col) => `<th class="${col.align === 'num' ? 'num' : ''}">${escapeHtml(col.header)}</th>`)
    .join('');
  const body = rows
    .map((row, index) => {
      const cells = columns
        .map((col) => `<td class="${col.align === 'num' ? 'num' : ''}">${col.render(row, index)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  const caption = options.caption === undefined ? '' : `<caption>${escapeHtml(options.caption)}</caption>`;
  return `<div class="table-wrap"><table>${caption}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** 表單欄位容器。 */
export interface FieldOptions {
  label: string;
  name: string;
  value?: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'date' | 'search';
  hint?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export function field(options: FieldOptions): string {
  const inputAttrs: Record<string, AttrValue> = {
    type: options.type ?? 'text',
    name: options.name,
    id: `f_${options.name}`,
    value: options.value ?? '',
    required: options.required === true,
    placeholder: options.placeholder,
    min: options.min,
    max: options.max,
    disabled: options.disabled === true,
    maxlength: options.required === true ? 120 : undefined,
  };
  return `<div class="field"><label for="f_${escapeHtml(options.name)}">${escapeHtml(options.label)}</label>`
    + `<input${attrs(inputAttrs)}>`
    + (options.hint === undefined ? '' : `<span class="hint">${escapeHtml(options.hint)}</span>`)
    + '</div>';
}

/** 多行文字欄位。 */
export function textareaField(label: string, name: string, value = '', hint?: string): string {
  return `<div class="field"><label for="f_${escapeHtml(name)}">${escapeHtml(label)}</label>`
    + `<textarea id="f_${escapeHtml(name)}" name="${escapeHtml(name)}">${escapeHtml(value)}</textarea>`
    + (hint === undefined ? '' : `<span class="hint">${escapeHtml(hint)}</span>`)
    + '</div>';
}

/** 下拉選單。 */
export interface Option {
  value: string;
  label: string;
}

export function selectField(label: string, name: string, options: Option[], value: string, extra: Record<string, AttrValue> = {}): string {
  const items = options
    .map((option) => {
      const selected = option.value === value;
      return `<option value="${escapeHtml(option.value)}"${selected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`;
    })
    .join('');
  return `<div class="field"><label for="f_${escapeHtml(name)}">${escapeHtml(label)}</label>`
    + `<select id="f_${escapeHtml(name)}" name="${escapeHtml(name)}"${attrs(extra)}>${items}</select></div>`;
}

/** 核取方塊（用於置頂開關）。 */
export function checkboxField(label: string, name: string, checked = false): string {
  return `<label class="field" style="flex-direction:row;align-items:center;gap:8px">`
    + `<input type="checkbox" name="${escapeHtml(name)}" value="1"${checked ? ' checked' : ''} style="width:auto">`
    + `<span>${escapeHtml(label)}</span></label>`;
}

/** 隱藏的 CSRF 權杖欄位；每個 POST 表單都必須帶上。 */
export function csrfInput(token: string): string {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(token)}">`;
}

/** 空資料提示。 */
export function emptyState(text: string): string {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

/** 進度條。 */
export function progress(value: number, max: number): string {
  const ratio = max <= 0 ? 100 : Math.min(100, Math.round((value / max) * 100));
  const done = ratio >= 100;
  return `<div class="progress${done ? ' done' : ''}" title="${ratio}%"><span style="width:${ratio}%"></span></div>`;
}

/** 表格樣式的定義列表（顯示個人資料用）。 */
export function descriptionList(rows: [string, string][]): string {
  const items = rows
    .map(([label, value]) => `<div><dt style="color:#667081;font-size:13px">${escapeHtml(label)}</dt><dd style="margin:0 0 8px;font-weight:600">${value}</dd></div>`)
    .join('');
  return `<dl style="display:grid;gap:2px;margin:0">${items}</dl>`;
}