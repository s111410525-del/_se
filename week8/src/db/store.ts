import fs from 'node:fs';
import path from 'node:path';
import type { Database } from '../types.js';

/** 一份全新的空白資料庫。 */
export function emptyDatabase(): Database {
  return {
    users: [],
    works: [],
    chapters: [],
    comments: [],
    bookmarks: [],
    tips: [],
    earnings: [],
    withdrawals: [],
    promotions: [],
  };
}

const COLLECTIONS: (keyof Database)[] = [
  'users',
  'works',
  'chapters',
  'comments',
  'bookmarks',
  'tips',
  'earnings',
  'withdrawals',
  'promotions',
];

/**
 * JSON 檔案儲存區。
 *
 * 寫入時先寫暫存檔再 rename，避免當機時留下半個 JSON 檔。這個專案刻意
 * 不使用資料庫，讓安裝不需要任何執行期相依套件；要換成 SQLite 時只要
 * 提供相同形狀的 `Database` 即可。
 */
export class Store {
  #db: Database = emptyDatabase();
  #loaded = false;

  constructor(
    readonly filePath: string,
    private readonly logger: Pick<Console, 'warn'> = console,
  ) {}

  get loaded(): boolean {
    return this.#loaded;
  }

  load(seed: () => Database): Database {
    if (this.#loaded) return this.#db;

    const raw = this.#read();
    if (raw !== undefined) {
      this.#db = this.#migrate(raw);
      this.#loaded = true;
    } else {
      this.#db = seed();
      this.#loaded = true;
      this.save();
    }
    return this.#db;
  }

  get data(): Database {
    return this.#db;
  }

  /** 修改資料並立即存檔，避免變更只留在記憶體。 */
  mutate<T>(fn: (db: Database) => T): T {
    const result = fn(this.#db);
    this.save();
    return result;
  }

  save(): void {
    const target = path.resolve(this.filePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(this.#db, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, target);
  }

  reload(seed: () => Database): Database {
    this.#loaded = false;
    return this.load(seed);
  }

  reset(seed: () => Database): Database {
    this.#db = seed();
    this.#loaded = true;
    this.save();
    return this.#db;
  }

  #read(): Database | undefined {
    let text: string;
    try {
      text = fs.readFileSync(path.resolve(this.filePath), 'utf8');
    } catch {
      return undefined;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('根節點不是物件');
      return parsed as Database;
    } catch (err) {
      this.logger.warn(`[store] ${this.filePath} 內容損毀，改用示範資料：${(err as Error).message}`);
      return undefined;
    }
  }

  /** 補上舊版資料檔缺少的集合。 */
  #migrate(raw: Database): Database {
    const base = emptyDatabase();
    for (const key of COLLECTIONS) {
      const value = raw[key];
      if (Array.isArray(value)) Object.assign(base, { [key]: value });
    }
    return base;
  }
}
