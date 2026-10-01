/**
 * 共用型別定義。
 */

/** 一組 HTTP 標頭，保留輸入順序與重複的欄位名稱。 */
export type HeaderList = Array<[name: string, value: string]>;

/** 表單欄位：值可能是純文字，或 `@檔名` / `<檔名` 表示檔案內容。 */
export interface FormField {
  name: string;
  value: string;
  /** 檔名來源：`@path` 上傳檔案，`<path` 讀檔內容當純文字。 */
  file?: { path: string; mode: 'upload' | 'content' };
}

export type DataMode = 'body' | 'urlencode';

/** 資料來源與內容。 */
export interface DataSpec {
  mode: DataMode;
  /** 是否為 --data-raw（不處理 `@` 前綴、不去除換行）。 */
  raw: boolean;
  chunks: Buffer[];
}

export type Method =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'HEAD'
  | 'PATCH'
  | 'OPTIONS'
  | 'TRACE'
  | 'CONNECT'
  | (string & {});

export interface Options {
  url: string;
  method: Method;

  headers: HeaderList;
  data?: DataSpec;
  forms: FormField[];

  /** -G：把資料搬到 query string。 */
  useGet: boolean;
  /** --json 快捷方式。 */
  json?: string;

  insecure: boolean;
  followRedirects: boolean;
  maxRedirects: number;
  head: boolean;

  silent: boolean;
  showError: boolean;
  verbose: boolean;
  includeHeaders: boolean;
  noBody: boolean;

  outputPath?: string;
  dumpHeader?: string;
  traceAscii?: string;
  remoteName: boolean;
  remoteHeaderName: boolean;
  appendOutput: boolean;

  user?: string;
  userAgent?: string;
  referer?: string;
  cookies: string[];
  cookieJar?: string;

  maxTime?: number;
  connectTimeout?: number;
  compressed: boolean;
  retry: number;
  retryDelay: number;
  proxy?: string;
  progress: boolean;
  writeOut?: string;
  range?: string;
  uploadFile?: string;
  help: boolean;
  version: boolean;
}

/** 一個 HTTP 請求在重導向過程中的結果。 */
export interface TransferResult {
  /** 最後一次回應的狀態碼。 */
  status: number;
  statusText: string;
  /** 最後一次回應的原始標頭行（已重組，含重複欄位）。 */
  statusLine: string;
  headers: HeaderList;
  /** 回應主體（已依 --compressed 解壓縮）。 */
  body: Buffer;
  /** 收到的位元組總數（含重導向鏈中的所有回應）。 */
  size: number;
  url: string;
  redirects: number;
  elapsedMs: number;
  contentType?: string;
  effectiveUrl: string;
  numConnects: number;
  numRedirects: number;
  scheme: string;
  remoteIp?: string;
  remotePort?: number;
  /** 0 表示憑證驗證成功（TLS）。 */
  sslVerifyResult: number;
  /** 實際送出的請求方法（重導向可能改變）。 */
  method: string;
  /** 實際送出的 URL。 */
  requestUrl: string;
  /** 傳輸過程中伺服器設定的 Cookie。 */
  cookies: Map<string, string>;
}
