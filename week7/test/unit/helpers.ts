import { createSeedDatabase } from '../../src/db/seed.js';
import type { Course, Database, Student } from '../../src/types.js';

let base: Database | undefined;

/** 每個測試都拿到一份全新的種子資料，避免測試之間互相污染。 */
export function freshDb(): Database {
  base ??= createSeedDatabase();
  return structuredClone(base);
}

/** 以 id 取出學生，找不到就讓測試立即失敗。 */
export function studentOf(db: Database, id: string): Student {
  const user = db.users.find((item) => item.id === id);
  if (user === undefined || user.role !== 'student') throw new Error(`測試資料缺少學生 ${id}`);
  return user;
}

/** 以 id 取出課程。 */
export function courseOf(db: Database, id: string): Course {
  const course = db.courses.find((item) => item.id === id);
  if (course === undefined) throw new Error(`測試資料缺少課程 ${id}`);
  return course;
}
