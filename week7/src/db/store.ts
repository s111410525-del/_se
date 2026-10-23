import fs from 'node:fs';
import path from 'node:path';
import type { Database } from '../types.js';

/** 建立一份全新的空白資料庫。 */
export function emptyDatabase(): Database {
  return {
    users: [],
    courses: [],
    enrollments: [],
    scores: [],
    notices: [],
    bills: [],
    payments: [],
  };
}

const COLLECTIONS: (keyof Database)[] = [
  'users',
  'courses',
  'enrollments',
  'scores',
  'notices',
  'bills',
  'payments',
];

/**
 * 以 JSON 檔案保存的資料儲存區。
 *
 * 這個專案刻意不使用資料庫引擎（既能專注在 HTTP 與領域邏輯，也讓安裝
 * 不需要任何執行期相依套件）。寫入時採用「先寫暫存檔再 rename」的原子操作，
 * 避免當機時留下半個 JSON 檔。
 */
export class Store {
  #db: Database = emptyDatabase();
  #loaded = false;

  constructor(
    readonly filePath: string,
    private readonly logger: Pick<Console, 'warn'> = console,
  ) {}

  /** 是否已經載入過資料。 */
  get loaded(): boolean {
    return this.#loaded;
  }

  /**
   * 從檔案載入資料；檔案不存在或內容損毀時改用種子資料。
   */
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

  /** 目前資料（唯讀參考，修改請走 `mutate()`）。 */
  get data(): Database {
    return this.#db;
  }

  /**
   * 修改資料並立即寫檔。
   *
   * 讓「改資料」與「存檔」綁在一起，可以避免某個 handler 忘了呼叫 `save()`
   * 而讓變更只存在於記憶體中、重啟後消失。
   */
  mutate<T>(fn: (db: Database) => T): T {
    const result = fn(this.#db);
    this.save();
    return result;
  }

  /** 把資料寫回檔案。 */
  save(): void {
    const target = path.resolve(this.filePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(this.#db, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, target);
  }

  /** 丟棄記憶體內容，下次 `load()` 重新讀檔。 */
  reload(seed: () => Database): Database {
    this.#loaded = false;
    return this.load(seed);
  }

  /** 清空資料並重新寫入種子資料。 */
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

  /** 補上舊版資料檔可能缺少的集合，避免 `undefined` 在服務層到處炸開。 */
  #migrate(raw: Database): Database {
    const base = emptyDatabase();
    for (const key of COLLECTIONS) {
      const value = raw[key];
      if (Array.isArray(value)) Object.assign(base, { [key]: value });
    }
    return base;
  }
}