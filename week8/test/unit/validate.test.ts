import test from 'node:test';
import assert from 'node:assert/strict';
import { FormValidator } from '../../src/core/validate.js';

test('整數欄位只比較數值範圍，不把位數當成字串長度', () => {
  const v = new FormValidator(new URLSearchParams({ amount: '100' }));
  const amount = v.integer('amount', { label: '提領金額', required: true, min: 100, max: 5000 }, 0);
  assert.equal(amount, 100);
  assert.equal(v.ok, true);
});

test('整數欄位會擋下非整數與超出範圍的值', () => {
  const notInteger = new FormValidator(new URLSearchParams({ amount: '10.5' }));
  assert.equal(notInteger.integer('amount', { label: '金額', min: 10, max: 5000 }, 0), 0);
  assert.equal(notInteger.ok, false);

  const tooSmall = new FormValidator(new URLSearchParams({ amount: '5' }));
  assert.equal(tooSmall.integer('amount', { label: '金額', min: 10, max: 5000 }, 0), 0);
  assert.equal(tooSmall.ok, false);

  const tooLarge = new FormValidator(new URLSearchParams({ amount: '6000' }));
  assert.equal(tooLarge.integer('amount', { label: '金額', min: 10, max: 5000 }, 0), 0);
  assert.equal(tooLarge.ok, false);
});

test('文字欄位仍會檢查必填與長度', () => {
  const missing = new FormValidator(new URLSearchParams({}));
  assert.equal(missing.text('name', { label: '筆名', required: true }), '');
  assert.equal(missing.ok, false);

  const short = new FormValidator(new URLSearchParams({ password: '123' }));
  assert.equal(short.text('password', { label: '密碼', min: 8 }), '123');
  assert.equal(short.ok, false);
});
