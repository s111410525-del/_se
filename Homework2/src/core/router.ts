import type { Role } from '../types.js';
import type { Context } from './context.js';

export type Handler = (ctx: Context) => void | Promise<void>;

type Part = { kind: 'literal'; value: string } | { kind: 'param'; name: string };

interface Route {
  method: string;
  pattern: string;
  parts: Part[];
  handler: Handler;
  roles: readonly Role[] | null;
}

export type MatchResult =
  | { kind: 'matched'; route: Route; params: Record<string, string> }
  | { kind: 'method-not-allowed'; allowed: string[] }
  | { kind: 'not-found' };

/** 移除尾端斜線，讓 `/courses/` 與 `/courses` 視為同一個路徑。 */
export function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function compile(pattern: string): Part[] {
  return normalizePath(pattern)
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment): Part => {
      if (segment.startsWith(':')) return { kind: 'param', name: segment.slice(1) };
      return { kind: 'literal', value: segment };
    });
}

/**
 * 極簡的前端路由器。
 *
 * 只支援「方法 + 帶 `:name` 參數的路徑」，以及選用的角色限制，
 * 足以覆蓋校務系統這種頁面數量有限、URL 結構固定的應用。
 */
export class Router {
  readonly #routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler, roles: readonly Role[] | null = null): this {
    this.#routes.push({ method: method.toUpperCase(), pattern, parts: compile(pattern), handler, roles });
    return this;
  }

  get(pattern: string, handler: Handler, roles?: readonly Role[]): this {
    return this.add('GET', pattern, handler, roles ?? null);
  }

  post(pattern: string, handler: Handler, roles?: readonly Role[]): this {
    return this.add('POST', pattern, handler, roles ?? null);
  }

  /** 尋找符合方法與路徑的路由。 */
  match(method: string, path: string): MatchResult {
    const segments = normalizePath(path)
      .split('/')
      .filter((segment) => segment !== '');
    const pathMatches: Route[] = [];

    for (const route of this.#routes) {
      if (route.parts.length !== segments.length) continue;

      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < route.parts.length; i += 1) {
        const part = route.parts[i];
        const segment = segments[i];
        if (part === undefined || segment === undefined) {
          ok = false;
          break;
        }
        if (part.kind === 'literal') {
          if (part.value !== segment) {
            ok = false;
            break;
          }
        } else {
          params[part.name] = decodeURIComponent(segment);
        }
      }
      if (!ok) continue;

      if (route.method !== method.toUpperCase()) {
        pathMatches.push(route);
        continue;
      }
      return { kind: 'matched', route, params };
    }

    if (pathMatches.length > 0) {
      return { kind: 'method-not-allowed', allowed: [...new Set(pathMatches.map((r) => r.method))] };
    }
    return { kind: 'not-found' };
  }

  /** 已註冊的路由數量。 */
  get size(): number {
    return this.#routes.length;
  }
}