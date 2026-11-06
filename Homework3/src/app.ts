import type { RequestListener } from 'node:http';
import { loadConfig, type Config } from './config.js';
import type { AppServices, Context } from './core/context.js';
import { HttpError, forbidden, notFound } from './core/errors.js';
import { appendCookie, parseCookies, readForm, send } from './core/http.js';
import { Router, normalizePath } from './core/router.js';
import { SessionStore, type Session } from './core/session.js';
import { createSeedDatabase } from './db/seed.js';
import { Store } from './db/store.js';
import { buildRouter } from './routes/index.js';
import { SESSION_COOKIE } from './routes/shared.js';
import { findById } from './services/accounts.js';
import type { Role, User } from './types.js';
import { errorPage } from './views/pages/error.js';

const ANONYMOUS = '';

export interface App {
  handler: RequestListener;
  services: AppServices;
  store: Store;
  sessions: SessionStore;
  router: Router;
}

export interface AppOptions {
  config?: Partial<Config>;
  store?: Store;
  sessions?: SessionStore;
}

export function createApp(options: AppOptions = {}): App {
  const config: Config = { ...loadConfig(), ...options.config };
  const store = options.store ?? new Store(config.dataFile);
  const sessions = options.sessions ?? new SessionStore(config.sessionTtlMs);
  store.load(createSeedDatabase);

  const services: AppServices = { config, store, sessions, loginGuards: new Map() };
  const router = buildRouter();

  const handler: RequestListener = (req, res) => {
    handleRequest(req, res, services, router).catch((err: unknown) => {
      if (!res.headersSent) send(res, 500, 'text/plain', 'Internal Server Error\n');
      else res.end();
      console.error('[unhandled]', err);
    });
  };

  return { handler, services, store, sessions, router };
}

export async function handleRequest(
  req: Parameters<RequestListener>[0],
  res: Parameters<RequestListener>[1],
  services: AppServices,
  router: Router,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://jobbeam.local');
  const method = (req.method ?? 'GET').toUpperCase();
  const path = normalizePath(url.pathname);

  let session = services.sessions.get(parseCookies(req.headers.cookie).get(SESSION_COOKIE));
  if (session === undefined) {
    session = services.sessions.create(ANONYMOUS);
    appendCookie(res, SESSION_COOKIE, session.token, { maxAge: Math.floor(services.config.sessionTtlMs / 1000) });
  }

  const active: Session = session;
  const user = active.userId === ANONYMOUS ? undefined : findById(services.store.data, active.userId);
  const match = router.match(method, path);

  let form: URLSearchParams | undefined;
  let formRead = false;

  const ctx: Context = {
    req,
    res,
    method,
    path,
    query: url.searchParams,
    params: match.kind === 'matched' ? match.params : {},
    services,
    session: active,
    user,

    async form(): Promise<URLSearchParams> {
      if (form !== undefined) return form;
      if (formRead) throw new Error('請求內容已經讀取過了');
      formRead = true;
      form = await readForm(req);
      return form;
    },
    flash(kind, text) {
      services.sessions.addFlash(active, kind, text);
    },
    redirect(location, status = 303) {
      res.writeHead(status, { Location: location, 'Cache-Control': 'no-store' });
      res.end();
    },
    html(markup, status = 200) {
      send(res, status, 'text/html', markup);
    },
    json(value, status = 200) {
      send(res, status, 'application/json', `${JSON.stringify(value, null, 2)}\n`);
    },
    text(value, status = 200) {
      send(res, status, 'text/plain', value);
    },
    asset(markup, contentType, maxAge = 3600) {
      send(res, 200, contentType, markup, { 'Cache-Control': `public, max-age=${maxAge}` });
    },
    requireUser(): User {
      if (user === undefined) throw new HttpError(401, '請先登入');
      return user;
    },
    requireRole(...roles: Role[]): User {
      const current = user === undefined ? ctx.requireUser() : user;
      if (!roles.includes(current.role)) throw forbidden('你的帳號沒有權限使用這個功能');
      return current;
    },
    requireCsrf(input) {
      const expected = active.csrf;
      const received = input.get('_csrf') ?? '';
      if (expected.length !== received.length || !sameToken(expected, received)) {
        throw forbidden('安全驗證失敗，請重新整理頁面後再送出');
      }
    },
    canManage(ownerId) {
      return user !== undefined && (user.id === ownerId || user.role === 'admin');
    },
  };

  try {
    if (match.kind === 'not-found') throw notFound();
    if (match.kind === 'method-not-allowed') {
      throw new HttpError(405, `此頁面不支援 ${method} 方法`, `可用的方法：${match.allowed.join('、')}`);
    }
    if (match.route.roles !== null) ctx.requireRole(...match.route.roles);
    await match.route.handler(ctx);
  } catch (err) {
    renderError(ctx, err);
  }
}

function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function titleForStatus(status: number): string {
  switch (status) {
    case 400:
      return '資料格式有誤';
    case 401:
      return '請先登入';
    case 403:
      return '沒有權限';
    case 404:
      return '找不到頁面';
    case 405:
      return '不支援的請求';
    case 409:
      return '資料衝突';
    default:
      return '系統發生錯誤';
  }
}

function renderError(ctx: Context, err: unknown): void {
  if (err instanceof HttpError && err.status === 401) {
    ctx.redirect(`/login?next=${encodeURIComponent(ctx.path)}`);
    return;
  }

  const csrfToken = ctx.session?.csrf ?? '';
  const user = ctx.user === undefined ? undefined : { ...ctx.user };
  if (err instanceof HttpError) {
    ctx.html(
      errorPage({
        status: err.status,
        title: titleForStatus(err.status),
        message: err.message,
        detail: err.detail,
        user,
        csrfToken,
      }),
      err.status,
    );
    return;
  }

  console.error('[error]', err);
  ctx.html(
    errorPage({
      status: 500,
      title: '系統發生錯誤',
      message: '伺服器處理這個請求時發生問題，請稍後再試。',
      detail: err instanceof Error ? err.message : null,
      user,
      csrfToken,
    }),
    500,
  );
}
