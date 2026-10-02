/** 系統設定。 */
export interface Config {
  /** 監聽埠號，0 代表由作業系統指派。 */
  port: number;
  /** 監聽位址。 */
  host: string;
  /** JSON 資料檔路徑。 */
  dataFile: string;
  /** Session 有效時間（毫秒）。 */
  sessionTtlMs: number;
  /** 連續登入失敗幾次後鎖定。 */
  loginMaxFailures: number;
  /** 鎖定時間（毫秒）。 */
  loginLockoutMs: number;
  /** 學生每學期學分上限。 */
  creditLimit: number;
  /** 目前開放選課的學期。 */
  currentTerm: string;
}

const DEFAULT_DATA_FILE = 'data/campus.json';

/** 從環境變數建立設定物件，未設定者使用預設值。 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const num = (key: string, fallback: number): number => {
    const raw = env[key];
    if (raw === undefined || raw.trim() === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    port: num('PORT', 3000),
    host: env['HOST'] !== undefined && env['HOST'] !== '' ? env['HOST'] : '127.0.0.1',
    dataFile: env['CAMPUS_DATA'] !== undefined && env['CAMPUS_DATA'] !== '' ? env['CAMPUS_DATA'] : DEFAULT_DATA_FILE,
    sessionTtlMs: num('SESSION_TTL_MS', 8 * 60 * 60 * 1000),
    loginMaxFailures: num('LOGIN_MAX_FAILURES', 5),
    loginLockoutMs: num('LOGIN_LOCKOUT_MS', 5 * 60 * 1000),
    creditLimit: num('CREDIT_LIMIT', 25),
    currentTerm: env['CURRENT_TERM'] !== undefined && env['CURRENT_TERM'] !== '' ? env['CURRENT_TERM'] : '115-1',
  };
}