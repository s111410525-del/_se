import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createNotice,
  findNotice,
  listNotices,
  needNotice,
  pinnedNotices,
  removeNotice,
  togglePin,
  validateNotice,
} from '../../src/services/notices.js';
import type { Notice } from '../../src/types.js';
import { freshDb } from './helpers.js';

function isStatus(err: unknown, status: number): boolean {
  return err instanceof Error && 'status' in err && err.status === status;
}

describe('公告查詢', () => {
  test('置頂公告排在前面', () => {
    const db = freshDb();
    const notices = listNotices(db);
    assert.equal(notices[0]?.id, 'n_002');
    assert.equal(notices[1]?.id, 'n_001');
    assert.equal(notices[0]?.pinned, true);
  });

  test('依類別篩選', () => {
    const db = freshDb();
    const notices = listNotices(db, { category: '公告' });
    assert.equal(notices.length, 2);
    assert.equal(notices.every((notice) => notice.category === '公告'), true);
  });

  test('依關鍵字搜尋標題與內文', () => {
    const db = freshDb();
    assert.equal(listNotices(db, { keyword: '繳費' }).length, 1);
    assert.equal(listNotices(db, { keyword: '機房' }).length, 1);
    assert.equal(listNotices(db, { keyword: '不存在的字' }).length, 0);
  });

  test('findNotice 與 needNotice', () => {
    const db = freshDb();
    assert.equal(findNotice(db, 'n_001')?.title.includes('選課'), true);
    assert.equal(findNotice(db, 'missing'), undefined);
    assert.throws(() => needNotice(db, 'missing'), (err: unknown) => isStatus(err, 404));
  });

  test('pinnedNotices 只回傳置頂公告並限制數量', () => {
    const db = freshDb();
    assert.equal(pinnedNotices(db).length, 2);
    assert.equal(pinnedNotices(db, 1).length, 1);
  });
});

describe('公告管理', () => {
  test('validateNotice 接受合法內容', () => {
    const input = { title: '測試', category: '公告' as const, body: '內容', pinned: false };
    assert.deepEqual(validateNotice(input), input);
  });

  test('標題不得為空', () => {
    assert.throws(
      () => validateNotice({ title: '', category: '公告', body: '內容', pinned: false }),
      (err: unknown) => isStatus(err, 400) && err instanceof Error && /標題不得為空/u.test(err.message),
    );
  });

  test('標題與內文有長度上限', () => {
    assert.throws(
      () => validateNotice({ title: 'x'.repeat(61), category: '公告', body: '內容', pinned: false }),
      (err: unknown) => isStatus(err, 400),
    );
    assert.throws(
      () => validateNotice({ title: '標題', category: '公告', body: 'x'.repeat(4001), pinned: false }),
      (err: unknown) => isStatus(err, 400),
    );
  });

  test('類別必須合法', () => {
    assert.throws(
      () => validateNotice({ title: '標題', category: '不存在' as Notice['category'], body: '', pinned: false }),
      (err: unknown) => isStatus(err, 400),
    );
  });

  test('createNotice 會新增公告並使用指定時間', () => {
    const db = freshDb();
    const notice = createNotice(
      db,
      'u_admin',
      { title: '新公告', category: '活動', body: '說明', pinned: true },
      new Date('2026-10-05T01:00:00.000Z'),
    );
    assert.equal(notice.publishedAt, '2026-10-05T01:00:00.000Z');
    assert.equal(db.notices[0]?.id, notice.id);
    assert.equal(listNotices(db)[0]?.id, notice.id);
  });

  test('togglePin 切換置頂狀態', () => {
    const db = freshDb();
    const before = findNotice(db, 'n_003')?.pinned;
    assert.equal(before, false);
    togglePin(db, 'n_003');
    assert.equal(findNotice(db, 'n_003')?.pinned, true);
    togglePin(db, 'n_003');
    assert.equal(findNotice(db, 'n_003')?.pinned, false);
  });

  test('removeNotice 刪除公告，找不到時回傳 404', () => {
    const db = freshDb();
    removeNotice(db, 'n_003');
    assert.equal(findNotice(db, 'n_003'), undefined);
    assert.throws(() => removeNotice(db, 'n_003'), (err: unknown) => isStatus(err, 404));
  });
});
