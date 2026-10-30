/** 系統設定。所有值都可以用環境變數覆寫，方便測試與部署。 */
export interface Config {
  port: number;
  host: string;
  /** JSON 資料檔路徑。 */
  dataFile: string;
  /** 工作階段存活時間（毫秒）。 */
  sessionTtlMs: number;
  /** 連續登入失敗幾次後鎖定。 */
  loginMaxFailures: number;
  /** 鎖定時間（毫秒）。 */
  loginLockoutMs: number;
}

const DEFAULT_DATA_FILE = 'data/inkflow.json';

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
    dataFile: env['INKFLOW_DATA'] !== undefined && env['INKFLOW_DATA'] !== '' ? env['INKFLOW_DATA'] : DEFAULT_DATA_FILE,
    sessionTtlMs: num('SESSION_TTL_MS', 8 * 60 * 60 * 1000),
    loginMaxFailures: num('LOGIN_MAX_FAILURES', 5),
    loginLockoutMs: num('LOGIN_LOCKOUT_MS', 5 * 60 * 1000),
  };
}
