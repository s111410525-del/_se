import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from '../config.js';
import type { Store } from '../db/store.js';
import type { LoginGuard, Role, User } from '../types.js';
import type { FlashKind, Session, SessionStore } from './session.js';

/**
 * Handler 可以使用的所有相依服務。
 *
 * 以介面宣告而非直接 import `app.ts`，讓 `router.ts`、`context.ts` 與測試
 * 都能反向組裝出一個假的 AppServices。
 */
export interface AppServices {
  readonly config: Config;
  readonly store: Store;
  readonly sessions: SessionStore;
  /** 登入失敗鎖定狀態，key 為帳號名稱。 */
  readonly loginGuards: Map<string, LoginGuard>;
}

/** 單一路由的處理情境。 */
export interface Context {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly method: string;
  /** 不含查詢字串的路徑。 */
  readonly path: string;
  readonly query: URLSearchParams;
  /** 路由參數，例如 `/courses/:id` 的 `id`。 */
  readonly params: Readonly<Record<string, string>>;
  readonly services: AppServices;
  readonly session: Session | undefined;
  readonly user: User | undefined;

  /** 讀取並解析表單內容（同一個請求只能呼叫一次）。 */
  form(): Promise<URLSearchParams>;
  /** 讀取並解析 JSON 內容（同一個請求只能呼叫一次）。 */
  jsonBody<T = unknown>(): Promise<T>;

  /** 安排一則要在下一頁顯示的訊息，通常搭配 `redirect()`。 */
  flash(kind: FlashKind, text: string): void;
  redirect(location: string, status?: number): void;
  html(body: string, status?: number): void;
  json(value: unknown, status?: number): void;
  text(body: string, status?: number): void;
  /** 送出內嵌的靜態資源（CSS / JS）。 */
  asset(body: string, contentType: string, maxAge?: number): void;

  /** 取得登入者，否則拋出 401。 */
  requireUser(): User;
  /** 取得具有指定角色的登入者，否則拋出 401／403。 */
  requireRole(...roles: Role[]): User;
  /** 驗證 CSRF 權杖，失敗時拋出 403。 */
  requireCsrf(form: URLSearchParams): void;
  /** 驗證登入者的角色是否具備存取目標資源的資格。 */
  canAccess(user: User, ownerId: string): boolean;
}