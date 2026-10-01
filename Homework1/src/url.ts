import type { HeaderList } from './types.js';

export class RequestError extends Error {
  /** 對應 curl 的 exit code。 */
  readonly exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'RequestError';
    this.exitCode = exitCode;
  }
}

export interface NormalizedUrl {
  href: string;
  protocol: 'http:' | 'https:';
  hostname: string;
  port: number;
  /** 包含 query 的 path（一定是 `/` 開頭）。 */
  path: string;
  origin: string;
}

const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 };

/** 補上預設協定、正規化路徑，輸出可直接送給 http.request 的參數。 */
export function normalizeUrl(raw: string): NormalizedUrl {
  let candidate = raw.trim();
  if (candidate === '') throw new RequestError('URL 為空', 3);
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `http://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch (err) {
    throw new RequestError(`無法解析 URL: ${raw} (${(err as Error).message})`, 3);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RequestError(`不支援的協定: ${url.protocol}（僅支援 http/https）`, 1);
  }
  if (url.hostname === '') throw new RequestError(`URL 缺少主機名稱: ${raw}`, 3);

  const port = url.port === '' ? DEFAULT_PORTS[url.protocol]! : Number(url.port);
  const path = url.pathname === '' ? '/' : url.pathname + url.search;

  return {
    href: `${url.protocol}//${url.host}${path}`,
    protocol: url.protocol,
    hostname: url.hostname,
    port,
    path,
    origin: `${url.protocol}//${url.hostname}:${port}`,
  };
}

/** 把查詢參數接到既有 query string 上。 */
export function appendQuery(basePath: string, query: string): string {
  if (query === '') return basePath;
  const hashIdx = basePath.indexOf('#');
  const hash = hashIdx === -1 ? '' : basePath.slice(hashIdx);
  const withoutHash = hashIdx === -1 ? basePath : basePath.slice(0, hashIdx);
  const sep = withoutHash.includes('?') ? '&' : '?';
  return `${withoutHash}${sep}${query}${hash}`;
}

/** 從 URL 推導出檔名（-O / --remote-header-name）。 */
export function filenameFromUrl(href: string): string | undefined {
  try {
    const url = new URL(href);
    const last = url.pathname.split('/').filter(Boolean).pop();
    if (!last) return undefined;
    return decodeURIComponent(last);
  } catch {
    return undefined;
  }
}

/** 解析 Content-Disposition: attachment; filename="x.bin" */
export function filenameFromContentDisposition(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(value);
  if (star?.[2]) {
    try {
      return decodeURIComponent(star[2].trim().replace(/^"|"$/g, ''));
    } catch {
      /* 落到一般解析 */
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(value);
  const raw = plain?.[2] ?? plain?.[1];
  return raw ? raw.trim() : undefined;
}

/** 從 rawHeaders 陣列組出保序的 HeaderList。 */
export function rawHeadersToList(rawHeaders: string[]): HeaderList {
  const list: HeaderList = [];
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const name = rawHeaders[i];
    const value = rawHeaders[i + 1];
    if (name !== undefined && value !== undefined) list.push([name, value]);
  }
  return list;
}

/** 合併重複的標頭（cookie / set-cookie 為逗號或分號分隔）。 */
export function getHeader(headers: HeaderList, name: string): string | undefined {
  const lower = name.toLowerCase();
  const values = headers.filter(([k]) => k.toLowerCase() === lower).map(([, v]) => v);
  return values.length === 0 ? undefined : values.join(', ');
}

/** 移除指定標頭，回傳新的 HeaderList。 */
export function removeHeader(headers: HeaderList, name: string): HeaderList {
  const lower = name.toLowerCase();
  return headers.filter(([k]) => k.toLowerCase() !== lower);
}

export function hasHeader(headers: HeaderList, name: string): boolean {
  const lower = name.toLowerCase();
  return headers.some(([k]) => k.toLowerCase() === lower);
}
