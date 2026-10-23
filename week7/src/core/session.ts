import { randomBytes } from 'node:crypto';

/** 短訊息種類，對應畫面上的提示樣式。 */
export type FlashKind = 'success' | 'error' | 'info';

export interface FlashMessage {
  kind: FlashKind;
  text: string;
}

/** 一個使用者的工作階段。 */
export interface Session {
  token: string;
  userId: string;
  /** CSRF 權杖，所有會改動資料的表單都要帶回來。 */
  csrf: string;
  createdAt: number;
  expiresAt: number;
  flash: FlashMessage[];
}

function randomToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * 工作階段儲存區。
 *
 * Session 刻意只放在記憶體：登入狀態不落地到 JSON 檔案，重啟服務即全部失效，
 * 這比把權杖寫進檔案安全。CSRF 權杖則隨 session 一起產生。
 */
export class SessionStore {
  readonly #sessions = new Map<string, Session>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** 建立新的工作階段。 */
  create(userId: string): Session {
    const at = this.now();
    const session: Session = {
      token: randomToken(),
      userId,
      csrf: randomToken(),
      createdAt: at,
      expiresAt: at + this.ttlMs,
      flash: [],
    };
    this.#sessions.set(session.token, session);
    return session;
  }

  /** 取出工作階段，若過期則順手刪除並回傳 `undefined`。 */
  get(token: string | undefined): Session | undefined {
    if (token === undefined) return undefined;
    const session = this.#sessions.get(token);
    if (session === undefined) return undefined;
    if (session.expiresAt <= this.now()) {
      this.#sessions.delete(token);
      return undefined;
    }
    // 滑動式延長：每次有活動就重新計算到期時間。
    session.expiresAt = this.now() + this.ttlMs;
    return session;
  }

  /** 銷毀工作階段（登出）。 */
  destroy(token: string): void {
    this.#sessions.delete(token);
  }

  /** 換發新的權杖，避免登入前後沿用同一組數字。 */
  rotate(session: Session): Session {
    this.#sessions.delete(session.token);
    const next: Session = {
      ...session,
      token: randomToken(),
      csrf: randomToken(),
      createdAt: this.now(),
      expiresAt: this.now() + this.ttlMs,
    };
    this.#sessions.set(next.token, next);
    return next;
  }

  /** 加入一則要在下一頁顯示的提示訊息。 */
  addFlash(session: Session, kind: FlashKind, text: string): void {
    session.flash.push({ kind, text });
  }

  /** 取出並清空提示訊息（避免重新整理時重複顯示）。 */
  takeFlash(session: Session | undefined): FlashMessage[] {
    if (session === undefined) return [];
    const messages = session.flash;
    session.flash = [];
    return messages;
  }

  /** 目前線上的工作階段數量。 */
  get size(): number {
    return this.#sessions.size;
  }

  /** 清除所有已過期的工作階段。 */
  prune(): number {
    const now = this.now();
    let removed = 0;
    for (const [token, session] of this.#sessions) {
      if (session.expiresAt <= now) {
        this.#sessions.delete(token);
        removed += 1;
      }
    }
    return removed;
  }
}