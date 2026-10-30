import { conflict } from '../core/errors.js';
import { hashPassword } from '../core/password.js';
import { newId } from '../util/id.js';
import type { Database, Plan, ProfileInput, User } from '../types.js';

/** 保留帳號，避免與系統路徑或管理員名稱混淆。 */
const RESERVED = new Set(['admin', 'root', 'system', 'inkflow', 'login', 'register', 'studio']);

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
}

/** 建立免費帳號；帳號與電子郵件都必須唯一。 */
export function registerUser(db: Database, input: RegisterInput, now: string): User {
  const username = input.username.trim().toLowerCase();
  if (RESERVED.has(username)) throw conflict(`帳號 ${username} 是保留字，請換一個`);
  if (findByUsername(db, username) !== undefined) throw conflict(`帳號 ${username} 已經有人使用`);
  if (db.users.some((user) => user.email.toLowerCase() === input.email.trim().toLowerCase())) {
    throw conflict('這個電子郵件已經註冊過了');
  }

  const user: User = {
    id: newId('usr'),
    username,
    name: input.name.trim(),
    email: input.email.trim(),
    role: 'member',
    plan: 'free',
    bio: '',
    avatar: '🪶',
    createdAt: now,
    planSince: null,
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
  user.name = input.name.trim();
  user.email = input.email.trim();
  user.bio = input.bio.trim();
  user.avatar = input.avatar.trim() === '' ? '🪶' : input.avatar.trim();
}

/** 切換帳號方案。示範平台不串接金流，升級只記錄方案與時間。 */
export function setPlan(user: User, plan: Plan, now: string): void {
  if (user.plan === plan) return;
  user.plan = plan;
  user.planSince = plan === 'pro' ? now : null;
}

export function isPro(user: User | undefined): boolean {
  return user !== undefined && user.plan === 'pro';
}
