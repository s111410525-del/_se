import fs from 'node:fs';
import type { DataSpec, FormField, HeaderList, Method, Options } from './types.js';

export class UsageError extends Error {
  /** 對應 curl 的 exit code 2（命令列介面錯誤）。 */
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export const HELP_TEXT = `minicurl — a curl-like HTTP client

Usage: minicurl [options...] <url>

Request:
  -X, --request <method>        指定 HTTP 方法（預設依資料自動判斷）
  -I, --head                    以 HEAD 方法只取標頭
      --url <url>               指定 URL（可取代最後的參數）
  -G, --get                     將資料以 query string 送出
      --json <data>            送出 JSON 標頭與內文（自動 Content-Type 與 Accept）

Headers:
  -H, --header <header>         送出標頭，可重複；「Header:」會移除該標頭
  -A, --user-agent <name>       送出 User-Agent
  -e, --referer <url>           送出 Referer
  -u, --user <user[:pass]>      送出 Basic 認證
  -b, --cookie <data>           送出 Cookie，可重複
  -c, --cookie-jar <file>       把收到的 Cookie 寫入檔案（Netscape 格式）

Data:
  -d, --data <data>             POST 資料；「@file」讀檔、「@-」讀 stdin
      --data-raw <data>         同上但不處理 @ 前綴、保留換行
      --data-binary <data>      同 --data，不做換行轉換
      --data-urlencode <data>   URL 編碼後送出
  -F, --form <name=value>       multipart/form-data；「@file」上傳檔案
      --form-string <n=v>       multipart 表單但值不視為檔名
  -T, --upload-file <file>      以 PUT/POST 上傳檔案

Output:
  -o, --output <file>           輸出到檔案
  -O, --remote-name             輸出檔名取自 URL
      --remote-header-name      輸出檔名取自 Content-Disposition
  -D, --dump-header <file>      將標頭寫入檔案
      --trace-ascii <file>      類似 -v 的診斷輸出寫入檔案
  -a, --append                  附加到輸出檔案而非覆寫
  -i, --include                在輸出中包含回應標頭
      --no-body                 不輸出回應主體
  -w, --write-out <format>      傳輸後輸出指定統計資訊
  -s, --silent                  靜默模式（關閉進度條與錯誤訊息）
  -S, --show-error              即使 -s 也顯示錯誤
  -v, --verbose                 顯示詳細連線資訊
  -#, --progress-bar            顯示進度條

Network:
  -L, --location                自動跟隨 3xx 重新導向
      --max-redirs <n>          最多跟隨幾次重新導向（預設 50）
  -k, --insecure                略過 TLS 憑證驗證
  -m, --max-time <sec>          整體執行時間上限
      --connect-timeout <s>     連線逾時秒數
      --retry <n>               暫時性錯誤的重試次數
      --retry-delay <sec>       重試間隔（預設 1 秒，指數遞增）
  -x, --proxy <[proto://]host[:port]>   透過 HTTP proxy 送出
  -C, --continue-at <off|->     續傳
      --compressed              送出 Accept-Encoding 並自動解壓縮

Other:
      --config <file>           從檔案讀取選項（每行一個選項）
  -h, --help                    顯示本說明
  -V, --version                 顯示版本

範例:
  minicurl https://example.com
  minicurl -X POST -H "Content-Type: application/json" -d '{"a":1}' https://api.example.com
  minicurl --json '{"a":1}' https://api.example.com/items
  minicurl -F "file=@report.pdf" -F "name=report" https://example.com/upload
  minicurl -O -L https://example.com/archive.tar.gz
`;

/** 預設 User-Agent，模仿 curl。 */
export const DEFAULT_USER_AGENT = 'minicurl/1.0.0';

interface RawFlags {
  /** 帶值的選項，值依出現順序保存。 */
  values: Map<string, string[]>;
  /** 不帶值的旗標。 */
  booleans: Set<string>;
  /** 額外出現的 URL。 */
  urls: string[];
}

const SHORT_BOOL = new Set(['G', 'I', 'L', 'O', 'S', 'k', 's', 'v', 'a', 'i', 'h', 'V', 'q']);

const SHORT_VALUE = new Set([
  'X', 'H', 'd', 'F', 'T', 'o', 'D', 'A', 'e', 'u', 'b', 'c', 'm', 'w', 'x', 'C',
]);

const LONG_BOOL = new Set([
  'get', 'head', 'insecure', 'location', 'silent', 'show-error', 'verbose',
  'include', 'no-body', 'append', 'remote-name', 'remote-header-name',
  'progress-bar', 'compressed', 'help', 'version',
]);

const LONG_VALUE = new Set([
  'request', 'header', 'user-agent', 'referer', 'user', 'cookie', 'cookie-jar',
  'data', 'data-ascii', 'data-binary', 'data-raw', 'data-urlencode', 'form',
  'form-string', 'upload-file', 'output', 'dump-header', 'trace-ascii',
  'write-out', 'max-time', 'connect-timeout', 'max-redirs', 'retry',
  'retry-delay', 'proxy', 'continue-at', 'config', 'url', 'json',
]);

/** -H / -A / -e / -b 皆以「名稱: 值」或純值形式處理。 */
const HEADER_BEARING = new Set(['header', 'user-agent', 'referer', 'cookie']);

const DATA_BEARING = new Set([
  'data', 'data-ascii', 'data-binary', 'data-raw', 'data-urlencode',
]);

function normalizeLong(name: string): string {
  return name.replace(/^--/, '').toLowerCase();
}

function longNameFor(short: string): string {
  switch (short) {
    case 'X': return 'request';
    case 'H': return 'header';
    case 'd': return 'data';
    case 'F': return 'form';
    case 'T': return 'upload-file';
    case 'o': return 'output';
    case 'D': return 'dump-header';
    case 'A': return 'user-agent';
    case 'e': return 'referer';
    case 'u': return 'user';
    case 'b': return 'cookie';
    case 'c': return 'cookie-jar';
    case 'm': return 'max-time';
    case 'w': return 'write-out';
    case 'x': return 'proxy';
    case 'C': return 'continue-at';
    case 'q': return 'disable';
    case 'i': return 'include';
    case 'a': return 'append';
    case 'G': return 'get';
    case 'I': return 'head';
    case 'k': return 'insecure';
    case 'L': return 'location';
    case 'O': return 'remote-name';
    case 'S': return 'show-error';
    case 's': return 'silent';
    case 'v': return 'verbose';
    case 'h': return 'help';
    case 'V': return 'version';
    case '#': return 'progress-bar';
    default: return short;
  }
}

/**
 * 把單一 token 轉成 `{ longName, value | null }`。
 * 支援短選項叢集（-sSLv）、內嵌值（-XPOST、--header=Value）與分離式取值。
 */
function tokenize(argv: string[]): RawFlags {
  const flags: RawFlags = { values: new Map(), booleans: new Set(), urls: [] };
  let onlyOperands = false;

  const push = (name: string, value: string | null): void => {
    if (value === null) {
      flags.booleans.add(name);
      return;
    }
    const list = flags.values.get(name);
    if (list) list.push(value);
    else flags.values.set(name, [value]);
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;

    if (onlyOperands) {
      flags.urls.push(token);
      continue;
    }
    if (token === '--') {
      onlyOperands = true;
      continue;
    }

    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      if (eq !== -1) {
        push(normalizeLong(token.slice(0, eq)), token.slice(eq + 1));
        continue;
      }
      const name = normalizeLong(token);
      if (LONG_BOOL.has(name)) {
        push(name, null);
      } else if (LONG_VALUE.has(name)) {
        const next = argv[i + 1];
        if (next === undefined) throw new UsageError(`選項 --${name} 需要參數`);
        push(name, next);
        i += 1;
      } else {
        throw new UsageError(`未知的選項: ${token}`);
      }
      continue;
    }

    if (token.length > 1 && token.startsWith('-')) {
      let consumedNext = false;
      for (let j = 1; j < token.length; j += 1) {
        const ch = token[j]!;
        if (SHORT_BOOL.has(ch)) {
          push(longNameFor(ch), null);
          continue;
        }
        if (SHORT_VALUE.has(ch)) {
          const inline = token.slice(j + 1);
          if (inline.length > 0) {
            push(longNameFor(ch), inline);
          } else {
            const next = argv[i + 1];
            if (next === undefined) throw new UsageError(`選項 -${ch} 需要參數`);
            push(longNameFor(ch), next);
            consumedNext = true;
          }
          break;
        }
        throw new UsageError(`未知的選項: -${ch}`);
      }
      if (consumedNext) i += 1;
      continue;
    }

    flags.urls.push(token);
  }

  return flags;
}

/** 以 shell 風格切分一行（支援單/雙引號）。 */
function shellSplit(line: string): string[] {
  const parts = line.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return parts.map((part) => {
    const quoted = (part.startsWith('"') && part.endsWith('"'))
      || (part.startsWith("'") && part.endsWith("'"));
    return quoted ? part.slice(1, -1) : part;
  });
}

/**
 * 從 --config 檔案內容展開成 argv。
 * 與 curl 相同：選項可省略開頭的 `--`，並支援 `name = value` 形式。
 */
function readConfigFile(path: string): string[] {
  let text: string;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch (err) {
    throw new UsageError(`無法讀取設定檔 ${path}: ${(err as Error).message}`);
  }

  const tokens: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    if (line.startsWith('-')) {
      tokens.push(...shellSplit(line));
      continue;
    }

    // `name`, `name value`, `name = value`
    const match = /^([A-Za-z][A-Za-z0-9-]*)\s*(?:=\s*)?(.*)$/.exec(line);
    if (match === null) continue;
    tokens.push(`--${match[1]}`);
    const rest = (match[2] ?? '').trim();
    if (rest !== '') tokens.push(...shellSplit(rest));
  }
  return tokens;
}

function readStdin(): Buffer {
  try {
    return fs.readFileSync(0);
  } catch {
    return Buffer.alloc(0);
  }
}

/** 處理 `@file` / `@-` 語法。`@file` 會讀取檔案內容。 */
function resolveDataValue(spec: string, raw: boolean): Buffer {
  if (!raw && spec.startsWith('@')) {
    const path = spec.slice(1);
    if (path === '-') return readStdin();
    try {
      return fs.readFileSync(path);
    } catch (err) {
      throw new UsageError(`無法讀取資料檔 ${path}: ${(err as Error).message}`);
    }
  }
  return Buffer.from(spec, 'utf8');
}

/**
 * 拆分 `Name: value` 形式的標頭。
 * curl 允許 `Name;` 表示送出空值標頭，因此這裡回傳 `;` 作為標記。
 */
export function parseHeaderLine(line: string): [string, string] | null {
  const idx = line.indexOf(':');
  if (idx === -1) {
    if (line.endsWith(';')) return [line.slice(0, -1).trim(), ';'];
    return null;
  }
  return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
}

/** 套用一條 -H 選項：空值代表移除，`;` 代表送出空字串。 */
function applyHeaderOption(list: HeaderList, line: string): void {
  const parsed = parseHeaderLine(line);
  if (parsed === null) throw new UsageError(`標頭格式錯誤: ${line}`);
  if (parsed[1] === '') setHeader(list, parsed[0], null);
  else if (parsed[1] === ';') setHeader(list, parsed[0], '');
  else setHeader(list, parsed[0], parsed[1]);
}

/** 設定或移除標頭。value 為 null 代表移除（curl 的 `Header:` 語法）。 */
export function setHeader(list: HeaderList, name: string, value: string | null): void {
  const lower = name.toLowerCase();
  const kept = list.filter(([k]) => k.toLowerCase() !== lower);
  if (value !== null) kept.push([name, value]);
  list.length = 0;
  list.push(...kept);
}

function parseFormField(spec: string, allowFile: boolean): FormField {
  const eq = spec.indexOf('=');
  if (eq === -1) throw new UsageError(`表單欄位必須是 name=value: ${spec}`);
  const name = spec.slice(0, eq);
  const value = spec.slice(eq + 1);
  if (allowFile && (value.startsWith('@') || value.startsWith('<'))) {
    return { name, value: value.slice(1), file: { path: value.slice(1), mode: value[0] === '@' ? 'upload' : 'content' } };
  }
  return { name, value };
}

function toNumber(value: string, flag: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new UsageError(`${flag} 需要非負數字: ${value}`);
  return n;
}

/** 支援 curl 的六種 --data-urlencode 形式。 */
function applyUrlencode(spec: string): Buffer {
  const readSource = (raw: string): string => {
    if (raw.startsWith('@')) {
      const p = raw.slice(1);
      if (p === '-') return readStdin().toString('utf8');
      try {
        return fs.readFileSync(p, 'utf8');
      } catch (err) {
        throw new UsageError(`無法讀取資料檔 ${p}: ${(err as Error).message}`);
      }
    }
    return raw;
  };
  const stripNewlines = (s: string): string => s.replace(/\r?\n/g, '');

  const at = spec.indexOf('@');
  if (at > 0) {
    // name@filename
    return Buffer.from(`${spec.slice(0, at)}=${encodeURIComponent(stripNewlines(readSource(spec.slice(at))))}`, 'utf8');
  }
  if (spec.startsWith('=')) {
    // =content
    return Buffer.from(encodeURIComponent(spec.slice(1)), 'utf8');
  }
  const eq = spec.indexOf('=');
  if (eq !== -1) {
    // name=content
    return Buffer.from(`${spec.slice(0, eq)}=${encodeURIComponent(stripNewlines(spec.slice(eq + 1)))}`, 'utf8');
  }
  if (spec.startsWith('@')) {
    // @filename
    return Buffer.from(encodeURIComponent(stripNewlines(readSource(spec))), 'utf8');
  }
  // content
  return Buffer.from(encodeURIComponent(spec), 'utf8');
}

/** 解析所有 -d 系列選項，並以 `&` 串接（與 curl 相同）。 */
function buildData(flags: RawFlags): Options['data'] {
  const present = [...DATA_BEARING].filter((name) => flags.values.has(name));
  if (present.length === 0) return undefined;

  const mode: DataSpec['mode'] = present.includes('data-urlencode') ? 'urlencode' : 'body';
  const raw = present.includes('data-raw') || present.includes('data-binary');
  // curl: 最後一個出現的 -d 種類決定行為
  const primary = present[present.length - 1]!;

  const chunks: Buffer[] = [];
  for (const value of flags.values.get(primary) ?? []) {
    chunks.push(mode === 'urlencode' ? applyUrlencode(value) : resolveDataValue(value, raw));
  }
  if (chunks.length === 0) return { mode, raw, chunks: [Buffer.alloc(0)] };

  const sep = Buffer.from('&', 'utf8');
  const joined = chunks.reduce<Buffer>((acc, c) => Buffer.concat([acc, sep, c]), Buffer.alloc(0));
  return { mode, raw, chunks: [joined.subarray(sep.length)] };
}

function emptyOptions(partial: Partial<Options>): Options {
  return {
    url: '',
    method: 'GET',
    headers: [],
    forms: [],
    cookies: [],
    useGet: false,
    insecure: false,
    followRedirects: false,
    maxRedirects: 50,
    head: false,
    silent: false,
    showError: false,
    verbose: false,
    includeHeaders: false,
    noBody: false,
    appendOutput: false,
    remoteName: false,
    remoteHeaderName: false,
    progress: false,
    compressed: false,
    retry: 0,
    retryDelay: 0,
    help: false,
    version: false,
    ...partial,
  };
}

/**
 * 解析命令列參數成 Options。
 * `--config` 指定的設定檔會在前置展開，命令列上的選項可以覆蓋它。
 */
export function parseArgs(argv: string[]): Options {
  const expanded: string[] = [];
  const seenConfigs: string[] = [];
  const pending: string[] = [...argv];

  // 第一輪：只找出 --config，把設定檔內容插到最前面。
  for (let guard = 0; guard < 32; guard += 1) {
    const idx = pending.findIndex((t) => t === '--config' || t.startsWith('--config='));
    if (idx === -1) break;
    const isInline = pending[idx]!.startsWith('--config=');
    const path = isInline ? pending[idx]!.slice('--config='.length) : pending[idx + 1];
    if (path === undefined) throw new UsageError('選項 --config 需要參數');
    if (seenConfigs.includes(path)) throw new UsageError(`設定檔循環參照: ${path}`);
    seenConfigs.push(path);
    pending.splice(idx, isInline ? 1 : 2);
    expanded.push(...readConfigFile(path));
  }
  expanded.push(...pending);

  const flags = tokenize(expanded);
  const has = (name: string): boolean => flags.booleans.has(name);
  // 後出現的選項覆蓋先出現的（與 curl 一致）
  const one = (name: string): string | undefined => flags.values.get(name)?.at(-1);

  if (has('help')) return emptyOptions({ help: true });
  if (has('version')) return emptyOptions({ version: true });

  const url = one('url') ?? flags.urls[0];
  if (url === undefined) throw new UsageError('缺少 URL');
  if (flags.urls.length > 1 && one('url') === undefined) {
    throw new UsageError(`不支援多個 URL: ${flags.urls.join(', ')}`);
  }

  const headers: HeaderList = [];
  const cookies: string[] = [];
  let userAgent: string | undefined;
  let referer: string | undefined;

  for (const name of HEADER_BEARING) {
    for (const value of flags.values.get(name) ?? []) {
      if (name === 'header') {
        applyHeaderOption(headers, value);
      } else if (name === 'user-agent') {
        userAgent = value;
      } else if (name === 'referer') {
        referer = value;
      } else {
        cookies.push(value);
      }
    }
  }

  const forms: FormField[] = [];
  for (const value of flags.values.get('form') ?? []) forms.push(parseFormField(value, true));
  for (const value of flags.values.get('form-string') ?? []) forms.push(parseFormField(value, false));

  const data = buildData(flags);
  const json = one('json');

  const options: Options = {
    url,
    method: (one('request') ?? '') as Method,
    headers,
    forms,
    cookies,
    useGet: has('get'),
    insecure: has('insecure'),
    followRedirects: has('location'),
    maxRedirects: one('max-redirs') === undefined ? 50 : toNumber(one('max-redirs')!, '--max-redirs'),
    head: has('head'),
    silent: has('silent'),
    showError: has('show-error'),
    verbose: has('verbose'),
    includeHeaders: has('include'),
    noBody: has('no-body'),
    appendOutput: has('append'),
    remoteName: has('remote-name'),
    remoteHeaderName: has('remote-header-name'),
    progress: has('progress-bar'),
    compressed: has('compressed'),
    retry: 0,
    retryDelay: 0,
    help: false,
    version: false,
  };

  if (data) options.data = data;
  if (userAgent !== undefined) options.userAgent = userAgent;
  if (referer !== undefined) options.referer = referer;
  if (json !== undefined) options.json = json;

  const optional: Array<[keyof Options, string, string, boolean]> = [
    ['outputPath', 'output', '--output', false],
    ['dumpHeader', 'dump-header', '--dump-header', false],
    ['traceAscii', 'trace-ascii', '--trace-ascii', false],
    ['writeOut', 'write-out', '--write-out', false],
    ['maxTime', 'max-time', '--max-time', true],
    ['connectTimeout', 'connect-timeout', '--connect-timeout', true],
    ['retry', 'retry', '--retry', true],
    ['retryDelay', 'retry-delay', '--retry-delay', true],
    ['proxy', 'proxy', '--proxy', false],
    ['range', 'continue-at', '--continue-at', false],
    ['uploadFile', 'upload-file', '--upload-file', false],
    ['user', 'user', '--user', false],
    ['cookieJar', 'cookie-jar', '--cookie-jar', false],
  ];
  const target = options as unknown as Record<string, unknown>;
  for (const [key, flag, label, numeric] of optional) {
    const value = one(flag);
    if (value === undefined) continue;
    target[key as string] = numeric ? toNumber(value, label) : value;
  }

  if (options.retry > 0 && options.retryDelay === 0) options.retryDelay = 1;

  return options;
}
