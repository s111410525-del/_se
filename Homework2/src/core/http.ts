import type { IncomingMessage, ServerResponse } from 'node:http';
import { badRequest } from './errors.js';

/** 預設的表單內文上限，避免有人送出超大請求。 */
export const MAX_BODY_BYTES = 64 * 1024;

/** 解析 `Cookie` 標頭成鍵值對。 */
export function parseCookies(header: string | undefined): Map<string, string> {
  const jar = new Map<string, string>();
  if (header === undefined) return jar;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name !== '') jar.set(name, decodeURIComponent(value));
  }
  return jar;
}

export interface CookieOptions {
  /** 存活時間（秒）。省略則為工作階段 Cookie。 */
  maxAge?: number;
  httpOnly?: boolean;
  sameSite?: 'Lax' | 'Strict';
}

/** 寫出一個 `Set-Cookie` 標頭。 */
export function appendCookie(res: ServerResponse, name: string, value: string, options: CookieOptions = {}): void {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.sameSite === 'Strict') parts[parts.length - 1] = 'SameSite=Strict';

  const existing = res.getHeader('Set-Cookie');
  const list: string[] = Array.isArray(existing)
    ? existing.map((item) => String(item))
    : existing === undefined
      ? []
      : [String(existing)];
  list.push(parts.join('; '));
  res.setHeader('Set-Cookie', list);
}

/** 讓瀏覽器立刻刪除指定 Cookie。 */
export function clearCookie(res: ServerResponse, name: string): void {
  appendCookie(res, name, '', { maxAge: 0 });
}

/** 讀取並串接整個請求內文。 */
export async function readBody(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(badRequest(`請求內容超過 ${limit} 位元組上限`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve());
    req.on('error', (err: Error) => reject(err));
  });

  return Buffer.concat(chunks);
}

/** 將 `application/x-www-form-urlencoded` 的內文解析成欄位集合。 */
export async function readForm(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<URLSearchParams> {
  const type = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type !== '' && type !== 'application/x-www-form-urlencoded') {
    throw badRequest(`不支援的 Content-Type: ${type}`);
  }
  const body = await readBody(req, limit);
  return new URLSearchParams(body.toString('utf8'));
}

/** 讀出 JSON 內文。 */
export async function readJson(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<unknown> {
  const body = await readBody(req, limit);
  if (body.length === 0) return null;
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw badRequest('JSON 格式錯誤');
  }
}

/** 送出回應。 */
export function send(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string,
  headers: Record<string, string> = {},
): void {
  const buffer = Buffer.from(body, 'utf8');
  res.writeHead(status, {
    'Content-Type': `${contentType}; charset=utf-8`,
    'Content-Length': String(buffer.length),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    // 校務系統頁面含個人資料，禁止被搜尋引擎或中間快取留存。
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(buffer);
}