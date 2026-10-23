import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { hashPassword, verifyPassword } from '../../src/core/password.js';

describe('密碼雜湊', () => {
  test('正確密碼可以通過驗證', () => {
    const credentials = hashPassword('nqu1234');
    assert.equal(verifyPassword('nqu1234', credentials), true);
  });

  test('錯誤密碼無法通過驗證', () => {
    const credentials = hashPassword('nqu1234');
    assert.equal(verifyPassword('NQU1234', credentials), false);
    assert.equal(verifyPassword('', credentials), false);
  });

  test('每次雜湊都使用不同的鹽', () => {
    const first = hashPassword('same-password');
    const second = hashPassword('same-password');
    assert.notEqual(first.passwordSalt, second.passwordSalt);
    assert.notEqual(first.passwordHash, second.passwordHash);
  });

  test('雜湊值與鹽都是十六進位字串', () => {
    const credentials = hashPassword('abc123');
    assert.match(credentials.passwordSalt, /^[0-9a-f]{32}$/u);
    assert.match(credentials.passwordHash, /^[0-9a-f]{64}$/u);
  });
});
