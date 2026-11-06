/** 簡單的表單驗證工具。 */

export type Errors = Record<string, string>;

export interface FieldRule {
  label: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternHint?: string;
}

/**
 * 逐欄位驗證表單，錯誤會累積在 `errors`，最後用 `ok` 判斷是否全部通過。
 */
export class FormValidator {
  readonly errors: Errors = {};
  readonly values: Record<string, string> = {};

  constructor(
    private readonly form: URLSearchParams,
    private readonly trim: boolean = true,
  ) {}

  text(name: string, rule: FieldRule): string {
    const raw = this.form.get(name) ?? '';
    const value = this.trim ? raw.trim() : raw;
    this.values[name] = raw;

    if (value === '') {
      if (rule.required === true) this.errors[name] = `${rule.label}為必填欄位`;
      return '';
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      this.errors[name] = `${rule.label}不可超過 ${rule.maxLength} 個字`;
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

  integer(name: string, rule: FieldRule, fallback = 0): number {
    const value = this.text(name, {
      label: rule.label,
      required: rule.required,
      maxLength: rule.maxLength,
      pattern: rule.pattern,
      patternHint: rule.patternHint,
    });
    if (value === '') return fallback;
    if (!/^-?\d+$/u.test(value)) {
      this.errors[name] = `${rule.label}必須是整數`;
      return fallback;
    }
    const parsed = Number(value);
    if (rule.min !== undefined && parsed < rule.min) {
      this.errors[name] = `${rule.label}不可小於 ${rule.min}`;
      return fallback;
    }
    if (rule.max !== undefined && parsed > rule.max) {
      this.errors[name] = `${rule.label}不可大於 ${rule.max}`;
      return fallback;
    }
    return parsed;
  }

  choice<T extends string>(name: string, rule: FieldRule, allowed: readonly T[]): T | '' {
    const value = this.text(name, rule);
    if (value === '') return '';
    if (!(allowed as readonly string[]).includes(value)) {
      this.errors[name] = `${rule.label}的值不正確`;
      return '';
    }
    return value as T;
  }

  message(): string {
    return Object.values(this.errors).join('　');
  }

  get ok(): boolean {
    return Object.keys(this.errors).length === 0;
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/u;
