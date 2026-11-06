import { conflict, forbidden } from '../core/errors.js';
import { hashPassword } from '../core/password.js';
import type { Database, ProfileInput, SignupRole, User } from '../types.js';
import { newId } from '../util/id.js';

/** 保留帳號，避免與系統路徑或管理員名稱混淆。 */
const RESERVED = new Set([
  'admin',
  'root',
  'system',
  'jobbeam',
  'login',
  'register',
  'employer',
  'jobs',
  'messages',
  'wallet',
  'profile',
]);

export function findById(db: Database, id: string): User | undefined {
  return db.users.find((user) => user.id === id);
}

export function findByUsername(db: Database, username: string): User | undefined {
  const key = username.trim().toLowerCase();
  return db.users.find((user) => user.username.toLowerCase() === key);
}

export function needUser(db: Database, id: string): User {
  const user = findById(db, id);
  if (user === undefined) throw conflict('找不到這位使用者');
  return user;
}

export interface RegisterInput {
  username: string;
  name: string;
  email: string;
  password: string;
  role: SignupRole;
  company: string;
}

/** 建立免費帳號；帳號與電子郵件都必須唯一。 */
export function registerUser(db: Database, input: RegisterInput, now: string): User {
  const username = input.username.trim().toLowerCase();
  if (RESERVED.has(username)) throw conflict(`帳號 ${username} 是保留字，請換一個`);
  if (findByUsername(db, username) !== undefined) throw conflict(`帳號 ${username} 已經有人使用`);
  if (db.users.some((user) => user.email.toLowerCase() === input.email.trim().toLowerCase())) {
    throw conflict('這個電子郵件已經註冊過了');
  }
  if (input.role === 'employer' && input.company.trim() === '') {
    throw conflict('企業帳號需要填寫公司名稱');
  }

  const user: User = {
    id: newId('usr'),
    username,
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role,
    company: input.role === 'employer' ? input.company.trim() : '',
    bio: '',
    avatar: input.role === 'employer' ? '🏢' : '👤',
    balance: 0,
    createdAt: now,
    active: true,
    ...hashPassword(input.password),
  };
  db.users.push(user);
  return user;
}

/** 更新個人資料；電子郵件一樣不能與他人重複。 */
export function updateProfile(db: Database, user: User, input: ProfileInput): void {
  const email = input.email.trim().toLowerCase();
  if (db.users.some((other) => other.id !== user.id && other.email.toLowerCase() === email)) {
    throw conflict('這個電子郵件已經被其他帳號使用');
  }
  if (user.role === 'employer' && input.company.trim() === '') {
    throw conflict('企業帳號需要保留公司名稱');
  }

  user.name = input.name.trim();
  user.email = input.email.trim();
  user.company = user.role === 'employer' ? input.company.trim() : '';
  user.bio = input.bio.trim();
  user.avatar = input.avatar.trim() === '' ? (user.role === 'employer' ? '🏢' : '👤') : input.avatar.trim();
}

export function needEmployer(user: User): User {
  if (user.role !== 'employer') throw forbidden('只有企業帳號可以使用這項功能');
  return user;
}
