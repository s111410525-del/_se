import { badRequest, notFound } from '../core/errors.js';
import { EMAIL_PATTERN, PHONE_PATTERN } from '../core/validate.js';
import type { Database, ProfileInput, Student, User } from '../types.js';

/** 以帳號名稱查詢使用者。 */
export function findByUsername(db: Database, username: string): User | undefined {
  const key = username.trim().toLowerCase();
  return db.users.find((user) => user.username.toLowerCase() === key);
}

/** 以 id 查詢使用者。 */
export function findById(db: Database, id: string): User | undefined {
  return db.users.find((user) => user.id === id);
}

/** 取出學生，未登入或角色不符時拋出 403。 */
export function requireStudent(user: User | undefined): Student {
  if (user === undefined || user.role !== 'student') {
    throw badRequest('這個功能只有學生可以使用');
  }
  return user;
}

/** 帳號公開資訊（不含密碼雜湊與鹽）。 */
export interface AccountView {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  detail: string;
}

const ROLE_TEXT: Record<User['role'], string> = {
  student: '學生',
  teacher: '教師',
  admin: '教職員',
};

/** 把使用者轉為可以安全顯示的物件。 */
export function describe(user: User): AccountView {
  let detail: string;
  switch (user.role) {
    case 'student':
      detail = `${user.studentId}　${user.department} ${user.className}`;
      break;
    case 'teacher':
      detail = `${user.title}　${user.department}　${user.office}`;
      break;
    case 'admin':
      detail = `${user.title}　${user.employeeId}`;
      break;
  }
  return { id: user.id, name: user.name, email: user.email, roleLabel: ROLE_TEXT[user.role], detail };
}

/** 依 id 取得教師，找不到時拋出 404。 */
export function teacherOf(db: Database, teacherId: string): User {
  const user = findById(db, teacherId);
  if (user === undefined) throw notFound(`找不到教師 ${teacherId}`);
  return user;
}

/** 教師姓名，找不到時回傳指定預設值。 */
export function teacherName(db: Database, teacherId: string, fallback = '未指派'): string {
  return findById(db, teacherId)?.name ?? fallback;
}

/**
 * 更新個人資料。
 *
 * 只開放「姓名、電子郵件、電話、地址」四個欄位；學號、系所、年級、角色
 * 屬於學校註冊資料，不允許自行修改。
 */
export function updateProfile(user: User, input: ProfileInput): void {
  const errors: string[] = [];
  if (input.name === '') errors.push('姓名為必填欄位');
  if (input.name.length > 20) errors.push('姓名不得超過 20 個字');
  if (!EMAIL_PATTERN.test(input.email)) errors.push('電子郵件格式不正確');
  if (input.phone !== undefined && input.phone !== '' && !PHONE_PATTERN.test(input.phone)) {
    errors.push('聯絡電話格式不正確');
  }
  if (input.address !== undefined && input.address.length > 80) errors.push('地址不得超過 80 個字');
  if (errors.length > 0) throw badRequest(errors.join('；'));

  if (user.role === 'student') {
    user.phone = input.phone ?? '';
    user.address = input.address ?? '';
  }
  user.name = input.name;
  user.email = input.email;
}

/** 取得學生的導師。 */
export function advisorOf(db: Database, student: Student): User | undefined {
  return student.advisorId === null ? undefined : findById(db, student.advisorId);
}