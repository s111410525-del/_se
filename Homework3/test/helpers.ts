import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp, type App } from '../src/app.js';
import type { Store } from '../src/db/store.js';

export interface Harness {
  app: App;
  url: string;
  browser: Browser;
  close: () => Promise<void>;
}

export interface Browser {
  get: (path: string) => Promise<Response>;
  /** 送出表單；可指定要從哪個頁面取得 CSRF 權杖。 */
  post: (path: string, fields?: Record<string, string>, csrfFrom?: string) => Promise<Response>;
  postWithoutCsrf: (path: string, fields?: Record<string, string>) => Promise<Response>;
  login: (username: string, password?: string) => Promise<Response>;
  csrfFrom: (path: string) => Promise<string>;
  follow: (path: string, maxHops?: number) => Promise<Response>;
}

const CSRF_PATTERN = /name="_csrf" value="([^"]+)"/;

export async function startHarness(): Promise<Harness> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobbeam-test-'));
  const dataFile = path.join(dir, 'jobbeam.json');
  const app = createApp({ config: { dataFile, port: 0 } });
  const server = http.createServer(app.handler);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('無法取得測試伺服器位址');
  const url = `http://127.0.0.1:${address.port}`;

  const cookies = new Map<string, string>();

  const storeCookies = (res: Response): void => {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      if (pair === undefined) continue;
      const index = pair.indexOf('=');
      if (index <= 0) continue;
      cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  };

  const cookieHeader = (): string => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');

  const request = async (target: string, init?: RequestInit): Promise<Response> => {
    const res = await fetch(`${url}${target}`, {
      ...init,
      redirect: 'manual',
      headers: { ...init?.headers, cookie: cookieHeader() },
    });
    storeCookies(res);
    return res;
  };

  const follow = async (target: string, maxHops = 4): Promise<Response> => {
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
    get: (target) => request(target),
    async post(target, fields = {}, csrfFrom) {
      const source = csrfFrom ?? target.split('?')[0] ?? '/';
      const csrf = await browser.csrfFrom(source);
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
    async login(username, password = 'job1234') {
      return request('/login', {
        method: 'POST',
        body: new URLSearchParams({ username, password, _csrf: await browser.csrfFrom('/login') }),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
    },
    async csrfFrom(target) {
      const res = await follow(target);
      if (!res.ok) throw new Error(`取得 CSRF 失敗：${target} 回應 ${res.status}`);
      const html = await res.text();
      const match = CSRF_PATTERN.exec(html);
      if (match?.[1] === undefined) throw new Error(`在 ${target} 的 HTML 中找不到 CSRF 權杖`);
      return match[1];
    },
    follow,
  };

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err === undefined ? resolve() : reject(err)));
    });
    fs.rmSync(dir, { recursive: true, force: true });
  };

  return { app, url, browser, close };
}

export function mutateStore(app: App, action: Parameters<Store['mutate']>[0]): void {
  app.store.mutate(action);
}
