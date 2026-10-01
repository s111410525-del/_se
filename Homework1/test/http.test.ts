import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run } from '../src/cli.js';
import { capture, startServer, tempDir, type TestServer } from './helpers.js';

let server: TestServer;

before(async () => {
  server = await startServer();
});
after(async () => {
  await server.close();
});

async function exec(args: string[]): Promise<{ code: number; out: string; err: string; outBuffer: Buffer }> {
  const streams = capture();
  const code = await run(args, { out: streams.out, err: streams.err, isTty: false });
  return { code, out: streams.stdout(), err: streams.stderr(), outBuffer: streams.stdoutBuffer() };
}

describe('基本請求', () => {
  it('GET 並輸出 body', async () => {
    const { code, out } = await exec([`${server.url}/hello`]);
    assert.equal(code, 0);
    assert.equal(out, 'hello world');
  });

  it('預設送出 User-Agent 與 Accept', async () => {
    await exec([`${server.url}/hello`]);
    assert.match(server.last.headers['user-agent'] ?? '', /^minicurl\//);
    assert.equal(server.last.headers.accept, '*/*');
  });

  it('-A 可覆蓋 User-Agent', async () => {
    await exec(['-A', 'my-agent/9', `${server.url}/hello`]);
    assert.equal(server.last.headers['user-agent'], 'my-agent/9');
  });

  it('-H 自訂標頭會送出', async () => {
    await exec(['-H', 'X-Token: secret', `${server.url}/hello`]);
    assert.equal(server.last.headers['x-token'], 'secret');
  });

  it('-e 設定 Referer', async () => {
    await exec(['-e', 'https://ref.example/', `${server.url}/hello`]);
    assert.equal(server.last.headers.referer, 'https://ref.example/');
  });
});

describe('HTTP 方法與資料', () => {
  it('-d 自動使用 POST', async () => {
    const { out } = await exec(['-d', 'a=1&b=2', `${server.url}/echo`]);
    const echoed = JSON.parse(out) as { method: string; body: string; headers: Record<string, string> };
    assert.equal(echoed.method, 'POST');
    assert.equal(echoed.body, 'a=1&b=2');
    assert.equal(echoed.headers['content-type'], 'application/x-www-form-urlencoded');
  });

  it('-X PUT 搭配 -d', async () => {
    const { out } = await exec(['-X', 'PUT', '-d', 'x', `${server.url}/echo`]);
    assert.equal((JSON.parse(out) as { method: string }).method, 'PUT');
  });

  it('--json 設定 Content-Type 與 Accept', async () => {
    const { out } = await exec(['--json', '{"n":1}', `${server.url}/echo`]);
    const echoed = JSON.parse(out) as { headers: Record<string, string>; body: string };
    assert.equal(echoed.headers['content-type'], 'application/json');
    assert.equal(echoed.headers.accept, 'application/json');
    assert.equal(echoed.body, '{"n":1}');
  });

  it('-d @file 讀取檔案內容', async () => {
    const tmp = tempDir();
    try {
      const file = path.join(tmp.dir, 'payload.txt');
      fs.writeFileSync(file, 'from-file');
      const { out } = await exec(['-d', `@${file}`, `${server.url}/echo`]);
      assert.equal((JSON.parse(out) as { body: string }).body, 'from-file');
    } finally {
      tmp.cleanup();
    }
  });

  it('-G 將資料放到 query string', async () => {
    const { out } = await exec(['-G', '-d', 'q=hello', `${server.url}/echo`]);
    const echoed = JSON.parse(out) as { method: string; path: string };
    assert.equal(echoed.method, 'GET');
    assert.equal(echoed.path, '/echo?q=hello');
  });

  it('-F 送出 multipart 並附檔', async () => {
    const tmp = tempDir();
    try {
      const file = path.join(tmp.dir, 'note.txt');
      fs.writeFileSync(file, 'file-content');
      const { out } = await exec(['-F', `upload=@${file}`, '-F', 'field=value', `${server.url}/echo`]);
      const echoed = JSON.parse(out) as { headers: Record<string, string>; body: string };
      assert.match(echoed.headers['content-type'] ?? '', /^multipart\/form-data; boundary=/);
      assert.match(echoed.body, /name="field"\r\n\r\nvalue/);
      assert.match(echoed.body, /filename="note.txt"/);
      assert.match(echoed.body, /file-content/);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('輸出選項', () => {
  it('-o 將 body 寫入檔案', async () => {
    const tmp = tempDir();
    try {
      const file = path.join(tmp.dir, 'out.txt');
      const { code, out } = await exec(['-o', file, `${server.url}/hello`]);
      assert.equal(code, 0);
      assert.equal(out, '');
      assert.equal(fs.readFileSync(file, 'utf8'), 'hello world');
    } finally {
      tmp.cleanup();
    }
  });

  it('-i 在輸出中包含標頭', async () => {
    const { out } = await exec(['-i', `${server.url}/hello`]);
    assert.match(out, /^HTTP\/1\.1 200 OK\r\n/);
    assert.match(out, /Content-Type: text\/plain/);
    assert.match(out, /hello world$/);
  });

  it('-I 只送出 HEAD 請求', async () => {
    const { out } = await exec(['-I', `${server.url}/hello`]);
    assert.equal(server.last.method, 'HEAD');
    assert.match(out, /^HTTP\/1\.1 200 OK/);
  });

  it('-D 將標頭寫入檔案', async () => {
    const tmp = tempDir();
    try {
      const file = path.join(tmp.dir, 'headers.txt');
      await exec(['-D', file, `${server.url}/hello`]);
      assert.match(fs.readFileSync(file, 'utf8'), /HTTP\/1\.1 200 OK/);
    } finally {
      tmp.cleanup();
    }
  });

  it('-O 以 URL 名稱存檔', async () => {
    const tmp = tempDir();
    const cwd = process.cwd();
    try {
      process.chdir(tmp.dir);
      await exec(['-O', `${server.url}/hello`]);
      assert.equal(fs.readFileSync(path.join(tmp.dir, 'hello'), 'utf8'), 'hello world');
    } finally {
      process.chdir(cwd);
      tmp.cleanup();
    }
  });

  it('--remote-header-name 以 Content-Disposition 檔名存檔', async () => {
    const tmp = tempDir();
    const cwd = process.cwd();
    try {
      process.chdir(tmp.dir);
      await exec(['-O', '--remote-header-name', `${server.url}/download`]);
      assert.equal(fs.readFileSync(path.join(tmp.dir, 'report.txt'), 'utf8'), 'attachment body');
    } finally {
      process.chdir(cwd);
      tmp.cleanup();
    }
  });

  it('-w 輸出統計資訊', async () => {
    const tmp = tempDir();
    try {
      const file = path.join(tmp.dir, 'sink');
      const { out } = await exec(['-o', file, '-w', 'code=%{http_code} size=%{size_download}', `${server.url}/hello`]);
      assert.match(out, /code=200 size=11/);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('重新導向', () => {
  it('-L 跟隨 302', async () => {
    const { code, out } = await exec(['-L', `${server.url}/redirect`]);
    assert.equal(code, 0);
    assert.equal(out, 'hello world');
  });

  it('不使用 -L 時不跟隨', async () => {
    const { out } = await exec(['-i', `${server.url}/redirect`]);
    assert.match(out, /^HTTP\/1\.1 302/);
    assert.match(out, /Location: \/hello/);
  });

  it('--max-redirs 0 會回報超過上限', async () => {
    const { code } = await exec(['-L', '--max-redirs', '0', `${server.url}/redirect`]);
    assert.equal(code, 47);
  });
});

describe('Cookie', () => {
  it('-b 送出 Cookie', async () => {
    await exec(['-b', 'a=1; b=2', `${server.url}/echo`]);
    assert.equal(server.last.headers.cookie, 'a=1; b=2');
  });

  it('-c 將 Set-Cookie 寫入 jar，後續請求會帶上', async () => {
    const tmp = tempDir();
    try {
      const jar = path.join(tmp.dir, 'cookies.txt');
      await exec(['-c', jar, `${server.url}/set-cookie`]);
      assert.match(fs.readFileSync(jar, 'utf8'), /session\tabc123/);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('壓縮與重試', () => {
  it('--compressed 自動解壓 gzip', async () => {
    const { out } = await exec(['--compressed', `${server.url}/gzip`]);
    assert.equal(out, 'compressed payload');
  });

  it('未加 --compressed 時保持壓縮內容', async () => {
    const { outBuffer } = await exec([`${server.url}/gzip`]);
    assert.notEqual(outBuffer.toString('utf8'), 'compressed payload');
  });

  it('--retry 會重試 503', async () => {
    const { code, out } = await exec(['--retry', '2', `${server.url}/status/503`]);
    assert.equal(code, 0);
    assert.equal(out, 'recovered');
  });
});

describe('錯誤處理', () => {
  it('404 回傳 exit code 22', async () => {
    const { code, out } = await exec([`${server.url}/status/404`]);
    assert.equal(code, 22);
    assert.equal(out, 'not found');
  });

  it('無法連線回傳 exit code 7', async () => {
    const { code, err } = await exec(['http://127.0.0.1:1/']);
    assert.equal(code, 7);
    assert.match(err, /連線遭拒絕/);
  });

  it('不支援的協定回傳 exit code 1', async () => {
    const { code } = await exec(['ftp://example.com/file']);
    assert.equal(code, 1);
  });

  it('無效 URL 回傳 exit code 3', async () => {
    const { code } = await exec(['http://']);
    assert.equal(code, 3);
  });

  it('未知選項回傳 exit code 2', async () => {
    const { code, err } = await exec(['--bogus']);
    assert.equal(code, 2);
    assert.match(err, /未知的選項/);
  });

  it('--help 輸出使用說明並回傳 0', async () => {
    const { code, out } = await exec(['--help']);
    assert.equal(code, 0);
    assert.match(out, /Usage: minicurl/);
  });

  it('--version 輸出號版資訊', async () => {
    const { code, out } = await exec(['--version']);
    assert.equal(code, 0);
    assert.match(out, /^minicurl \d+\.\d+\.\d+/);
  });
});

describe('詳細模式', () => {
  it('-v 在 stderr 顯示請求與回應', async () => {
    const { err } = await exec(['-v', `${server.url}/hello`]);
    assert.match(err, /> GET \/hello HTTP\/1\.1/);
    assert.match(err, /< HTTP\/1\.1 200 OK/);
  });

  it('-s 抑制所有診斷輸出', async () => {
    const { err } = await exec(['-s', `${server.url}/hello`]);
    assert.equal(err, '');
  });
});
