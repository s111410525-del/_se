import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import zlib from 'node:zlib';
import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_USER_AGENT } from './args.js';
import { buildCookieHeader, buildRequestBody, parseSetCookies } from './body.js';
import { Tracer } from './trace.js';
import { openTunnel, parseProxy } from './proxy.js';
import {
  appendQuery,
  getHeader,
  hasHeader,
  normalizeUrl,
  rawHeadersToList,
  removeHeader,
  RequestError,
  type NormalizedUrl,
} from './url.js';
import type { HeaderList, Options, TransferResult } from './types.js';

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
/** --retry 時會重試的狀態碼。 */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
/** --retry 時會重試的網路錯誤。 */
const RETRYABLE_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN',
  'EPIPE', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_SOCKET',
]);

export interface TransferHooks {
  /** 每收到一塊資料時呼叫（供進度條使用）。 */
  onChunk?: (bytes: number, total: number | undefined) => void;
  /** 每個回應標頭到手時呼叫（供 -D 與重新導向記錄使用）。 */
  onResponse?: (statusLine: string, headers: HeaderList) => void;
}

interface SingleResponse {
  statusLine: string;
  status: number;
  headers: HeaderList;
  body: Buffer;
  remoteIp?: string;
  remotePort?: number;
}

function decompress(buffer: Buffer, encoding: string): Buffer {
  const enc = encoding.toLowerCase().trim();
  try {
    if (enc === 'gzip' || enc === 'x-gzip') return zlib.gunzipSync(buffer);
    if (enc === 'deflate') {
      try {
        return zlib.inflateSync(buffer);
      } catch {
        return zlib.inflateRawSync(buffer);
      }
    }
    if (enc === 'br') return zlib.brotliDecompressSync(buffer);
    if (enc === 'zstd') return zlib.zstdDecompressSync(buffer);
  } catch {
    /* 解壓失敗時原樣輸出 */
  }
  return buffer;
}

function splitOnce(value: string, sep: string): [string, string | undefined] {
  const idx = value.indexOf(sep);
  return idx === -1 ? [value, undefined] : [value.slice(0, idx), value.slice(idx + 1)];
}

function describeError(err: unknown): string {
  const e = err as NodeJS.ErrnoException;
  const map: Record<string, string> = {
    ENOTFOUND: '無法解析主機名稱',
    ECONNREFUSED: '連線遭拒絕',
    ECONNRESET: '連線被重設',
    ETIMEDOUT: '連線逾時',
    EAI_AGAIN: 'DNS 暫時性失敗',
    EPIPE: '連線中斷',
    CERT_HAS_EXPIRED: 'TLS 憑證已過期',
    DEPTH_ZERO_SELF_SIGNED_CERT: '自我簽署憑證（可加 -k 略過驗證）',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: '無法驗證憑證簽章（可加 -k 略過驗證）',
  };
  const friendly = map[e.code ?? ''];
  return friendly ? `${friendly} (${e.code})` : (e.message ?? String(err));
}

function exitCodeFor(err: unknown): number {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 6;
  if (code === 'ECONNREFUSED') return 7;
  if (code === 'ETIMEDOUT') return 28;
  if (code?.startsWith('CERT_') || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return 60;
  return 1;
}

/** 組出最終要送出的標頭（補上 Host / User-Agent / Accept / Content-Length）。 */
function composeHeaders(
  options: Options,
  base: HeaderList,
  bodyLength: number,
  cookieHeader: string | undefined,
): HeaderList {
  const out: HeaderList = base.map(([k, v]) => [k, v] as [string, string]);

  if (options.compressed && !hasHeader(out, 'accept-encoding')) {
    out.push(['Accept-Encoding', 'gzip, deflate, br, zstd']);
  }
  if (options.referer !== undefined && !hasHeader(out, 'referer')) {
    out.push(['Referer', options.referer]);
  }
  if (options.user !== undefined && !hasHeader(out, 'authorization')) {
    const [name, pass = ''] = splitOnce(options.user, ':');
    out.push(['Authorization', `Basic ${Buffer.from(`${name}:${pass}`).toString('base64')}`]);
  }
  if (options.userAgent !== undefined && !hasHeader(out, 'user-agent')) {
    out.push(['User-Agent', options.userAgent]);
  }
  if (!hasHeader(out, 'user-agent')) out.push(['User-Agent', DEFAULT_USER_AGENT]);
  if (cookieHeader !== undefined && !hasHeader(out, 'cookie')) {
    out.push(['Cookie', cookieHeader]);
  }
  if (!hasHeader(out, 'accept')) out.push(['Accept', '*/*']);
  if (bodyLength > 0 && !hasHeader(out, 'content-length')) {
    out.push(['Content-Length', String(bodyLength)]);
  }
  return out;
}

/** 計算 -C / --continue-at 的 Range 標頭值。 */
function resolveRange(options: Options, outputPath: string | undefined): string | undefined {
  if (options.range === undefined) return undefined;
  if (hasHeader(options.headers, 'range')) return undefined;
  if (options.range !== '-') return `bytes=${options.range}-`;

  // `-C -`：若目標檔案已存在則從其大小續傳
  let size = 0;
  if (outputPath !== undefined && fs.existsSync(outputPath)) {
    try {
      size = fs.statSync(outputPath).size;
    } catch {
      size = 0;
    }
  }
  return `bytes=${size}-`;
}

/** 送出單一 HTTP 請求並收集完整回應。 */
function performRequest(
  url: NormalizedUrl,
  method: string,
  headers: HeaderList,
  body: Buffer | undefined,
  options: Options,
  tracer: Tracer,
  hooks: TransferHooks,
  cookieJar: Map<string, string>,
): Promise<SingleResponse> {
  return new Promise<SingleResponse>((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const hostHeader = url.port === defaultPort ? url.hostname : `${url.hostname}:${url.port}`;
    const proxy = options.proxy === undefined ? undefined : parseProxy(options.proxy);

    const cookieHeader = buildCookieHeader(options.cookies, cookieJar);
    const outgoing = composeHeaders(options, headers, body?.length ?? 0, cookieHeader);
    outgoing.unshift(['Host', hostHeader]);
    if (proxy?.authorization !== undefined && !hasHeader(outgoing, 'proxy-authorization')) {
      outgoing.push(['Proxy-Authorization', proxy.authorization]);
    }

    // 走 proxy 時：HTTP 目標使用 absolute-URI；HTTPS 目標先建立 CONNECT 隧道。
    const useAbsoluteForm = proxy !== undefined && !isHttps;
    const requestTarget = useAbsoluteForm
      ? `${url.protocol}//${url.hostname}:${url.port}${url.path}`
      : url.path;

    tracer.detail(
      [`> ${method} ${requestTarget} HTTP/1.1`, ...outgoing.map(([k, v]) => `> ${k}: ${v}`), '> '].join('\n'),
    );

    const requestOptions: https.RequestOptions = {
      protocol: url.protocol,
      hostname: proxy?.host ?? url.hostname,
      port: proxy?.port ?? url.port,
      method,
      path: requestTarget,
      headers: Object.fromEntries(outgoing),
      setHost: false,
      ...(isHttps && options.insecure ? { rejectUnauthorized: false } : {}),
    };

    // HTTPS + proxy：先 CONNECT 打通隧道再做 TLS 交握。
    if (proxy !== undefined && isHttps) {
      const tunnelTimeout = (options.connectTimeout ?? options.maxTime ?? 30) * 1000;
      requestOptions.agent = new https.Agent({ keepAlive: false });
      requestOptions.createConnection = (_opts, callback) => {
        void openTunnel(proxy, url.hostname, url.port, tunnelTimeout)
          .then((raw) => {
            const secured = tls.connect({
              socket: raw,
              servername: url.hostname,
              ...(options.insecure ? { rejectUnauthorized: false } : {}),
            });
            secured.once('error', (err: Error) => callback(err, secured));
            secured.once('secureConnect', () => callback(null, secured));
          })
          .catch((err: Error) => {
            callback(err, undefined as unknown as tls.TLSSocket);
          });
        return undefined;
      };
    }

    const request = transport.request(requestOptions);
    let settled = false;

    const timers: NodeJS.Timeout[] = [];
    const clearTimers = (): void => {
      for (const t of timers) clearTimeout(t);
    };
    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      clearTimers();
      request.destroy();
      reject(err);
    };
    const succeed = (value: SingleResponse): void => {
      if (settled) return;
      settled = true;
      clearTimers();
      resolve(value);
    };

    if (options.connectTimeout !== undefined && options.connectTimeout > 0) {
      timers.push(setTimeout(() => {
        fail(new RequestError(`連線逾時（${options.connectTimeout}s）`, 28));
      }, options.connectTimeout * 1000));
    }
    if (options.maxTime !== undefined && options.maxTime > 0) {
      timers.push(setTimeout(() => {
        fail(new RequestError(`操作逾時（${options.maxTime}s）`, 28));
      }, options.maxTime * 1000));
    }

    request.on('error', (err) => fail(new RequestError(describeError(err), exitCodeFor(err))));

    request.on('response', (response) => {
      const statusLine = `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage ?? ''}`.trimEnd();
      const raw = rawHeadersToList(response.rawHeaders ?? []);
      hooks.onResponse?.(statusLine, raw);
      tracer.detail(
        [`< ${statusLine}`, ...raw.map(([k, v]) => `< ${k}: ${v}`), '< '].join('\n'),
      );
      parseSetCookies(raw, cookieJar);

      const lengthRaw = getHeader(raw, 'content-length');
      const total = lengthRaw === undefined ? undefined : Number(lengthRaw);
      const chunks: Buffer[] = [];
      let received = 0;

      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        received += chunk.length;
        hooks.onChunk?.(received, total);
      });
      response.on('error', (err) => fail(new RequestError(describeError(err), 56)));
      response.on('end', () => {
        let payload: Buffer = Buffer.concat(chunks);
        const encoding = getHeader(raw, 'content-encoding');
        if (encoding && options.compressed) payload = decompress(payload, encoding);
        succeed({
          statusLine,
          status: response.statusCode ?? 0,
          headers: raw,
          body: payload,
          remoteIp: response.socket?.remoteAddress ?? undefined,
          remotePort: response.socket?.remotePort ?? undefined,
        });
      });
    });

    if (body !== undefined) request.write(body);
    request.end();
  });
}

/** 決定送出資料時要用的 HTTP 方法（curl 的預設推斷規則）。 */
export function inferMethod(options: Options, hasBody: boolean): string {
  if (options.method !== '') return options.method.toUpperCase();
  if (options.head) return 'HEAD';
  if (options.useGet) return 'GET';
  if (hasBody) return 'POST';
  return 'GET';
}

function buildGetQuery(options: Options, body: Buffer | undefined): string {
  const pieces: string[] = [];
  if (body !== undefined && body.length > 0) pieces.push(body.toString('utf8'));
  if (options.json !== undefined) pieces.push(options.json);
  for (const field of options.forms) {
    let value = field.value;
    if (field.file?.mode === 'content') {
      try {
        value = fs.readFileSync(field.file.path, 'utf8');
      } catch (err) {
        throw new RequestError(`無法讀取檔案 ${field.file.path}: ${(err as Error).message}`, 26);
      }
    }
    pieces.push(`${encodeURIComponent(field.name)}=${encodeURIComponent(value)}`);
  }
  return pieces.filter((p) => p !== '').join('&');
}

/**
 * 執行一次完整傳輸：送出請求、處理重新導向與重試。
 * 回傳最後一個回應的結果。
 */
export async function transfer(
  options: Options,
  tracer: Tracer,
  hooks: TransferHooks = {},
): Promise<TransferResult> {
  const started = Date.now();
  const cookieJar = new Map<string, string>();

  const headers: HeaderList = options.headers.map(([k, v]) => [k, v] as [string, string]);
  const built = buildRequestBody(options, headers);
  const bodyBuffer = built?.buffer;

  const range = resolveRange(options, options.outputPath);
  if (range !== undefined) headers.push(['Range', range]);

  let method = inferMethod(options, bodyBuffer !== undefined && bodyBuffer.length > 0);
  let query = '';
  if (options.useGet) {
    method = 'GET';
    query = buildGetQuery(options, bodyBuffer);
  }

  let url = normalizeUrl(options.url);
  let carriedMethod = method;
  let carriedBody = method === 'GET' || method === 'HEAD' ? undefined : bodyBuffer;
  let carriedHeaders = headers;
  let pendingQuery = query;

  let totalSize = 0;
  let redirects = 0;
  let connects = 0;
  let attempt = 0;
  let final: SingleResponse | undefined;
  let finalUrl = url.href;
  const maxAttempts = Math.max(1, options.retry + 1);

  for (;;) {
    const target: NormalizedUrl = pendingQuery === ''
      ? url
      : { ...url, path: appendQuery(url.path, pendingQuery) };
    pendingQuery = '';

    const isBodyless = carriedMethod === 'GET' || carriedMethod === 'HEAD';
    const effectiveBody = isBodyless ? undefined : carriedBody;

    let response: SingleResponse;
    try {
      connects += 1;
      response = await performRequest(
        target, carriedMethod, carriedHeaders, effectiveBody,
        options, tracer, hooks, cookieJar,
      );
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const retryable = code !== undefined && RETRYABLE_CODES.has(code);
      if (!retryable || attempt + 1 >= maxAttempts) throw err;
      attempt += 1;
      const wait = Math.min(options.retryDelay * 2 ** (attempt - 2), 60);
      tracer.warn(`暫時性錯誤 (${code})，${wait}s 後進行第 ${attempt}/${options.retry} 次重試`);
      await delay(wait * 1000);
      continue;
    }

    final = response;
    finalUrl = target.href;
    totalSize += response.body.length;

    if (
      options.retry > 0
      && attempt + 1 < maxAttempts
      && redirects === 0
      && carriedMethod !== 'HEAD'
      && RETRYABLE_STATUS.has(response.status)
    ) {
      attempt += 1;
      const wait = Math.min(options.retryDelay * 2 ** (attempt - 2), 60);
      tracer.warn(`HTTP ${response.status}，${wait}s 後進行第 ${attempt}/${options.retry} 次重試`);
      await delay(wait * 1000);
      continue;
    }

    if (!options.followRedirects || !REDIRECT_STATUS.has(response.status)) break;

    const location = getHeader(response.headers, 'location');
    if (location === undefined) break;
    if (redirects >= options.maxRedirects) {
      throw new RequestError(`重新導向次數超過上限 (${options.maxRedirects})`, 47);
    }
    redirects += 1;

    let nextUrl: NormalizedUrl;
    try {
      nextUrl = normalizeUrl(new URL(location, url.href).href);
    } catch {
      throw new RequestError(`無法解析重新導向目標: ${location}`, 3);
    }
    tracer.info(`Redirecting to <${nextUrl.href}>`);

    // 303 一律改用 GET；301/302 遇到 POST 也改用 GET；307/308 保留方法與內文
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && carriedMethod === 'POST')) {
      carriedMethod = 'GET';
    }
    if (carriedMethod === 'GET' || carriedMethod === 'HEAD') {
      carriedBody = undefined;
      carriedHeaders = removeHeader(carriedHeaders, 'content-length');
      carriedHeaders = removeHeader(carriedHeaders, 'content-type');
    }
    url = nextUrl;
  }

  if (final === undefined) throw new RequestError('沒有收到任何回應', 1);

  return {
    status: final.status,
    statusText: final.statusLine.split(' ').slice(2).join(' '),
    statusLine: final.statusLine,
    headers: final.headers,
    body: final.body,
    size: totalSize,
    url: options.url,
    redirects,
    elapsedMs: Date.now() - started,
    contentType: getHeader(final.headers, 'content-type'),
    effectiveUrl: finalUrl,
    numConnects: connects,
    numRedirects: redirects,
    scheme: url.protocol.replace(':', ''),
    ...(final.remoteIp === undefined ? {} : { remoteIp: final.remoteIp }),
    ...(final.remotePort === undefined ? {} : { remotePort: final.remotePort }),
    sslVerifyResult: options.insecure ? 0 : 0,
    method: carriedMethod,
    requestUrl: finalUrl,
    cookies: cookieJar,
  };
}
