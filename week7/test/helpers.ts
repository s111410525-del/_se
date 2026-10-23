import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp, type App } from '../src/app.js';
import { Store } from '../src/db/store.js';

/** 測試環境：一個獨立的應用程式加上用來送出請求的瀏覽器。 */
export interface Harness {
  app: App;
  url: string;
  /** 瀏覽器（保留 Cookie，可模擬登入者）。 */
  browser: Browser;
  close: () => Promise<void>;
}

export interface Browser {
  /** 目前是否已登入。 */
  readonly loggedIn: boolean;
  get: (path: string) => Promise<Response>;
  /** 送出表單（自動附上 CSRF 權杖）。 */
  post: (path: string, fields?: Record<string, string>) => Promise<Response>;
  /** 送出表單但刻意帶錯的 CSRF 權杖。 */
  postWithoutCsrf: (path: string, fields?: Record<string, string>) => Promise<Response>;
  login: (username: string, password?: string) => Promise<Response>;
  /** 從 HTML 中取出 CSRF 權杖。 */
  csrfFrom: (path: string) => Promise<string>;
}

const CSRF_PATTERN = /name="_csrf" value="([^"]+)"/;

/** 建立隔離的測試環境：獨立的資料檔與隨機埠號。 */
export async function startHarness(): Promise<Harness> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nqu-campus-'));
  const dataFile = path.join(dir, 'campus.json');
  const app = createApp({ config: { dataFile, port: 0 } });
  const server = http.createServer(app.handler);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('無法取得測試伺服器的位址');
  const url = `http://127.0.0.1:${address.port}`;

  const cookies = new Map<string, string>();
  let loggedIn = false;

  const storeCookies = (res: Response): void => {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      if (pair === undefined) continue;
      const index = pair.indexOf('=');
      if (index <= 0) continue;
      cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  };

  const header = (): string => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');

  const request = async (path: string, init?: RequestInit): Promise<Response> => {
    const res = await fetch(`${url}${path}`, {
      ...init,
      redirect: 'manual',
      headers: { ...init?.headers, cookie: header() },
    });
    storeCookies(res);
    if (res.status === 401 || res.headers.get('location') === '/login') loggedIn = false;
    return res;
  };

  /** GET 並在遇到轉向時跟隨，最多跟隨 maxHops 次。 */
  const follow = async (target: string, maxHops = 3): Promise<Response> => {
    let res = await request(target);
    let hops = 0;
    while (res.status >= 300 && res.status < 400 && hops < maxHops) {
      const location = res.headers.get('location');
      if (location === null) break;
      res = await request(location);
      hops += 1;
    }
    return res;
  };

  const browser: Browser = {
    get loggedIn() {
      return loggedIn;
    },
    get: (target) => request(target),
    async post(target, fields = {}) {
      const csrf = await browser.csrfFrom(csrfSourceOf(target));
      const body = new URLSearchParams({ ...fields, _csrf: csrf });
      return request(target, {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
    },
    async postWithoutCsrf(target, fields = {}) {
      const body = new URLSearchParams(fields);
      return request(target, {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
    },
    async login(username, password = 'nqu1234') {
      const res = await request('/login', {
        method: 'POST',
        body: new URLSearchParams({ username, password, _csrf: await browser.csrfFrom('/login') }),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      if (res.status === 303) loggedIn = true;
      return res;
    },
    async csrfFrom(target) {
      const res = await follow(target);
      const html = await res.text();
      const match = CSRF_PATTERN.exec(html);
      if (match?.[1] === undefined) throw new Error(`在 ${target} 的 HTML 中找不到 CSRF 權杖`);
      return match[1];
    },
  };

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err === undefined ? resolve() : reject(err)));
    });
    fs.rmSync(dir, { recursive: true, force: true });
  };

  return { app, url, browser, close };
}

/** 送出表單前，先從含有該表單的頁面取得 CSRF 權杖。 */
function csrfSourceOf(target: string): string {
  const [path] = target.split('?');
  return path ?? '/';
}

/** 直接操作 Store 的測試輔助函式。 */
export function mutateStore(app: App, action: Parameters<Store['mutate']>[0]): void {
  app.store.mutate(action);
}
