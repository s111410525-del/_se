import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  EMAIL_PATTERN,
  FormValidator,
  PHONE_PATTERN,
} from '../../src/core/validate.js';

describe('FormValidator 文字欄位', () => {
  test('必填欄位空白時產生錯誤', () => {
    const v = new FormValidator(new URLSearchParams({ name: '   ' }));
    assert.equal(v.text('name', { label: '姓名', required: true }), '');
    assert.equal(v.errors['name'], '姓名為必填欄位');
    assert.equal(v.ok, false);
  });

  test('非必填欄位空白時不算錯誤', () => {
    const v = new FormValidator(new URLSearchParams());
    assert.equal(v.text('nickname', { label: '暱稱' }), '');
    assert.equal(v.ok, true);
  });

  test('超過長度上限時產生錯誤', () => {
    const v = new FormValidator(new URLSearchParams({ name: '123456' }));
    assert.equal(v.text('name', { label: '姓名', maxLength: 5 }), '123456');
    assert.match(v.errors['name'] ?? '', /不得超過 5 個字/u);
  });

  test('低於長度下限時產生錯誤', () => {
    const v = new FormValidator(new URLSearchParams({ code: 'AB' }));
    assert.equal(v.text('code', { label: '代號', min: 3 }), 'AB');
    assert.match(v.errors['code'] ?? '', /至少需要 3 個字/u);
  });

  test('格式不符時產生錯誤並附上提示', () => {
    const v = new FormValidator(new URLSearchParams({ email: 'not-an-email' }));
    v.text('email', { label: '電子郵件', pattern: EMAIL_PATTERN, patternHint: 'name@example.com' });
    assert.match(v.errors['email'] ?? '', /格式不正確（name@example\.com）/u);
  });

  test('電話格式接受數字、括號與加號', () => {
    assert.equal(PHONE_PATTERN.test('0900-123-456'), true);
    assert.equal(PHONE_PATTERN.test('+886-2-1234-5678'), true);
    assert.equal(PHONE_PATTERN.test('abc'), false);
  });

  test('trim 可以關閉，保留原始空白', () => {
    const v = new FormValidator(new URLSearchParams({ note: '  hi  ' }), false);
    assert.equal(v.text('note', { label: '備註' }), '  hi  ');
    assert.equal(v.values['note'], '  hi  ');
  });
});

describe('FormValidator 整數與選項', () => {
  test('解析合法整數', () => {
    const v = new FormValidator(new URLSearchParams({ age: '20' }));
    assert.equal(v.integer('age', { label: '年齡', min: 1, max: 30 }), 20);
    assert.equal(v.ok, true);
  });

  test('非整數時回傳預設值並記錄錯誤', () => {
    const v = new FormValidator(new URLSearchParams({ age: '20.5' }));
    assert.equal(v.integer('age', { label: '年齡' }, 7), 7);
    assert.match(v.errors['age'] ?? '', /必須是整數/u);
  });

  test('小於下限或大於上限時記錄錯誤', () => {
    const low = new FormValidator(new URLSearchParams({ n: '0' }));
    assert.equal(low.integer('n', { label: '數量', min: 1 }, 1), 1);
    assert.match(low.errors['n'] ?? '', /不得小於 1/u);

    const high = new FormValidator(new URLSearchParams({ n: '99' }));
    assert.equal(high.integer('n', { label: '數量', max: 10 }, 10), 10);
    assert.match(high.errors['n'] ?? '', /不得大於 10/u);
  });

  test('空白整數欄位使用預設值', () => {
    const v = new FormValidator(new URLSearchParams());
    assert.equal(v.integer('n', { label: '數量' }, 3), 3);
    assert.equal(v.ok, true);
  });

  test('選項必須在允許清單中', () => {
    const v = new FormValidator(new URLSearchParams({ role: 'guest' }));
    assert.equal(v.choice('role', { label: '角色' }, ['student', 'teacher']), '');
    assert.match(v.errors['role'] ?? '', /不合法/u);
  });

  test('合法選項會回傳原始值', () => {
    const v = new FormValidator(new URLSearchParams({ role: 'teacher' }));
    assert.equal(v.choice('role', { label: '角色' }, ['student', 'teacher']), 'teacher');
  });

  test('message 會串接所有錯誤', () => {
    const v = new FormValidator(new URLSearchParams({ a: '', b: '' }));
    v.text('a', { label: '甲', required: true });
    v.text('b', { label: '乙', required: true });
    assert.equal(v.message(), '甲為必填欄位；乙為必填欄位');
  });
});
