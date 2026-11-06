#!/usr/bin/env node
import http from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

/** 啟動 HTTP 伺服器。 */
export async function start(port?: number): Promise<{ server: http.Server; url: string; close: () => Promise<void> }> {
  const config = loadConfig();
  const app = createApp({ config });
  const server = http.createServer(app.handler);

  const timer = setInterval(() => {
    const removed = app.sessions.prune();
    if (removed > 0) console.log(`[session] 清除 ${removed} 個過期的工作階段`);
  }, 60 * 60 * 1000);
  timer.unref();

  await new Promise<void>((resolve) => server.listen(port ?? config.port, config.host, resolve));
  const address = server.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : config.port;

  return {
    server,
    url: `http://${config.host}:${actualPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        clearInterval(timer);
        server.close((err) => (err === undefined ? resolve() : reject(err)));
      }),
  };
}

async function main(): Promise<void> {
  const { url } = await start();
  console.log('職光 JobBeam 已啟動');
  console.log(`  網址：${url}`);
  console.log('  示範帳號：dean / mira / lena / kai / admin（密碼皆為 job1234）');
  console.log('  按 Ctrl+C 結束。');
}

const invokedDirectly = process.argv[1] !== undefined
  && /(?:^|[\\/])(?:server|cli)\.(?:js|ts|mjs|cjs)$/.test(process.argv[1]);

if (invokedDirectly) void main();
