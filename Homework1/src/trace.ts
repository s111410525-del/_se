import type { HeaderList } from './types.js';

export type TraceLevel = 'none' | 'normal' | 'verbose';

export interface Sink {
  write(text: string): void;
}

/** 憑證 / 授權類標頭在 verbose 輸出中遮蔽。 */
const REDACT = /^(authorization|proxy-authorization|cookie|set-cookie)$/i;

const OUT = '> ';
const IN = '< ';
const INFO = '* ';

/** 把 trace 輸出導向 stderr 或 --trace-ascii 檔案。 */
export class Tracer {
  private readonly level: TraceLevel;
  private readonly sink: Sink;
  private closed = false;

  constructor(level: TraceLevel, sink: Sink) {
    this.level = level;
    this.sink = sink;
  }

  static none(): Tracer {
    return new Tracer('none', { write: () => undefined });
  }

  get enabled(): boolean {
    return this.level !== 'none';
  }

  private emit(text: string): void {
    if (this.closed) return;
    this.sink.write(text.endsWith('\n') ? text : `${text}\n`);
  }

  /** 一般訊息：-s 之外都會顯示。 */
  info(message: string): void {
    if (this.level === 'none') return;
    this.emit(`${INFO}${message}`);
  }

  /** 只有 -v / --trace-ascii 才會顯示的細節。 */
  detail(message: string): void {
    if (this.level !== 'verbose') return;
    this.emit(message);
  }

  warn(message: string): void {
    if (this.level === 'none') return;
    this.emit(`Warning: ${message}`);
  }

  close(): void {
    this.closed = true;
  }
}

export function formatHeaders(headers: HeaderList, mark = INFO): string {
  return headers
    .map(([name, value]) => `${mark}${REDACT.test(name) ? `${name}: <hidden>` : `${name}: ${value}`}`)
    .join('\n');
}

/** 組出類似 `curl -v` 的請求輸出。 */
export function requestTrace(
  tracer: Tracer,
  method: string,
  target: string,
  headers: HeaderList,
  bodyLength: number,
  scheme: string,
  hostname: string,
  port: number,
  remoteIp: string | undefined,
): void {
  tracer.detail(`${OUT}${method} ${target} HTTP/1.1`);
  tracer.detail(`${OUT}Host: ${hostname}:${port}`);
  for (const [name, value] of headers) {
    tracer.detail(`${OUT}${REDACT.test(name) ? `${name}: <hidden>` : `${name}: ${value}`}`);
  }
  if (bodyLength > 0) {
    tracer.detail(`${INFO}Upload completely sent off: ${bodyLength} out of ${bodyLength} bytes`);
  }
  tracer.detail(`${OUT}End of headers`);
  if (remoteIp) tracer.detail(`${INFO}Connected to ${hostname} (${remoteIp}) port ${port}`);
  void scheme;
}

/** 組出類似 `curl -v` 的回應輸出。 */
export function responseTrace(tracer: Tracer, statusLine: string, headers: HeaderList): void {
  tracer.detail(`${IN}${statusLine}`);
  for (const [name, value] of headers) {
    tracer.detail(`${IN}${REDACT.test(name) ? `${name}: <hidden>` : `${name}: ${value}`}`);
  }
}
