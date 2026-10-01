import fs from 'node:fs';
import crypto from 'node:crypto';
import { RequestError } from './url.js';
import type { FormField, HeaderList, Options } from './types.js';
import { setHeader } from './args.js';
import { getHeader, hasHeader } from './url.js';

export interface RequestBody {
  buffer: Buffer;
  contentType?: string;
}

function randomBoundary(): string {
  return `------------------------${crypto.randomBytes(12).toString('hex')}`;
}

/** 猜測檔案的 Content-Type。 */
function guessContentType(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  const table: Record<string, string> = {
    txt: 'text/plain', html: 'text/html', htm: 'text/html', css: 'text/css',
    csv: 'text/csv', json: 'application/json', xml: 'application/xml',
    js: 'application/javascript', mjs: 'application/javascript',
    pdf: 'application/pdf', zip: 'application/zip', gz: 'application/gzip',
    tar: 'application/x-tar', png: 'image/png', jpg: 'image/jpeg',
    jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml',
    webp: 'image/webp', ico: 'image/x-icon', mp4: 'video/mp4',
    mp3: 'audio/mpeg', wav: 'audio/wav', bin: 'application/octet-stream',
  };
  return table[ext] ?? 'application/octet-stream';
}

function readFileOrThrow(path: string, what: string): Buffer {
  try {
    return fs.readFileSync(path);
  } catch (err) {
    throw new RequestError(`無法讀取${what} ${path}: ${(err as Error).message}`, 26);
  }
}

/** 建立 multipart/form-data 內文。 */
function buildMultipart(forms: FormField[], headers: HeaderList): RequestBody {
  const boundary = randomBoundary();
  const parts: Buffer[] = [];

  for (const field of forms) {
    parts.push(Buffer.from(`--${boundary}\r\n`, 'utf8'));
    if (field.file) {
      const content = readFileOrThrow(field.file.path, '上傳檔案');
      const filename = field.file.path.split(/[\\/]/).pop() ?? field.file.path;
      const disposition = field.file.mode === 'upload'
        ? `form-data; name="${field.name}"; filename="${filename}"`
        : `form-data; name="${field.name}"`;
      parts.push(Buffer.from(`Content-Disposition: ${disposition}\r\n`, 'utf8'));
      if (field.file.mode === 'upload') {
        parts.push(Buffer.from(`Content-Type: ${guessContentType(field.file.path)}\r\n`, 'utf8'));
      }
      parts.push(Buffer.from('\r\n', 'utf8'));
      parts.push(content);
    } else {
      parts.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`, 'utf8'));
      parts.push(Buffer.from(field.value, 'utf8'));
    }
    parts.push(Buffer.from('\r\n', 'utf8'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));

  if (!hasHeader(headers, 'content-type')) {
    setHeader(headers, 'Content-Type', `multipart/form-data; boundary=${boundary}`);
  }
  return { buffer: Buffer.concat(parts) };
}

/** 決定最終的請求內文，並補上必要的 Content-Type。 */
export function buildRequestBody(options: Options, headers: HeaderList): RequestBody | undefined {
  if (options.forms.length > 0) {
    return buildMultipart(options.forms, headers);
  }

  if (options.uploadFile !== undefined) {
    if (options.uploadFile === '-') {
      let stdin: Buffer;
      try {
        stdin = fs.readFileSync(0);
      } catch {
        stdin = Buffer.alloc(0);
      }
      return { buffer: stdin };
    }
    const content = readFileOrThrow(options.uploadFile, '上傳檔案');
    if (!hasHeader(headers, 'content-type')) {
      setHeader(headers, 'Content-Type', guessContentType(options.uploadFile));
    }
    return { buffer: content };
  }

  if (options.json !== undefined) {
    if (!hasHeader(headers, 'content-type')) {
      setHeader(headers, 'Content-Type', 'application/json');
    }
    if (!hasHeader(headers, 'accept')) {
      setHeader(headers, 'Accept', 'application/json');
    }
    return { buffer: Buffer.from(options.json, 'utf8') };
  }

  if (options.data) {
    const buffer = Buffer.concat(options.data.chunks);
    if (options.data.mode === 'urlencode') {
      if (!hasHeader(headers, 'content-type')) {
        setHeader(headers, 'Content-Type', 'application/x-www-form-urlencoded');
      }
    } else if (!hasHeader(headers, 'content-type') && buffer.length > 0) {
      setHeader(headers, 'Content-Type', 'application/x-www-form-urlencoded');
    }
    return { buffer, contentType: getHeader(headers, 'content-type') };
  }

  return undefined;
}

/** 產生 Cookie 標頭值。 */
export function buildCookieHeader(cookies: string[], jar: Map<string, string>): string {
  const pairs: string[] = [];
  for (const item of cookies) {
    // 允許 `-b name=value` 或 `-b name=value; other=1` 或純檔名
    if (item.includes('=')) pairs.push(item);
    else {
      const value = jar.get(item);
      if (value !== undefined) pairs.push(`${item}=${value}`);
    }
  }
  for (const [name, value] of jar) {
    if (!pairs.some((p) => p.split('=')[0] === name)) pairs.push(`${name}=${value}`);
  }
  return pairs.join('; ');
}

/** 解析伺服器回傳的 Set-Cookie，只保留 name=value。 */
export function parseSetCookies(headers: HeaderList, jar: Map<string, string>): void {
  for (const [name, value] of headers) {
    if (name.toLowerCase() !== 'set-cookie') continue;
    const [pair] = value.split(';');
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

/** 輸出 Netscape 格式的 cookie jar。 */
export function serializeCookieJar(jar: Map<string, string>, url: string): string {
  const lines = [
    '# Netscape HTTP Cookie File',
    '# https://curl.se/docs/http-cookies.html',
    '# This file was generated by minicurl. Edit at your own risk.',
    '',
  ];
  for (const [name, value] of jar) {
    lines.push(`#HttpOnly_\t.example.com\tTRUE\t/\tFALSE\t0\t${name}\t${value}`);
  }
  if (jar.size === 0) lines.push(`# (no cookies for ${url})`);
  return `${lines.join('\n')}\n`;
}
