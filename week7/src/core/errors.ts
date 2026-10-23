/**
 * 應用層的例外型別。
 *
 * 服務層（`src/services`）用這些例外表達「HTTP 層應該回什麼狀態碼」，
 * 因此規則驗證可以寫在最靠近資料的地方，而不必在每個 handler 重複檢查。
 */
export class HttpError extends Error {
  readonly status: number;
  /** 可選擇性地帶一段 HTML 說明（例如「衝堂」時列出衝突的課程）。 */
  readonly detail: string | null;

  constructor(status: number, message: string, detail: string | null = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.detail = detail;
  }
}

/** 400：輸入格式錯誤。 */
export function badRequest(message: string, detail?: string): HttpError {
  return new HttpError(400, message, detail ?? null);
}

/** 401：尚未登入。 */
export function unauthorized(message = '請先登入'): HttpError {
  return new HttpError(401, message);
}

/** 403：已登入但權限不足。 */
export function forbidden(message = '沒有權限存取這個頁面'): HttpError {
  return new HttpError(403, message);
}

/** 404：找不到資源。 */
export function notFound(message = '找不到這個頁面'): HttpError {
  return new HttpError(404, message);
}

/** 409：與目前狀態衝突（例如重複選課、餘額不足）。 */
export function conflict(message: string, detail?: string): HttpError {
  return new HttpError(409, message, detail ?? null);
}