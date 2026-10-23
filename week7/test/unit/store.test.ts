import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { Store } from '../../src/db/store.js';
import type { Database } from '../../src/types.js';

function seed(): Database {
  return {
    users: [],
    courses: [],
    enrollments: [],
    scores: [],
    notices: [
      {
        id: 'n_test',
        title: '測試公告',
        category: '公告',
        body: '內容',
        authorId: 'u_admin',
        pinned: false,
        publishedAt: '2026-10-05T00:00:00.000Z',
      },
    ],
    bills: [],
    payments: [],
  };
}

describe('JSON 資料儲存區', () => {
  let dir: string;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nqu-store-'));
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('第一次載入會建立種子資料並寫檔', () => {
    const file = path.join(dir, 'first.json');
    const store = new Store(file);
    const data = store.load(seed);
    assert.equal(store.loaded, true);
    assert.equal(data.notices.length, 1);
    assert.equal(fs.existsSync(file), true);
  });

  test('mutate 的變更會立即寫入檔案', () => {
    const file = path.join(dir, 'mutate.json');
    const store = new Store(file);
    store.load(seed);
    store.mutate((db) => {
      db.notices.push({
        id: 'n_second',
        title: '第二則',
        category: '活動',
        body: '內容',
        authorId: 'u_admin',
        pinned: false,
        publishedAt: '2026-10-06T00:00:00.000Z',
      });
    });

    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Database;
    assert.equal(raw.notices.length, 2);
  });

  test('重新建立 Store 可以讀回先前寫入的資料', () => {
    const file = path.join(dir, 'reload.json');
    const first = new Store(file);
    first.load(seed);
    first.mutate((db) => {
      db.notices[0]!.title = '已修改';
    });

    const second = new Store(file);
    const data = second.load(seed);
    assert.equal(data.notices[0]?.title, '已修改');
  });

  test('reload 會重新讀取檔案內容', () => {
    const file = path.join(dir, 'reload-twice.json');
    const store = new Store(file);
    store.load(seed);
    const replacement = seed();
    replacement.notices[0]!.title = '磁碟上的版本';
    fs.writeFileSync(file, JSON.stringify(replacement), 'utf8');

    const data = store.reload(seed);
    assert.equal(data.notices[0]?.title, '磁碟上的版本');
  });

  test('檔案損毀時退回種子資料並警告', () => {
    const file = path.join(dir, 'broken.json');
    fs.writeFileSync(file, '{ not json', 'utf8');
    const warnings: string[] = [];
    const store = new Store(file, { warn: (message) => warnings.push(message) });
    const data = store.load(seed);
    assert.equal(data.notices[0]?.title, '測試公告');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /內容損毀/u);
  });

  test('舊資料缺少集合時會補上空陣列', () => {
    const file = path.join(dir, 'legacy.json');
    fs.writeFileSync(file, JSON.stringify({ users: [], notices: [] }), 'utf8');
    const store = new Store(file);
    const data = store.load(seed);
    assert.deepEqual(data.courses, []);
    assert.deepEqual(data.bills, []);
    assert.deepEqual(data.payments, []);
  });

  test('reset 會以新的種子資料覆蓋', () => {
    const file = path.join(dir, 'reset.json');
    const store = new Store(file);
    store.load(seed);
    store.mutate((db) => {
      db.notices = [];
    });
    assert.equal(store.data.notices.length, 0);
    store.reset(seed);
    assert.equal(store.data.notices.length, 1);
  });
});
