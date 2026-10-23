import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizePath, Router, type Handler } from '../../src/core/router.js';

const noop: Handler = () => {};

describe('normalizePath', () => {
  test('移除尾端斜線', () => {
    assert.equal(normalizePath('/courses/'), '/courses');
    assert.equal(normalizePath('/courses///'), '/courses//');
  });

  test('根路徑維持不變', () => {
    assert.equal(normalizePath('/'), '/');
  });
});

describe('Router', () => {
  test('符合靜態路徑', () => {
    const router = new Router().get('/courses', noop);
    const result = router.match('GET', '/courses');
    assert.equal(result.kind, 'matched');
    if (result.kind === 'matched') assert.deepEqual(result.params, {});
  });

  test('尾端斜線視為同一條路由', () => {
    const router = new Router().get('/courses', noop);
    assert.equal(router.match('GET', '/courses/').kind, 'matched');
  });

  test('解析並解碼路徑參數', () => {
    const router = new Router().get('/courses/:id/students/:studentId', noop);
    const result = router.match('GET', '/courses/c%201/students/u_001');
    assert.equal(result.kind, 'matched');
    if (result.kind === 'matched') {
      assert.deepEqual(result.params, { id: 'c 1', studentId: 'u_001' });
    }
  });

  test('找不到路徑時回傳 not-found', () => {
    const router = new Router().get('/courses', noop);
    assert.equal(router.match('GET', '/missing').kind, 'not-found');
  });

  test('路徑存在但方法不支援時列出允許的方法', () => {
    const router = new Router().get('/courses', noop).post('/courses', noop);
    const result = router.match('DELETE', '/courses');
    assert.equal(result.kind, 'method-not-allowed');
    if (result.kind === 'method-not-allowed') assert.deepEqual(result.allowed.sort(), ['GET', 'POST']);
  });

  test('方法名稱不分大小寫', () => {
    const router = new Router().post('/login', noop);
    assert.equal(router.match('post', '/login').kind, 'matched');
  });

  test('根路徑可以註冊與比對', () => {
    const router = new Router().get('/', noop);
    assert.equal(router.match('GET', '/').kind, 'matched');
  });

  test('size 回傳已註冊的路由數量', () => {
    const router = new Router().get('/a', noop).post('/a', noop).get('/b', noop);
    assert.equal(router.size, 3);
  });
});
