import { randomBytes } from 'node:crypto';

export type FlashKind = 'success' | 'error' | 'info';

export interface FlashMessage {
  kind: FlashKind;
  text: string;
}

/** 一位使用者的工作階段。 */
export interface Session {
  token: string;
  userId: string;
  /** CSRF 權杖，所有變更資料的表單都必須帶上。 */
  csrf: string;
  createdAt: number;
  expiresAt: number;
  flash: FlashMessage[];
}

function randomToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * 記憶體工作階段。
 *
 * 登入狀態不落地，伺服器重啟後所有人需要重新登入；這麼做換來實作簡單，
 * 也避免把 session 寫進可被備份的 JSON 檔。
 */
export class SessionStore {
  readonly #sessions = new Map<string, Session>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

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

  get(token: string | undefined): Session | undefined {
    if (token === undefined) return undefined;
    const session = this.#sessions.get(token);
    if (session === undefined) return undefined;
    if (session.expiresAt <= this.now()) {
      this.#sessions.delete(token);
      return undefined;
    }
    session.expiresAt = this.now() + this.ttlMs;
    return session;
  }

  destroy(token: string): void {
    this.#sessions.delete(token);
  }

  addFlash(session: Session, kind: FlashKind, text: string): void {
    session.flash.push({ kind, text });
  }

  takeFlash(session: Session | undefined): FlashMessage[] {
    if (session === undefined) return [];
    const messages = session.flash;
    session.flash = [];
    return messages;
  }

  get size(): number {
    return this.#sessions.size;
  }

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
