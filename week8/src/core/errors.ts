/**
 * 應用層例外。
 *
 * 服務層用這些例外表達「HTTP 層應該回什麼狀態碼」，讓規則驗證能寫在
 * 最靠近資料的地方，路由只需要負責把例外交給統一的錯誤頁。
 */

export class HttpError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(status: number, message: string, detail: string | null = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.detail = detail;
  }
}

export function badRequest(message: string, detail?: string): HttpError {
  return new HttpError(400, message, detail ?? null);
}

export function unauthorized(message = '請先登入'): HttpError {
  return new HttpError(401, message);
}

export function forbidden(message = '沒有權限存取這個頁面'): HttpError {
  return new HttpError(403, message);
}

export function notFound(message = '找不到這個頁面'): HttpError {
  return new HttpError(404, message);
}

export function conflict(message: string, detail?: string): HttpError {
  return new HttpError(409, message, detail ?? null);
}
