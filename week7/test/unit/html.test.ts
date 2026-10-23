import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  attrs,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatScore,
  splitTokens,
} from '../../src/util/html.js';

describe('HTML 轉義', () => {
  test('escapeHtml 會轉義五個特殊字元', () => {
    assert.equal(
      escapeHtml(`<script>alert("x&y")</script>'`),
      '&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;&#39;',
    );
  });

  test('escapeHtml 對 null 與 undefined 回傳空字串', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });

  test('attrs 省略 false、null、undefined', () => {
    assert.equal(
      attrs({ id: 'a', hidden: true, disabled: false, title: null, alt: undefined }),
      ' id="a" hidden',
    );
  });

  test('attrs 會轉義屬性值', () => {
    assert.equal(attrs({ title: 'a"b' }), ' title="a&quot;b"');
  });
});

describe('顯示格式化', () => {
  test('formatDate 輸出 YYYY/MM/DD', () => {
    assert.equal(formatDate('2026-10-05T01:02:03.000Z'), '2026/10/05');
    assert.equal(formatDate(null), '');
    assert.equal(formatDate('not-a-date'), '');
  });

  test('formatDateTime 輸出日期與時間', () => {
    const local = new Date(2026, 9, 5, 14, 5);
    assert.equal(formatDateTime(local.toISOString()), '2026/10/05 14:05');
  });

  test('formatNumber 加上千分位', () => {
    assert.equal(formatNumber(67050), '67,050');
  });

  test('formatMoney 加上 NT$ 前綴', () => {
    assert.equal(formatMoney(67050), 'NT$ 67,050');
  });

  test('formatScore 整數不補小數，小數保留一位', () => {
    assert.equal(formatScore(90), '90');
    assert.equal(formatScore(89.5), '89.5');
  });

  test('splitTokens 以空白或逗號切割', () => {
    assert.deepEqual(splitTokens(' CS201、CS210, CS305 '), ['CS201', 'CS210', 'CS305']);
  });
});
