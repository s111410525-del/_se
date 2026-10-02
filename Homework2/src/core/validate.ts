/** 表單欄位驗證。 */

export type Errors = Record<string, string>;

export interface FieldRule {
  /** 欄位的中文名稱，用於錯誤訊息。 */
  label: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternHint?: string;
}

/**
 * 表單驗證器。
 *
 * 呼叫 `text()` / `integer()` / `choice()` 時把值取出的同時檢查規則，
 * 所有錯誤累積在 `errors`，最後一次判斷 `ok` 即可決定是否要重繪表單。
 */
export class FormValidator {
  readonly errors: Errors = {};
  /** 表單原始值，讓重繪頁面時能把使用者填的內容帶回去。 */
  readonly values: Record<string, string> = {};

  constructor(
    private readonly form: URLSearchParams,
    private readonly trim: boolean = true,
  ) {}

  /** 取得欄位字串值並套用規則檢查。 */
  text(name: string, rule: FieldRule): string {
    const raw = this.form.get(name) ?? '';
    const value = this.trim ? raw.trim() : raw;
    this.values[name] = raw;

    if (value === '') {
      if (rule.required === true) this.errors[name] = `${rule.label}為必填欄位`;
      return '';
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      this.errors[name] = `${rule.label}不得超過 ${rule.maxLength} 個字`;
      return value;
    }
    if (rule.min !== undefined && value.length < rule.min) {
      this.errors[name] = `${rule.label}至少需要 ${rule.min} 個字`;
      return value;
    }
    if (rule.pattern !== undefined && !rule.pattern.test(value)) {
      this.errors[name] = `${rule.label}格式不正確${rule.patternHint === undefined ? '' : `（${rule.patternHint}）`}`;
      return value;
    }
    return value;
  }

  /** 取得整數欄位值；無法解析時回傳 `fallback`。 */
  integer(name: string, rule: FieldRule, fallback = 0): number {
    const value = this.text(name, rule);
    if (value === '') return fallback;
    if (!/^-?\d+$/u.test(value)) {
      this.errors[name] = `${rule.label}必須是整數`;
      return fallback;
    }
    const parsed = Number(value);
    if (rule.min !== undefined && parsed < rule.min) {
      this.errors[name] = `${rule.label}不得小於 ${rule.min}`;
      return fallback;
    }
    if (rule.max !== undefined && parsed > rule.max) {
      this.errors[name] = `${rule.label}不得大於 ${rule.max}`;
      return fallback;
    }
    return parsed;
  }

  /** 取得必須落在允許清單中的選項。 */
  choice<T extends string>(name: string, rule: FieldRule, allowed: readonly T[]): T | '' {
    const value = this.text(name, rule);
    if (value === '') return '';
    if (!(allowed as readonly string[]).includes(value)) {
      this.errors[name] = `${rule.label}的值不合法`;
      return '';
    }
    return value as T;
  }

  /** 所有錯誤訊息組成的字串。 */
  message(): string {
    return Object.values(this.errors).join('；');
  }

  get ok(): boolean {
    return Object.keys(this.errors).length === 0;
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const PHONE_PATTERN = /^[0-9()+-]{6,20}$/u;