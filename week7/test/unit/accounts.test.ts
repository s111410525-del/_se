import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  advisorOf,
  describe as describeAccount,
  findById,
  findByUsername,
  requireStudent,
  teacherName,
  teacherOf,
  updateProfile,
} from '../../src/services/accounts.js';
import { freshDb, studentOf } from './helpers.js';

function isStatus(err: unknown, status: number): boolean {
  return err instanceof Error && 'status' in err && err.status === status;
}

describe('帳號查詢', () => {
  test('findByUsername 忽略大小寫與前後空白', () => {
    const db = freshDb();
    assert.equal(findByUsername(db, ' S001 ')?.id, 'u_s001');
    assert.equal(findByUsername(db, 'nobody'), undefined);
  });

  test('findById 找不到時回傳 undefined', () => {
    const db = freshDb();
    assert.equal(findById(db, 'u_s001')?.name, '陳秉硯');
    assert.equal(findById(db, 'nope'), undefined);
  });

  test('requireStudent 只接受學生', () => {
    const db = freshDb();
    assert.equal(requireStudent(studentOf(db, 'u_s001')).studentId, '41115001');
    assert.throws(
      () => requireStudent(findById(db, 'u_tchen')),
      (err: unknown) => isStatus(err, 400),
    );
    assert.throws(
      () => requireStudent(undefined),
      (err: unknown) => isStatus(err, 400),
    );
  });

  test('teacherOf 找不到時回傳 404', () => {
    const db = freshDb();
    assert.equal(teacherOf(db, 'u_tchen').name, '陳鍾誠');
    assert.throws(() => teacherOf(db, 'nope'), (err: unknown) => isStatus(err, 404));
  });

  test('teacherName 找不到時使用預設值', () => {
    const db = freshDb();
    assert.equal(teacherName(db, 'u_tchen'), '陳鍾誠');
    assert.equal(teacherName(db, 'nope'), '未指派');
    assert.equal(teacherName(db, 'nope', '外聘教師'), '外聘教師');
  });

  test('advisorOf 取得學生導師', () => {
    const db = freshDb();
    assert.equal(advisorOf(db, studentOf(db, 'u_s001'))?.id, 'u_tchen');
    const noAdvisor = studentOf(db, 'u_s002');
    noAdvisor.advisorId = null;
    assert.equal(advisorOf(db, noAdvisor), undefined);
  });
});

describe('帳號顯示資訊', () => {
  test('describe 會依角色產生不同說明', () => {
    const db = freshDb();
    const student = describeAccount(findById(db, 'u_s001')!);
    assert.equal(student.roleLabel, '學生');
    assert.match(student.detail, /41115001/u);

    const teacher = describeAccount(findById(db, 'u_tchen')!);
    assert.equal(teacher.roleLabel, '教師');
    assert.match(teacher.detail, /教授/u);

    const admin = describeAccount(findById(db, 'u_admin')!);
    assert.equal(admin.roleLabel, '教職員');
    assert.match(admin.detail, /A1001/u);
  });

  test('describe 不會輸出密碼雜湊與鹽', () => {
    const db = freshDb();
    const view = describeAccount(findById(db, 'u_s001')!);
    assert.equal('passwordHash' in view, false);
    assert.equal('passwordSalt' in view, false);
  });
});

describe('個人資料更新', () => {
  test('學生可以更新姓名、信箱、電話與地址', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    updateProfile(student, {
      name: '陳小硯',
      email: 'new@student.nqu.edu.tw',
      phone: '0912-345-678',
      address: '金門縣金城鎮新地址',
    });
    assert.equal(student.name, '陳小硯');
    assert.equal(student.email, 'new@student.nqu.edu.tw');
    assert.equal(student.phone, '0912-345-678');
    assert.equal(student.address, '金門縣金城鎮新地址');
  });

  test('教師不會被寫入電話與地址', () => {
    const db = freshDb();
    const teacher = findById(db, 'u_tchen');
    assert.ok(teacher !== undefined && teacher.role === 'teacher');
    const oldPhone = teacher.phone;
    updateProfile(teacher, { name: '陳老師', email: 'chen@nqu.edu.tw', phone: '0900-000-000' });
    assert.equal(teacher.name, '陳老師');
    assert.equal(teacher.phone, oldPhone);
  });

  test('姓名不得為空或過長', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.throws(
      () => updateProfile(student, { name: '', email: 'a@b.c' }),
      (err: unknown) => isStatus(err, 400),
    );
    assert.throws(
      () => updateProfile(student, { name: 'x'.repeat(21), email: 'a@b.c' }),
      (err: unknown) => isStatus(err, 400),
    );
  });

  test('電子郵件格式必須正確', () => {
    const db = freshDb();
    assert.throws(
      () => updateProfile(studentOf(db, 'u_s001'), { name: '陳秉硯', email: 'bad' }),
      (err: unknown) => isStatus(err, 400),
    );
  });

  test('電話與地址格式必須正確', () => {
    const db = freshDb();
    assert.throws(
      () => updateProfile(studentOf(db, 'u_s001'), { name: '陳秉硯', email: 'a@b.c', phone: 'abc' }),
      (err: unknown) => isStatus(err, 400),
    );
    assert.throws(
      () => updateProfile(studentOf(db, 'u_s001'), { name: '陳秉硯', email: 'a@b.c', address: 'x'.repeat(81) }),
      (err: unknown) => isStatus(err, 400),
    );
  });
});
