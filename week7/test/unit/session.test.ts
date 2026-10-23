import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SessionStore } from '../../src/core/session.js';

describe('SessionStore', () => {
  test('建立的工作階段包含權杖、CSRF 與使用者', () => {
    const store = new SessionStore(1000, () => 100);
    const session = store.create('u_s001');
    assert.equal(session.userId, 'u_s001');
    assert.match(session.token, /^[0-9a-f]{48}$/u);
    assert.match(session.csrf, /^[0-9a-f]{48}$/u);
    assert.equal(session.createdAt, 100);
    assert.equal(session.expiresAt, 1100);
    assert.equal(store.size, 1);
  });

  test('取得工作階段會 sliding 延長到期時間', () => {
    let now = 0;
    const store = new SessionStore(100, () => now);
    const session = store.create('u1');
    now = 90;
    assert.ok(store.get(session.token) !== undefined);
    assert.equal(session.expiresAt, 190);
  });

  test('過期的工作階段會被刪除並回傳 undefined', () => {
    let now = 0;
    const store = new SessionStore(100, () => now);
    const session = store.create('u1');
    now = 101;
    assert.equal(store.get(session.token), undefined);
    assert.equal(store.size, 0);
  });

  test('prune 清除所有過期工作階段', () => {
    let now = 0;
    const store = new SessionStore(10, () => now);
    store.create('a');
    now = 5;
    store.create('b');
    now = 20;
    assert.equal(store.prune(), 2);
    assert.equal(store.size, 0);
  });

  test('rotate 會換發新的權杖與 CSRF，舊權杖立即失效', () => {
    let now = 0;
    const store = new SessionStore(100, () => now);
    const session = store.create('u1');
    const oldToken = session.token;
    const oldCsrf = session.csrf;

    now = 10;
    const next = store.rotate(session);
    assert.notEqual(next.token, oldToken);
    assert.notEqual(next.csrf, oldCsrf);
    assert.equal(next.userId, 'u1');
    assert.equal(store.get(oldToken), undefined);
    assert.ok(store.get(next.token) !== undefined);
  });

  test('destroy 可移除工作階段', () => {
    const store = new SessionStore(100);
    const session = store.create('u1');
    store.destroy(session.token);
    assert.equal(store.get(session.token), undefined);
  });

  test('flash 訊息取出後會清空', () => {
    const store = new SessionStore(100);
    const session = store.create('u1');
    store.addFlash(session, 'success', '已儲存');
    store.addFlash(session, 'error', '發生錯誤');

    const messages = store.takeFlash(session);
    assert.deepEqual(messages, [
      { kind: 'success', text: '已儲存' },
      { kind: 'error', text: '發生錯誤' },
    ]);
    assert.deepEqual(store.takeFlash(session), []);
  });

  test('takeFlash(undefined) 回傳空陣列', () => {
    const store = new SessionStore(100);
    assert.deepEqual(store.takeFlash(undefined), []);
  });
});
