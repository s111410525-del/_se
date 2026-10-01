import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { filenameFromContentDisposition, filenameFromUrl, getHeader, RequestError } from './url.js';
import { serializeCookieJar } from './body.js';
import type { Options, TransferResult } from './types.js';

/** stdout / stderr 抽象，方便測試時攔截。 */
export interface Streams {
  out: NodeJS.WritableStream;
  err: NodeJS.WritableStream;
  isTty: boolean;
}

function asPath(p: string): string {
  return p;
}

/** 判斷是否為「丟棄輸出」的特殊裝置。 */
function isNullDevice(target: string): boolean {
  const normalized = target.replace(/\\/g, '/').toLowerCase();
  return normalized === 'nul' || normalized === '/dev/null' || normalized === 'null'
    || normalized === 'nul:' || normalized.endsWith('/nul');
}

class NullSink extends Writable {
  override _write(_chunk: unknown, _encoding: BufferEncoding, callback: (err?: Error | null) => void): void {
    callback();
  }
}

/** 決定回應主體要寫到哪裡。 */
export function resolveOutputPath(options: Options, result: TransferResult): string | undefined {
  if (options.outputPath !== undefined) return asPath(options.outputPath);
  if (options.remoteName || options.remoteHeaderName) {
    const fromHeader = options.remoteHeaderName
      ? filenameFromContentDisposition(getHeader(result.headers, 'content-disposition'))
      : undefined;
    const name = fromHeader ?? filenameFromUrl(result.effectiveUrl);
    if (name === undefined) return undefined;
    return path.resolve(process.cwd(), path.basename(name));
  }
  return undefined;
}

function openSink(target: string, append: boolean): NodeJS.WritableStream {
  if (isNullDevice(target)) return new NullSink();
  try {
    if (append) return fs.createWriteStream(target, { flags: 'a' });
    return fs.createWriteStream(target, { flags: 'w' });
  } catch (err) {
    throw new RequestError(`無法寫入檔案 ${target}: ${(err as Error).message}`, 23);
  }
}

function closeSink(stream: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.on('error', reject);
  });
}

/** 終端機上顯示的進度條（-#）。 */
export class ProgressBar {
  private lastRender = 0;
  private active = false;

  constructor(private readonly err: NodeJS.WritableStream, private readonly enabled: boolean) {}

  start(total: number | undefined): void {
    this.active = this.enabled;
    if (!this.active) return;
    this.err.write(`\r[........................] 0%${total === undefined ? '' : ` of ${formatBytes(total)}`}`);
  }

  update(received: number, total: number | undefined): void {
    if (!this.active) return;
    const now = Date.now();
    if (now - this.lastRender < 80) return;
    this.lastRender = now;
    if (total === undefined || total <= 0) {
      this.err.write(`\r[=>........................] ${formatBytes(received)}`);
      return;
    }
    const ratio = Math.min(1, received / total);
    const width = 24;
    const filled = Math.round(ratio * width);
    const bar = `${'#'.repeat(filled)}${'.'.repeat(width - filled)}`;
    this.err.write(
      `\r[${bar}] ${String(Math.floor(ratio * 100)).padStart(3)}% of ${formatBytes(total)}`,
    );
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.err.write('\n');
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(2)} ${units[i]}`;
}

function humanTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0.000000';
  if (seconds < 1) return seconds.toFixed(6);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (h > 0 || m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/** 實作 curl -w 的變數替換（並處理 \n \t \r \\ 轉義）。 */
export function formatWriteOut(template: string, result: TransferResult): string {
  const seconds = result.elapsedMs / 1000;
  const vars: Record<string, string> = {
    url_effective: result.effectiveUrl,
    url: result.url,
    http_code: String(result.status),
    http_version: result.scheme === 'https' ? '2' : '1.1',
    method: result.method,
    scheme: result.scheme,
    num_redirects: String(result.numRedirects),
    num_connects: String(result.numConnects),
    size_download: String(result.body.length),
    size_header: String(result.headers.length),
    size_request: '0',
    size_upload: '0',
    content_type: result.contentType ?? '',
    remote_ip: result.remoteIp ?? '',
    remote_port: result.remotePort === undefined ? '' : String(result.remotePort),
    time_total: seconds.toFixed(6),
    time_namelookup: '0.000000',
    time_connect: '0.000000',
    time_appconnect: '0.000000',
    time_pretransfer: '0.000000',
    time_starttransfer: seconds.toFixed(6),
    time_redirect: '0.000000',
    time_total_human: humanTime(seconds),
    response_code: String(result.status),
    exitcode: '0',
    errormsg: '',
  };
  const expanded = template.replace(/%\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(vars, name) ? vars[name]! : whole);
  return expanded.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
}

/** 把標頭組成 curl 風格的文字區塊。 */
export function renderHeaders(result: TransferResult, includeStatusLine = true): Buffer {
  const lines: string[] = [];
  if (includeStatusLine) lines.push(result.statusLine);
  for (const [name, value] of result.headers) lines.push(`${name}: ${value}`);
  lines.push('');
  return Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8');
}

export interface WriteResult {
  /** 有寫入檔案時回傳檔案路徑。 */
  file?: string;
  bytesWritten: number;
}

/** 將回應主體輸出到 stdout 或檔案。 */
export async function writeBody(
  options: Options,
  result: TransferResult,
  streams: Streams,
): Promise<WriteResult> {
  if (options.noBody) return { bytesWritten: 0 };

  const omitBody = options.head;
  const chunks: Buffer[] = [];
  if (options.includeHeaders || options.head) chunks.push(renderHeaders(result));
  if (!omitBody) chunks.push(result.body);

  let sink: NodeJS.WritableStream | undefined;
  let file: string | undefined;
  const target = resolveOutputPath(options, result);
  if (target !== undefined) {
    sink = openSink(target, options.appendOutput);
    file = target;
  }

  const destination = sink ?? streams.out;
  const write = (buf: Buffer): Promise<void> => new Promise((res, rej) => {
    if (destination === streams.out) {
      destination.write(buf, () => res());
      return;
    }
    destination.write(buf, (err) => (err ? rej(err) : res()));
  });

  for (const chunk of chunks) await write(chunk);

  if (sink) {
    await closeSink(sink);
    return { file, bytesWritten: omitBody ? 0 : result.body.length };
  }
  return { bytesWritten: omitBody ? 0 : result.body.length };
}

/** -D / --dump-header */
export async function writeDumpHeader(
  options: Options,
  result: TransferResult,
  redirectChunks: string[],
): Promise<void> {
  if (options.dumpHeader === undefined || isNullDevice(options.dumpHeader)) return;
  const parts = [...redirectChunks, renderHeaders(result).toString('utf8')];
  try {
    await fs.promises.writeFile(
      options.dumpHeader,
      parts.join(''),
      { flag: options.appendOutput ? 'a' : 'w' },
    );
  } catch (err) {
    throw new RequestError(`無法寫入標頭檔 ${options.dumpHeader}: ${(err as Error).message}`, 23);
  }
}

/** -c / --cookie-jar */
export async function writeCookieJar(
  options: Options,
  jar: Map<string, string>,
  result: TransferResult,
): Promise<void> {
  if (options.cookieJar === undefined || isNullDevice(options.cookieJar)) return;
  try {
    await fs.promises.writeFile(
      options.cookieJar,
      serializeCookieJar(jar, result.effectiveUrl),
    );
  } catch (err) {
    throw new RequestError(`無法寫入 cookie 檔 ${options.cookieJar}: ${(err as Error).message}`, 23);
  }
}
