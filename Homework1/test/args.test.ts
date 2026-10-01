import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, UsageError } from '../src/args.js';

describe('parseArgs', () => {
  it('解析基本 URL', () => {
    const options = parseArgs(['https://example.com']);
    assert.equal(options.url, 'https://example.com');
    assert.equal(options.method, '');
  });

  it('支援 --url 指定網址', () => {
    const options = parseArgs(['--url', 'https://example.com/a']);
    assert.equal(options.url, 'https://example.com/a');
  });

  it('解析 -X / --request', () => {
    assert.equal(parseArgs(['-X', 'DELETE', 'http://x']).method, 'DELETE');
    assert.equal(parseArgs(['--request=PUT', 'http://x']).method, 'PUT');
  });

  it('短選項可叢集（-sSLv）', () => {
    const options = parseArgs(['-sSLv', 'http://x']);
    assert.equal(options.silent, true);
    assert.equal(options.showError, true);
    assert.equal(options.followRedirects, true);
    assert.equal(options.verbose, true);
  });

  it('支援內嵌值的短選項（-XPOST、-HName: v）', () => {
    assert.equal(parseArgs(['-XPOST', 'http://x']).method, 'POST');
    const options = parseArgs(['-HAccept: application/json', 'http://x']);
    assert.deepEqual(options.headers, [['Accept', 'application/json']]);
  });

  it('重複的 -H 會保留，同名者後來覆蓋', () => {
    const options = parseArgs(['-H', 'A: 1', '-H', 'B: 2', '-H', 'A: 3', 'http://x']);
    assert.deepEqual(options.headers, [['B', '2'], ['A', '3']]);
  });

  it('「Header:」可移除標頭', () => {
    const options = parseArgs(['-H', 'A: 1', '-H', 'A:', 'http://x']);
    assert.deepEqual(options.headers, []);
  });

  it('--json 設定內文與標頭', () => {
    const options = parseArgs(['--json', '{"a":1}', 'http://x']);
    assert.equal(options.json, '{"a":1}');
  });

  it('-d 會串接多個資料並以 & 分隔', () => {
    const options = parseArgs(['-d', 'a=1', '-d', 'b=2', 'http://x']);
    assert.equal(Buffer.concat(options.data!.chunks).toString(), 'a=1&b=2');
  });

  it('--data-raw 不處理 @ 前綴', () => {
    const options = parseArgs(['--data-raw', '@literal', 'http://x']);
    assert.equal(Buffer.concat(options.data!.chunks).toString(), '@literal');
  });

  it('--data-urlencode 會編碼內容', () => {
    const options = parseArgs(['--data-urlencode', 'name=hello world', 'http://x']);
    assert.equal(Buffer.concat(options.data!.chunks).toString(), 'name=hello%20world');
  });

  it('-F 解析檔案上傳語法', () => {
    const options = parseArgs(['-F', 'file=@report.pdf', 'http://x']);
    assert.equal(options.forms.length, 1);
    assert.equal(options.forms[0]!.name, 'file');
    assert.equal(options.forms[0]!.file?.path, 'report.pdf');
    assert.equal(options.forms[0]!.file?.mode, 'upload');
  });

  it('--max-redirs 與 -m 會被轉為數字', () => {
    const options = parseArgs(['--max-redirs', '3', '-m', '2.5', 'http://x']);
    assert.equal(options.maxRedirects, 3);
    assert.equal(options.maxTime, 2.5);
  });

  it('--retry 會設定預設 retryDelay', () => {
    const options = parseArgs(['--retry', '2', 'http://x']);
    assert.equal(options.retry, 2);
    assert.equal(options.retryDelay, 1);
  });

  it('-- 之後的 token 視為 URL', () => {
    const options = parseArgs(['--', 'http://x/-weird']);
    assert.equal(options.url, 'http://x/-weird');
  });

  it('沒有 URL 時丟出 UsageError', () => {
    assert.throws(() => parseArgs(['-s']), UsageError);
  });

  it('未知的選項丟出 UsageError', () => {
    assert.throws(() => parseArgs(['--nope', 'http://x']), UsageError);
  });

  it('--help / -h 會設定 help', () => {
    assert.equal(parseArgs(['--help']).help, true);
    assert.equal(parseArgs(['-h']).help, true);
  });

  it('--version 會設定 version', () => {
    assert.equal(parseArgs(['--version']).version, true);
  });

  it('多個 URL 會被拒絕', () => {
    assert.throws(() => parseArgs(['http://a', 'http://b']), UsageError);
  });
});

describe('parseArgs config 檔', () => {
  let dir = '';

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'minicurl-cfg-'));
  });
  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('會讀取設定檔選項，且命令列可覆蓋', () => {
    const file = join(dir, 'a.conf');
    writeFileSync(file, '# 註解\n-s\n-X POST\n-H "X-From: cfg"\n');
    const options = parseArgs(['--config', file, '-X', 'DELETE', 'http://x']);
    assert.equal(options.silent, true);
    assert.equal(options.method, 'DELETE');
    assert.deepEqual(options.headers, [['X-From', 'cfg']]);
  });

  it('支援省略 -- 的長選項與 name = value 形式', () => {
    const file = join(dir, 'b.conf');
    writeFileSync(file, 'location\nmax-redirs = 7\nheader = "Accept-Language: zh-TW"\ncompressed\n');
    const options = parseArgs(['--config', file, 'http://x']);
    assert.equal(options.followRedirects, true);
    assert.equal(options.maxRedirects, 7);
    assert.equal(options.compressed, true);
    assert.deepEqual(options.headers, [['Accept-Language', 'zh-TW']]);
  });

  it('讀取專案附帶的 .mycurlrc.example 不會出錯', () => {
    const sample = join(process.cwd(), '.mycurlrc.example');
    if (!existsSync(sample)) return;
    const options = parseArgs(['--config', sample, 'http://x']);
    assert.equal(options.followRedirects, true);
    assert.equal(options.retry, 3);
    assert.equal(options.compressed, true);
  });
});
