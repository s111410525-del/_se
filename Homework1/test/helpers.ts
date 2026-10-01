import { Writable } from 'node:stream';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import type { AddressInfo } from 'node:net';

export interface Captured {
  out: NodeJS.WritableStream;
  err: NodeJS.WritableStream;
  stdout(): string;
  stderr(): string;
  stdoutBuffer(): Buffer;
}

/** 建立可攔截輸出的 Streams 物件。 */
export function capture(): Captured {
  const outChunks: Buffer[] = [];
  const errChunks: Buffer[] = [];
  const out = new Writable({
    write(chunk: Buffer, _enc, cb) {
      outChunks.push(Buffer.from(chunk));
      cb();
    },
  });
  const err = new Writable({
    write(chunk: Buffer, _enc, cb) {
      errChunks.push(Buffer.from(chunk));
      cb();
    },
  });
  return {
    out,
    err,
    stdout: () => Buffer.concat(outChunks).toString('utf8'),
    stderr: () => Buffer.concat(errChunks).toString('utf8'),
    stdoutBuffer: () => Buffer.concat(outChunks),
  };
}

export interface TestServer {
  url: string;
  port: number;
  close(): Promise<void>;
  /** 最近一次收到的請求資訊。 */
  last: {
    method: string;
    path: string;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
    rawBody: string;
  };
}

/** 啟動一個多用途的本機測試伺服器。 */
export async function startServer(): Promise<TestServer> {
  const state: TestServer['last'] = {
    method: '',
    path: '',
    headers: {},
    body: Buffer.alloc(0),
    rawBody: '',
  };
  let flakyHits = 0;

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      state.method = req.method ?? '';
      state.path = req.url ?? '';
      state.headers = req.headers;
      state.body = body;
      state.rawBody = body.toString('utf8');

      const route = (req.url ?? '/').split('?')[0]!;

      switch (route) {
        case '/hello':
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('hello world');
          return;
        case '/echo': {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            method: req.method,
            path: req.url,
            headers: req.headers,
            body: body.toString('utf8'),
          }));
          return;
        }
        case '/headers':
          res.setHeader('X-Custom', 'yes');
          res.setHeader('X-Dup', ['a', 'b']);
          res.writeHead(200);
          res.end('ok');
          return;
        case '/redirect':
          res.writeHead(302, { Location: '/hello' });
          res.end();
          return;
        case '/redirect-abs':
          res.writeHead(301, { Location: 'http://example.invalid/nowhere' });
          res.end();
          return;
        case '/status/404':
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('not found');
          return;
        case '/status/503': {
          flakyHits += 1;
          if (flakyHits < 2) {
            res.writeHead(503, { 'Retry-After': '0' });
            res.end('try later');
            return;
          }
          res.writeHead(200);
          res.end('recovered');
          return;
        }
        case '/gzip': {
          const payload = zlib.gzipSync(Buffer.from('compressed payload'));
          res.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Length': String(payload.length) });
          res.end(payload);
          return;
        }
        case '/set-cookie':
          res.writeHead(200, { 'Set-Cookie': 'session=abc123; Path=/; HttpOnly' });
          res.end('cookie set');
          return;
        case '/binary': {
          const data = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
          res.end(data);
          return;
        }
        case '/download':
          res.writeHead(200, { 'Content-Disposition': 'attachment; filename="report.txt"', 'Content-Type': 'text/plain' });
          res.end('attachment body');
          return;
        default:
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(`ok:${req.method}:${req.url}`);
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    last: state,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
}

/** 建立一個暫存目錄並回傳清理函式。 */
export function tempDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'minicurl-test-'));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
