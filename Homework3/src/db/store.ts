import fs from 'node:fs';
import path from 'node:path';
import type { Database } from '../types.js';

/** 一份全新的空白資料庫。 */
export function emptyDatabase(): Database {
  return {
    users: [],
    jobs: [],
    conversations: [],
    messages: [],
    promotions: [],
    topups: [],
    ledger: [],
  };
}

const COLLECTIONS: (keyof Database)[] = [
  'users',
  'jobs',
  'conversations',
  'messages',
  'promotions',
  'topups',
  'ledger',
];

/**
 * JSON 檔案資料庫。
 *
 * 寫入時先寫暫存檔再 rename，避免當機時留下半截 JSON。這個專案刻意
 * 不引入第三方資料庫，安裝後不需要任何執行期套件。
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

  /** 修改資料並立即寫入檔案，回傳 fn 的結果。 */
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
      if (typeof parsed !== 'object' || parsed === null) throw new Error('頂層不是物件');
      return parsed as Database;
    } catch (err) {
      this.logger.warn(`[store] ${this.filePath} 內容損毀，改用示範資料：${(err as Error).message}`);
      return undefined;
    }
  }

  /** 補齊舊資料檔缺少的集合。 */
  #migrate(raw: Database): Database {
    const base = emptyDatabase();
    for (const key of COLLECTIONS) {
      const value = raw[key];
      if (Array.isArray(value)) Object.assign(base, { [key]: value });
    }
    return base;
  }
}
