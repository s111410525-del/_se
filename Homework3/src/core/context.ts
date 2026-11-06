import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from '../config.js';
import type { Store } from '../db/store.js';
import type { LoginGuard, Role, User } from '../types.js';
import type { FlashKind, Session, SessionStore } from './session.js';

/** Handler 可以使用的共用相依物件。 */
export interface AppServices {
  readonly config: Config;
  readonly store: Store;
  readonly sessions: SessionStore;
  /** 登入失敗紀錄，key 為小寫帳號。 */
  readonly loginGuards: Map<string, LoginGuard>;
}

/** 單一請求的執行環境。 */
export interface Context {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly params: Readonly<Record<string, string>>;
  readonly services: AppServices;
  readonly session: Session | undefined;
  readonly user: User | undefined;

  form(): Promise<URLSearchParams>;
  flash(kind: FlashKind, text: string): void;
  redirect(location: string, status?: number): void;
  html(body: string, status?: number): void;
  json(value: unknown, status?: number): void;
  text(body: string, status?: number): void;
  asset(body: string, contentType: string, maxAge?: number): void;

  requireUser(): User;
  requireRole(...roles: Role[]): User;
  requireCsrf(form: URLSearchParams): void;
  canManage(ownerId: string): boolean;
}
