import type { RequestListener } from 'node:http';
import { CLIENT_SCRIPT, STYLESHEET } from './assets.js';
import { loadConfig, type Config } from './config.js';
import type { AppServices, Context } from './core/context.js';
import { HttpError, badRequest, forbidden, notFound, unauthorized } from './core/errors.js';
import { appendCookie, clearCookie, parseCookies, readForm, readJson, send } from './core/http.js';
import { verifyPassword } from './core/password.js';
import { Router, normalizePath } from './core/router.js';
import { SessionStore, type Session } from './core/session.js';
import { EMAIL_PATTERN, FormValidator, PHONE_PATTERN, type Errors } from './core/validate.js';
import { createSeedDatabase } from './db/seed.js';
import { Store } from './db/store.js';
import { findById, findByUsername, requireStudent, teacherName, updateProfile } from './services/accounts.js';
import { listCourses, needCourse, statsOf } from './services/courses.js';
import { drop as dropEnrollment, enroll, enrolledCourses, rosterOf } from './services/enrollment.js';
import { balanceOf, parseAmount, pay } from './services/fees.js';
import { classGrades, scoreRecordOf, setPublished, setScore } from './services/grades.js';
import { createNotice, needNotice, removeNotice, togglePin } from './services/notices.js';
import { termLabel } from './services/schedule.js';
import {
  CATEGORIES,
  TERMS,
  type Course,
  type CourseCategory,
  type Database,
  type Day,
  type Notice,
  type PaymentMethod,
  type Period,
  type Student,
  type Term,
  type User,
} from './types.js';
import { newId } from './util/id.js';
import { escapeHtml, formatMoney, splitTokens } from './util/html.js';
import { authLayout, layout } from './views/layout.js';
import {
  adminActivityPage,
  adminCourseEditPage,
  adminCoursesPage,
  adminOverview,
  adminUsersPage,
} from './views/pages/admin.js';
import { loginPage } from './views/pages/auth.js';
import { courseDetailPage, courseListPage } from './views/pages/courses.js';
import { adminDashboard, studentDashboard, teacherDashboard } from './views/pages/dashboard.js';
import { enrollmentPage } from './views/pages/enrollment.js';
import { errorPage } from './views/pages/error.js';
import { feePage, feeSummaryPage } from './views/pages/fees.js';
import { adminGradesPage, gradebookPage, scoreEditorPage, transcriptPage } from './views/pages/grades.js';
import { noticeDetailPage, noticeListPage } from './views/pages/notices.js';
import { profilePage } from './views/pages/profile.js';
import { schedulePage } from './views/pages/schedule.js';

const SESSION_COOKIE = 'nqu_session';

/** 未登入訪客在 Session 中記錄的 userId（空字串代表匿名）。 */
const ANONYMOUS = '';

/** 應用程式本體：包含請求處理器與各項相依服務，方便測試時直接取用。 */
export interface App {
  handler: RequestListener;
  services: AppServices;
  store: Store;
  sessions: SessionStore;
  router: Router;
}

export interface AppOptions {
  /** 覆寫預設設定。 */
  config?: Partial<Config>;
  /** 直接注入 Store（測試時可指定暫存檔）。 */
  store?: Store;
  sessions?: SessionStore;
}

/** 建立應用程式但不啟動伺服器，方便單元測試。 */
export function createApp(options: AppOptions = {}): App {
  const config: Config = { ...loadConfig(), ...options.config };
  const store = options.store ?? new Store(config.dataFile);
  const sessions = options.sessions ?? new SessionStore(config.sessionTtlMs);
  store.load(createSeedDatabase);

  const services: AppServices = { config, store, sessions, loginGuards: new Map() };
  const router = buildRouter();

  const handler: RequestListener = (req, res) => {
    handleRequest(req, res, services, router).catch((err: unknown) => {
      // 保險：連錯誤處理本身失敗時也要結束回應，不能讓連線卡住。
      if (!res.headersSent) send(res, 500, 'text/plain', 'Internal Server Error\n');
      else res.end();
      console.error('[unhandled]', err);
    });
  };

  return { handler, services, store, sessions, router };
}

/** 進入應用的第一站：組出 Context 並交給 Router。 */
export async function handleRequest(
  req: Parameters<RequestListener>[0],
  res: Parameters<RequestListener>[1],
  services: AppServices,
  router: Router,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://campus.local');
  const method = (req.method ?? 'GET').toUpperCase();
  const path = normalizePath(url.pathname);

  let session = services.sessions.get(parseCookies(req.headers.cookie).get(SESSION_COOKIE));
  // 訪客也要有 Session，才能在登入頁取得 CSRF 權杖。
  if (session === undefined) {
    session = services.sessions.create(ANONYMOUS);
    appendCookie(res, SESSION_COOKIE, session.token, { maxAge: Math.floor(services.config.sessionTtlMs / 1000) });
  }

  const active: Session = session;
  const user = active.userId === ANONYMOUS ? undefined : findById(services.store.data, active.userId);
  const match = router.match(method, path);

  let form: URLSearchParams | undefined;
  let formRead = false;

  const ctx: Context = {
    req,
    res,
    method,
    path,
    query: url.searchParams,
    params: match.kind === 'matched' ? match.params : {},
    services,
    session: active,
    user,

    async form(): Promise<URLSearchParams> {
      if (form !== undefined) return form;
      if (formRead) throw new Error('請求內容已經讀取過一次');
      formRead = true;
      form = await readForm(req);
      return form;
    },
    async jsonBody<T>(): Promise<T> {
      if (formRead) throw new Error('請求內容已經讀取過一次');
      formRead = true;
      return (await readJson(req)) as T;
    },
    flash(kind, text) {
      services.sessions.addFlash(active, kind, text);
    },
    redirect(location, status = 303) {
      res.writeHead(status, { Location: location, 'Cache-Control': 'no-store' });
      res.end();
    },
    html(markup, status = 200) {
      send(res, status, 'text/html', markup);
    },
    json(value, status = 200) {
      send(res, status, 'application/json', `${JSON.stringify(value, null, 2)}\n`);
    },
    text(value, status = 200) {
      send(res, status, 'text/plain', value);
    },
    asset(markup, contentType, maxAge = 3600) {
      send(res, 200, contentType, markup, { 'Cache-Control': `public, max-age=${maxAge}` });
    },
    requireUser(): User {
      if (user === undefined) throw unauthorized();
      return user;
    },
    requireRole(...roles: User['role'][]): User {
      const current = user === undefined ? ctx.requireUser() : user;
      if (!roles.includes(current.role)) throw forbidden('您沒有權限存取這個頁面');
      return current;
    },
    requireCsrf(input) {
      const expected = active.csrf;
      const received = input.get('_csrf') ?? '';
      if (expected.length !== received.length || !sameToken(expected, received)) {
        throw forbidden('安全驗證失敗，請重新整理頁面後再送出');
      }
    },
    canAccess(current, ownerId) {
      return current.id === ownerId || current.role === 'admin';
    },
  };

  try {
    if (match.kind === 'not-found') throw notFound();
    if (match.kind === 'method-not-allowed') {
      throw new HttpError(405, `此頁面不支援 ${method} 方法`, `可用方法：${match.allowed.join('、')}`);
    }
    if (match.route.roles !== null) ctx.requireRole(...match.route.roles);
    await match.route.handler(ctx);
  } catch (err) {
    renderError(ctx, err);
  }
}

/** 以固定時間比較 CSRF 權杖，避免回應時間洩漏內容差異。 */
function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function titleForStatus(status: number): string {
  switch (status) {
    case 400:
      return '資料有問題';
    case 401:
      return '請先登入';
    case 403:
      return '沒有權限';
    case 404:
      return '找不到頁面';
    case 405:
      return '不支援的操作';
    case 409:
      return '資料衝突';
    default:
      return '系統發生錯誤';
  }
}

function renderError(ctx: Context, err: unknown): void {
  // 尚未登入就存取受保護頁面時，先導回登入頁而不是顯示錯誤頁。
  if (err instanceof HttpError && err.status === 401) {
    ctx.redirect('/login');
    return;
  }

  const csrfToken = ctx.session?.csrf ?? '';
  const user = ctx.user === undefined ? undefined : { name: ctx.user.name };
  if (err instanceof HttpError) {
    ctx.html(
      errorPage({
        status: err.status,
        title: titleForStatus(err.status),
        message: err.message,
        detail: err.detail,
        user,
        csrfToken,
      }),
      err.status,
    );
    return;
  }

  console.error('[error]', err);
  ctx.html(
    errorPage({
      status: 500,
      title: '系統發生錯誤',
      message: '伺服器處理這個請求時發生未預期的問題，請稍後再試。',
      detail: err instanceof Error ? err.message : null,
      user,
      csrfToken,
    }),
    500,
  );
}

/** 套上共用版面並送出（含 flash 訊息）。 */
function page(ctx: Context, title: string, body: string, subtitle?: string): void {
  ctx.html(
    layout({
      title,
      path: ctx.path,
      user: ctx.user,
      csrfToken: ctx.session?.csrf ?? '',
      flash: ctx.services.sessions.takeFlash(ctx.session),
      body,
      subtitle,
    }),
  );
}

/** 登入頁（獨立版面，不含導覽列）。 */
function loginScreen(ctx: Context, error: string | null, username: string, status = 200): void {
  const query = ctx.query.toString();
  const next = sanitizeNext(`${ctx.path}${query === '' ? '' : `?${query}`}`);
  ctx.html(
    authLayout({
      title: '登入',
      body: loginPage({ error, username, csrfToken: ctx.session?.csrf ?? '', next }),
    }),
    status,
  );
}

/** 只允許站內相對路徑，避免開放轉向（open redirect）。 */
function sanitizeNext(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function requireTerm(ctx: Context): Term {
  const requested = ctx.query.get('term');
  return requested !== null && TERMS.includes(requested) ? requested : ctx.services.config.currentTerm;
}

/** 記錄登入失敗次數，達上限後暫時鎖定該帳號。 */
function registerFailure(services: AppServices, username: string, stamp: number): void {
  const key = username.trim().toLowerCase();
  const guard = services.loginGuards.get(key) ?? { failures: 0, lockedUntil: 0 };
  guard.failures += 1;
  if (guard.failures >= services.config.loginMaxFailures) {
    guard.failures = 0;
    guard.lockedUntil = stamp + services.config.loginLockoutMs;
  }
  services.loginGuards.set(key, guard);
}

// ---------------------------------------------------------------------------
// 路由註冊
// ---------------------------------------------------------------------------

function buildRouter(): Router {
  const router = new Router();

  registerStatic(router);
  registerAuth(router);
  registerProfile(router);
  registerCourses(router);
  registerEnrollment(router);
  registerSchedule(router);
  registerGrades(router);
  registerFees(router);
  registerNotices(router);
  registerAdmin(router);
  return router;
}

function registerStatic(router: Router): void {
  router.get('/assets/app.css', (ctx) => ctx.asset(STYLESHEET, 'text/css'));
  router.get('/assets/app.js', (ctx) => ctx.asset(CLIENT_SCRIPT, 'application/javascript'));
  router.get('/health', (ctx) => ctx.json({ ok: true, term: ctx.services.config.currentTerm }));
}

function registerAuth(router: Router): void {
  router.get('/', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    const term = ctx.services.config.currentTerm;
    if (user.role === 'student') {
      const student = requireStudent(user);
      page(
        ctx,
        `你好，${student.name}`,
        studentDashboard(db, student, term, ctx.services.config.creditLimit, new Date()),
        `學號 ${student.studentId}　${student.department} ${student.className}　學期 ${term}（${termLabel(term)}）`,
      );
      return;
    }
    if (user.role === 'teacher') {
      page(ctx, `你好，${user.name} 老師`, teacherDashboard(db, user.id, term), `學期 ${term}（${termLabel(term)}）`);
      return;
    }
    page(ctx, '教務管理系統', adminDashboard(db, term), `目前學期 ${term}（${termLabel(term)}）`);
  });

  router.get('/login', (ctx) => {
    if (ctx.user !== undefined) {
      ctx.redirect('/');
      return;
    }
    loginScreen(ctx, null, '');
  });

  router.post('/login', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);

    const v = new FormValidator(form);
    const username = v.text('username', { label: '帳號', required: true, maxLength: 40 });
    const password = v.text('password', { label: '密碼', required: true, maxLength: 200 });
    const next = sanitizeNext(form.get('next') ?? '/');

    if (!v.ok) {
      loginScreen(ctx, v.message(), username, 400);
      return;
    }

    const guard = ctx.services.loginGuards.get(username.toLowerCase());
    const stamp = Date.now();
    if (guard !== undefined && guard.lockedUntil > stamp) {
      const seconds = Math.ceil((guard.lockedUntil - stamp) / 1000);
      loginScreen(ctx, `密碼錯誤次數過多，請於 ${seconds} 秒後再試。`, username, 429);
      return;
    }

    const user = findByUsername(ctx.services.store.data, username);
    if (user === undefined || !user.active || !verifyPassword(password, user)) {
      registerFailure(ctx.services, username, stamp);
      loginScreen(ctx, '帳號或密碼錯誤。', username, 401);
      return;
    }

    ctx.services.loginGuards.delete(username.toLowerCase());
    // 登入成功後換發新的工作階段，避免沿用舊的（session fixation 防護）。
    ctx.services.sessions.destroy(activeToken(ctx));
    const created = ctx.services.sessions.create(user.id);
    appendCookie(ctx.res, SESSION_COOKIE, created.token, {
      maxAge: Math.floor(ctx.services.config.sessionTtlMs / 1000),
    });
    ctx.services.sessions.addFlash(created, 'success', `歡迎回來，${user.name}！`);
    ctx.redirect(next);
  });

  router.post('/logout', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    if (ctx.session !== undefined) ctx.services.sessions.destroy(ctx.session.token);
    clearCookie(ctx.res, SESSION_COOKIE);
    const fresh = ctx.services.sessions.create(ANONYMOUS);
    appendCookie(ctx.res, SESSION_COOKIE, fresh.token, { maxAge: Math.floor(ctx.services.config.sessionTtlMs / 1000) });
    ctx.services.sessions.addFlash(fresh, 'info', '您已經登出系統。');
    ctx.redirect('/login');
  });
}

/** 取得目前請求的工作階段權杖（必定存在）。 */
function activeToken(ctx: Context): string {
  if (ctx.session === undefined) throw new Error('工作階段尚未建立');
  return ctx.session.token;
}

function registerProfile(router: Router): void {
  router.get('/profile', (ctx) => {
    const user = ctx.requireUser();
    page(
      ctx,
      '個人資料',
      profilePage({
        db: ctx.services.store.data,
        user,
        currentTerm: ctx.services.config.currentTerm,
        csrfToken: ctx.session?.csrf ?? '',
        errors: {},
        form: {},
      }),
    );
  });

  router.post('/profile', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);

    const v = new FormValidator(form);
    const name = v.text('name', { label: '姓名', required: true, maxLength: 20 });
    const email = v.text('email', {
      label: '電子郵件',
      required: true,
      maxLength: 60,
      pattern: EMAIL_PATTERN,
      patternHint: 'name@example.com',
    });
    const phone = v.text('phone', { label: '聯絡電話', maxLength: 20, pattern: PHONE_PATTERN, patternHint: '0900-123-456' });
    const address = v.text('address', { label: '聯絡地址', maxLength: 80 });

    const errors: Errors = { ...v.errors };
    if (v.ok) {
      try {
        ctx.services.store.mutate((db) => {
          const target = findById(db, user.id);
          if (target === undefined) throw notFound('找不到這筆使用者資料');
          updateProfile(target, { name, email, phone, address });
        });
      } catch (err) {
        errors['form'] = err instanceof Error ? err.message : '儲存失敗';
      }
    }

    if (Object.keys(errors).length > 0) {
      page(
        ctx,
        '個人資料',
        profilePage({
          db: ctx.services.store.data,
          user,
          currentTerm: ctx.services.config.currentTerm,
          csrfToken: ctx.session?.csrf ?? '',
          errors,
          form: { name, email, phone, address },
        }),
        '資料尚未更新，請依畫面提示修正後重新送出。',
      );
      return;
    }
    ctx.flash('success', '個人資料已更新。');
    ctx.redirect('/profile');
  });
}

function registerCourses(router: Router): void {
  router.get('/courses', (ctx) => {
    const db = ctx.services.store.data;
    page(
      ctx,
      '課程查詢',
      courseListPage({
        db,
        currentTerm: ctx.services.config.currentTerm,
        filters: {
          term: ctx.query.get('term') ?? '',
          keyword: ctx.query.get('q') ?? '',
          teacherId: ctx.query.get('teacher') ?? '',
          category: ctx.query.get('category') ?? '',
          onlyOpen: ctx.query.get('open') === '1',
        },
        terms: TERMS,
        teacherNames: db.users
          .filter((user) => user.role === 'teacher')
          .map((user) => ({ id: user.id, name: user.name })),
        student: ctx.user?.role === 'student' ? ctx.user : undefined,
        csrfToken: ctx.session?.csrf ?? '',
      }),
      `目前學期 ${ctx.services.config.currentTerm}（${termLabel(ctx.services.config.currentTerm)}）`,
    );
  });

  router.get('/courses/:id', (ctx) => {
    const db = ctx.services.store.data;
    const course = needCourse(db, ctx.params['id'] ?? '');
    const user = ctx.user;
    page(
      ctx,
      `${course.code}　${course.name}`,
      courseDetailPage({
        db,
        course,
        student: user?.role === 'student' ? user : undefined,
        csrfToken: ctx.session?.csrf ?? '',
        currentTerm: ctx.services.config.currentTerm,
        canEdit: user?.role === 'admin' || (user?.role === 'teacher' && course.teacherId === user.id),
      }),
      `${course.englishName}　${course.term}（${termLabel(course.term)}）`,
    );
  });
}

function registerEnrollment(router: Router): void {
  router.get('/enrollment', (ctx) => {
    const student = requireStudent(ctx.requireRole('student'));
    page(
      ctx,
      '選課系統',
      enrollmentPage({
        db: ctx.services.store.data,
        student,
        currentTerm: ctx.services.config.currentTerm,
        creditLimit: ctx.services.config.creditLimit,
        csrfToken: ctx.session?.csrf ?? '',
      }),
      `學期 ${ctx.services.config.currentTerm}（${termLabel(ctx.services.config.currentTerm)}）　學分上限 ${ctx.services.config.creditLimit} 學分`,
    );
  });

  router.post('/enrollment/:id', async (ctx) => {
    const student = requireStudent(ctx.requireRole('student'));
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const courseId = ctx.params['id'] ?? '';

    let result;
    try {
      result = ctx.services.store.mutate((db) =>
        enroll(db, student, courseId, {
          creditLimit: ctx.services.config.creditLimit,
          currentTerm: ctx.services.config.currentTerm,
        }),
      );
    } catch (err) {
      throw asUserError(err);
    }

    ctx.flash(
      result.waitlisted ? 'info' : 'success',
      result.waitlisted
        ? `《${result.course.name}》正取名額已滿，已加入候補第 ${result.enrollment.queue} 位。`
        : `選課成功：《${result.course.name}》`,
    );
    ctx.redirect('/enrollment');
  });

  router.post('/enrollment/:id/drop', async (ctx) => {
    const student = requireStudent(ctx.requireRole('student'));
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const courseId = ctx.params['id'] ?? '';

    let outcome;
    try {
      outcome = ctx.services.store.mutate((db) => dropEnrollment(db, student, courseId));
    } catch (err) {
      throw asUserError(err);
    }

    if (outcome.promoted === undefined) {
      ctx.flash('success', `已退選《${outcome.course.name}》。`);
    } else {
      const promoted = findById(ctx.services.store.data, outcome.promoted.studentId);
      ctx.flash(
        'info',
        `已退選《${outcome.course.name}》。候補第 1 位 ${promoted?.name ?? '同學'} 已自動遞補為正取。`,
      );
    }
    ctx.redirect('/enrollment');
  });
}

/** 把服務層丟出的例外轉換成適合直接顯示給使用者看的錯誤。 */
function asUserError(err: unknown): HttpError {
  if (err instanceof HttpError) {
    return new HttpError(err.status, err.message, err.detail ?? '請回到上一頁修改後再試一次。');
  }
  return badRequest(err instanceof Error ? err.message : '操作失敗');
}

function registerSchedule(router: Router): void {
  router.get('/schedule', (ctx) => {
    const user = ctx.requireRole('student', 'teacher');
    const db = ctx.services.store.data;
    const term = requireTerm(ctx);

    if (user.role === 'teacher') {
      page(ctx, '教師課表', schedulePage({ mode: 'teacher', db, teacherId: user.id, term }), `學期 ${term}（${termLabel(term)}）`);
      return;
    }
    const student = requireStudent(user);
    page(
      ctx,
      '學生課表',
      schedulePage({ mode: 'student', db, studentId: student.id, term, courses: enrolledCourses(db, student.id, term) }),
      `學期 ${term}（${termLabel(term)}）`,
    );
  });
}

function registerGrades(router: Router): void {
  router.get('/grades', (ctx) => {
    const user = ctx.requireRole('student', 'teacher', 'admin');
    const db = ctx.services.store.data;

    if (user.role === 'student') {
      const student = requireStudent(user);
      page(
        ctx,
        '成績查詢',
        transcriptPage({
          db,
          student,
          currentTerm: ctx.services.config.currentTerm,
          csrfToken: ctx.session?.csrf ?? '',
        }),
        `學期 ${ctx.services.config.currentTerm}（${termLabel(ctx.services.config.currentTerm)}）`,
      );
      return;
    }

    const courses = listCourses(db, {
      term: ctx.services.config.currentTerm,
      teacherId: user.role === 'teacher' ? user.id : '',
    }).sort((a, b) => a.code.localeCompare(b.code));

    const items = courses
      .map((course) => {
        const stats = statsOf(db, course);
        return `<li class="course-item">
          <h3>${escapeHtml(course.code)}　${escapeHtml(course.name)}</h3>
          <div class="meta">${escapeHtml(teacherName(db, course.teacherId))}　${course.credits} 學分　正取 ${stats.enrolled}/${stats.capacity}　候補 ${stats.waitlisted}</div>
          <div class="foot"><div class="actions"><a class="btn small" href="/grades/course/${encodeURIComponent(course.id)}">成績管理</a></div></div>
        </li>`;
      })
      .join('');

    page(
      ctx,
      '成績管理',
      `<div class="card"><h2>選擇要輸入成績的課程</h2>${
        courses.length === 0 ? '<p class="empty">目前學期沒有可管理的課程。</p>' : `<ul class="course-list">${items}</ul>`
      }</div>`,
      `學期 ${ctx.services.config.currentTerm}（${termLabel(ctx.services.config.currentTerm)}）`,
    );
  });

  router.get('/grades/course/:id', (ctx) => {
    const user = ctx.requireRole('teacher', 'admin');
    const db = ctx.services.store.data;
    const courseId = ctx.params['id'] ?? '';
    rosterOf(db, user, courseId);
    const course = needCourse(db, courseId);
    page(
      ctx,
      `《${course.code} ${course.name}》成績管理`,
      gradebookPage({ db, course, rows: classGrades(db, courseId), csrfToken: ctx.session?.csrf ?? '' }),
      `${course.term}（${termLabel(course.term)}）　授課教師 ${teacherName(db, course.teacherId)}`,
    );
  });

  router.get('/grades/course/:id/student/:studentId', (ctx) => {
    const user = ctx.requireRole('teacher', 'admin');
    const db = ctx.services.store.data;
    const courseId = ctx.params['id'] ?? '';
    const studentId = ctx.params['studentId'] ?? '';
    const { course } = rosterOf(db, user, courseId);
    const student = needStudent(db, studentId);

    page(
      ctx,
      `輸入成績：${student.name}`,
      scoreEditorPage({
        course,
        student,
        record: scoreRecordOf(db, studentId, courseId),
        error: null,
        csrfToken: ctx.session?.csrf ?? '',
        scores: {},
        weights: {},
      }),
    );
  });

  router.post('/grades/course/:id/student/:studentId', async (ctx) => {
    const user = ctx.requireRole('teacher', 'admin');
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const courseId = ctx.params['id'] ?? '';
    const studentId = ctx.params['studentId'] ?? '';
    const { course } = rosterOf(db, user, courseId);
    const student = needStudent(db, studentId);
    const record = scoreRecordOf(db, studentId, courseId);

    const items = collectScoreItems(form);
    try {
      ctx.services.store.mutate((target) => {
        setScore(target, { id: user.id, role: user.role }, student, courseId, items);
      });
    } catch (err) {
      page(
        ctx,
        `輸入成績：${student.name}`,
        scoreEditorPage({
          course,
          student,
          record,
          error: err instanceof Error ? err.message : '儲存失敗',
          csrfToken: ctx.session?.csrf ?? '',
          scores: collectByPrefix(form, 'score_'),
          weights: collectByPrefix(form, 'weight_'),
        }),
        '成績尚未儲存，請依畫面提示修正後重新送出。',
      );
      return;
    }
    ctx.flash('success', `已儲存 ${student.name} 在《${course.name}》的成績。`);
    ctx.redirect(`/grades/course/${encodeURIComponent(courseId)}`);
  });

  router.post('/grades/:id/publish', async (ctx) => {
    const user = ctx.requireRole('teacher', 'admin');
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const recordId = ctx.params['id'] ?? '';
    const courseId = form.get('courseId') ?? '';
    ctx.services.store.mutate((db) => {
      setPublished(db, { id: user.id, role: user.role }, recordId, form.get('published') === '1');
    });
    ctx.flash('success', '已更新成績公布狀態。');
    ctx.redirect(courseId === '' ? '/grades' : `/grades/course/${encodeURIComponent(courseId)}`);
  });
}

function needStudent(db: Database, studentId: string): Student {
  const user = findById(db, studentId);
  if (user === undefined || user.role !== 'student') throw notFound('找不到這位學生');
  return user;
}

function collectByPrefix(form: URLSearchParams, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
  }
  return out;
}

/** 解析 `name_0` / `score_0` / `weight_0` 這類索引式欄位。 */
function collectScoreItems(form: URLSearchParams): { name: string; score: number; weight: number }[] {
  const items: { name: string; score: number; weight: number }[] = [];
  for (let i = 0; ; i += 1) {
    const name = form.get(`name_${i}`);
    if (name === null) break;
    items.push({
      name,
      score: Number(form.get(`score_${i}`) ?? '0'),
      weight: Number(form.get(`weight_${i}`) ?? '0'),
    });
  }
  return items;
}

function registerFees(router: Router): void {
  router.get('/fees', (ctx) => {
    const user = ctx.requireRole('student', 'admin');
    const db = ctx.services.store.data;
    const term = requireTerm(ctx);

    if (user.role === 'admin') {
      page(ctx, '繳費總覽', feeSummaryPage({ db, term, terms: TERMS }));
      return;
    }
    const student = requireStudent(user);
    page(
      ctx,
      '繳費管理',
      feePage({ db, student, term, csrfToken: ctx.session?.csrf ?? '', error: null, now: new Date() }),
      `學期 ${term}（${termLabel(term)}）`,
    );
  });

  router.post('/fees/:id/pay', async (ctx) => {
    const student = requireStudent(ctx.requireRole('student'));
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const billId = ctx.params['id'] ?? '';
    const db = ctx.services.store.data;
    const bill = db.bills.find((item) => item.id === billId);
    if (bill === undefined) throw notFound('找不到這筆繳費單');

    try {
      const amount = parseAmount(form.get('amount') ?? '');
      const method = (form.get('method') ?? '') as PaymentMethod;
      const result = ctx.services.store.mutate((target) => pay(target, student.id, billId, amount, method));
      const left = balanceOf(result.bill);
      ctx.flash(
        'success',
        `繳費成功：${left === 0 ? '本學期費用已繳清。' : `尚欠 ${formatMoney(left)}，請繼續繳費。`}收據編號 ${result.payment.serial}。`,
      );
    } catch (err) {
      // 只有「金額／方式填錯」需要回到表單；越權或找不到資料應該直接顯示錯誤頁。
      if (!(err instanceof HttpError) || err.status !== 400) throw err;
      page(
        ctx,
        '繳費管理',
        feePage({
          db,
          student,
          term: bill.term,
          csrfToken: ctx.session?.csrf ?? '',
          error: err.message,
          now: new Date(),
        }),
        '繳費尚未完成，請依畫面提示修正後再試一次。',
      );
      return;
    }
    ctx.redirect('/fees');
  });
}

function registerNotices(router: Router): void {
  router.get('/notices', (ctx) => {
    page(
      ctx,
      '校園公告',
      noticeListPage({
        db: ctx.services.store.data,
        category: ctx.query.get('category') ?? '',
        keyword: ctx.query.get('q') ?? '',
        canManage: ctx.user?.role === 'admin',
        csrfToken: ctx.session?.csrf ?? '',
      }),
    );
  });

  router.get('/notices/:id', (ctx) => {
    const db = ctx.services.store.data;
    const notice = needNotice(db, ctx.params['id'] ?? '');
    page(
      ctx,
      notice.title,
      noticeDetailPage({ db, notice }),
      `${notice.category}　發布者：${teacherName(db, notice.authorId, '校方')}`,
    );
  });
}

function registerAdmin(router: Router): void {
  router.get('/admin', (ctx) => {
    const db = ctx.services.store.data;
    page(
      ctx,
      '教務管理',
      [
        adminOverview({ db, currentTerm: ctx.services.config.currentTerm, notices: db.notices.length, users: db.users.length }),
        adminMenu(),
      ].join(''),
    );
  }, ['admin']);

  router.get('/admin/courses', (ctx) => {
    const db = ctx.services.store.data;
    const term = requireTerm(ctx);
    page(
      ctx,
      '課程管理',
      adminCoursesPage({
        db,
        courses: listCourses(db, { term }).sort((a, b) => a.code.localeCompare(b.code)),
        csrfToken: ctx.session?.csrf ?? '',
        currentTerm: term,
      }),
      `目前學期 ${term}（${termLabel(term)}）`,
    );
  }, ['admin']);

  router.get('/admin/courses/:id', (ctx) => {
    const db = ctx.services.store.data;
    const course = needCourse(db, ctx.params['id'] ?? '');
    page(
      ctx,
      `編輯課程：${course.code}`,
      adminCourseEditPage({ db, course, csrfToken: ctx.session?.csrf ?? '', error: null, form: {} }),
    );
  }, ['admin']);

  router.post('/admin/courses', async (ctx) => {
    ctx.requireRole('admin');
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const data = readCourseForm(form, ctx.services.store.data);

    if (data.error !== null) {
      ctx.flash('error', data.error);
      ctx.redirect('/admin/courses');
      return;
    }
    ctx.services.store.mutate((db) => {
      db.courses.push({
        id: newId('crs'),
        code: data.code,
        name: data.name,
        englishName: data.englishName,
        credits: data.credits,
        category: data.category,
        term: data.term,
        teacherId: data.teacherId,
        capacity: data.capacity,
        location: data.location,
        intro: `${data.name}（${data.englishName}）為${data.category}課程，共 ${data.credits} 學分。`,
        sessions: [{ day: data.day, start: data.start }],
        periods: data.periods,
        prerequisites: data.prerequisites,
        open: true,
      });
    });
    ctx.flash('success', `課程 ${data.code}《${data.name}》已開課。`);
    ctx.redirect('/admin/courses');
  }, ['admin']);

  router.post('/admin/courses/:id', async (ctx) => {
    ctx.requireRole('admin');
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const course = needCourse(db, ctx.params['id'] ?? '');
    const data = readCourseForm(form, db, course);

    if (data.error !== null) {
      page(
        ctx,
        `編輯課程：${course.code}`,
        adminCourseEditPage({
          db,
          course,
          csrfToken: ctx.session?.csrf ?? '',
          error: data.error,
          form: Object.fromEntries(form.entries()),
        }),
        '課程尚未更新，請依畫面提示修正後重新送出。',
      );
      return;
    }
    ctx.services.store.mutate((target) => {
      const stored = target.courses.find((item) => item.id === course.id);
      if (stored === undefined) return;
      Object.assign(stored, {
        code: data.code,
        name: data.name,
        englishName: data.englishName,
        credits: data.credits,
        category: data.category,
        term: data.term,
        teacherId: data.teacherId,
        capacity: data.capacity,
        location: data.location,
        sessions: [{ day: data.day, start: data.start }],
        periods: data.periods,
        prerequisites: data.prerequisites,
        open: form.get('open') === '1',
      });
    });
    ctx.flash('success', `課程 ${data.code} 已更新。`);
    ctx.redirect('/admin/courses');
  }, ['admin']);

  router.post('/admin/courses/:id/toggle', async (ctx) => {
    ctx.requireRole('admin');
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const id = ctx.params['id'] ?? '';
    ctx.services.store.mutate((db) => {
      const course = db.courses.find((item) => item.id === id);
      if (course !== undefined) course.open = !course.open;
    });
    ctx.redirect('/admin/courses');
  }, ['admin']);

  router.post('/admin/courses/:id/capacity', async (ctx) => {
    ctx.requireRole('admin');
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const id = ctx.params['id'] ?? '';
    const capacity = Number(form.get('capacity') ?? '');
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 500) {
      ctx.flash('error', '名額必須是 0 到 500 的整數。');
      ctx.redirect('/admin/courses');
      return;
    }
    ctx.services.store.mutate((db) => {
      const course = db.courses.find((item) => item.id === id);
      if (course !== undefined) course.capacity = capacity;
    });
    const courseName = ctx.services.store.data.courses.find((item) => item.id === id)?.name ?? id;
    ctx.flash('success', `《${courseName}》名額已調整為 ${capacity} 人。`);
    ctx.redirect('/admin/courses');
  }, ['admin']);

  router.get('/admin/users', (ctx) => {
    page(
      ctx,
      '使用者名冊',
      adminUsersPage({ db: ctx.services.store.data, keyword: ctx.query.get('q') ?? '', role: ctx.query.get('role') ?? '' }),
    );
  }, ['admin']);

  router.get('/admin/notices', (ctx) => ctx.redirect('/notices'), ['admin']);

  router.get('/admin/fees', (ctx) => {
    page(ctx, '繳費總覽', feeSummaryPage({ db: ctx.services.store.data, term: requireTerm(ctx), terms: TERMS }));
  }, ['admin']);

  router.get('/admin/grades', (ctx) => {
    page(
      ctx,
      '成績總覽',
      adminGradesPage({
        db: ctx.services.store.data,
        terms: TERMS,
        term: requireTerm(ctx),
        keyword: ctx.query.get('q') ?? '',
      }),
    );
  }, ['admin']);

  router.get('/admin/activity', (ctx) => {
    page(ctx, '系統動態', adminActivityPage({ db: ctx.services.store.data }));
  }, ['admin']);

  router.post('/admin/notices', async (ctx) => {
    const user = ctx.requireRole('admin');
    const form = await ctx.form();
    ctx.requireCsrf(form);
    try {
      ctx.services.store.mutate((db) => {
        createNotice(db, user.id, {
          title: (form.get('title') ?? '').trim(),
          category: (form.get('category') ?? '公告') as Notice['category'],
          body: (form.get('body') ?? '').trim(),
          pinned: form.get('pinned') === '1',
        });
      });
      ctx.flash('success', '公告已發布。');
    } catch (err) {
      ctx.flash('error', err instanceof Error ? err.message : '公告發布失敗');
    }
    ctx.redirect('/notices');
  }, ['admin']);

  router.post('/admin/notices/:id/pin', async (ctx) => {
    ctx.requireRole('admin');
    const form = await ctx.form();
    ctx.requireCsrf(form);
    ctx.services.store.mutate((db) => {
      togglePin(db, ctx.params['id'] ?? '');
    });
    ctx.redirect('/notices');
  }, ['admin']);

  router.post('/admin/notices/:id/delete', async (ctx) => {
    ctx.requireRole('admin');
    const form = await ctx.form();
    ctx.requireCsrf(form);
    ctx.services.store.mutate((db) => {
      removeNotice(db, ctx.params['id'] ?? '');
    });
    ctx.flash('success', '公告已刪除。');
    ctx.redirect('/notices');
  }, ['admin']);
}

function adminMenu(): string {
  const links: [string, string][] = [
    ['/admin/courses', '課程管理'],
    ['/admin/users', '使用者名冊'],
    ['/admin/notices', '公告管理'],
    ['/admin/fees', '繳費總覽'],
    ['/admin/grades', '成績總覽'],
    ['/admin/activity', '系統動態'],
  ];
  return `<div class="card"><h2>快速前往</h2><div class="actions">${links
    .map(([href, label]) => `<a class="btn ghost" href="${href}">${label}</a>`)
    .join('')}</div></div>`;
}

interface CourseFormData {
  error: string | null;
  code: string;
  name: string;
  englishName: string;
  credits: number;
  category: CourseCategory;
  term: Term;
  teacherId: string;
  capacity: number;
  location: string;
  day: Day;
  start: Period;
  periods: 1 | 2;
  prerequisites: string[];
}

/**
 * 解析課程表單。
 *
 * `existing` 用於編輯既有課程：此時課程代號不會與自己重複，而且編輯表單
 * 沒有上課時間欄位，會沿用原課程的時間設定。
 */
function readCourseForm(form: URLSearchParams, db: Database, existing?: Course): CourseFormData {
  const v = new FormValidator(form);
  const code = v.text('code', { label: '課程代號', required: true, maxLength: 12 }).toUpperCase();
  const name = v.text('name', { label: '課程名稱', required: true, maxLength: 40 });
  const englishName = v.text('englishName', { label: '英文名稱', required: true, maxLength: 80 });
  const credits = v.integer('credits', { label: '學分數', required: true, min: 0, max: 10 }, 3);
  const category = v.choice('category', { label: '課程類別', required: true }, CATEGORIES);
  const term = v.choice('term', { label: '學期', required: true }, TERMS);
  const teacherId = v.text('teacherId', { label: '授課教師', required: true });
  const capacity = v.integer('capacity', { label: '修課人數上限', required: true, min: 0, max: 500 }, 40);
  const location = v.text('location', { label: '上課地點', required: true, maxLength: 40 });
  const fallback = existing?.sessions[0] ?? { day: 1, start: 3 };
  const day = v.integer('day', { label: '上課星期', min: 1, max: 5 }, fallback.day);
  const start = v.integer('start', { label: '上課節次', min: 1, max: 11 }, fallback.start);
  const periods = v.integer('periods', { label: '每次上課節數', min: 1, max: 2 }, existing?.periods ?? 2);
  const prerequisites = splitTokens(v.text('prerequisites', { label: '先修課代號', maxLength: 60 })).map((item) =>
    item.toUpperCase(),
  );

  if (teacherId !== '' && findById(db, teacherId) === undefined) {
    v.errors['teacherId'] = '找不到這位教師。';
  }
  if (code !== '' && db.courses.some((course) => course.id !== existing?.id && course.code.toUpperCase() === code)) {
    v.errors['code'] = `課程代號 ${code} 已被使用。`;
  }

  return {
    error: v.ok ? null : v.message(),
    code,
    name,
    englishName,
    credits,
    category: category === '' ? '必修' : category,
    term: term === '' ? '115-1' : term,
    teacherId,
    capacity,
    location,
    day: day as Day,
    start: start as Period,
    periods: (periods === 1 ? 1 : 2) as 1 | 2,
    prerequisites,
  };
}
