/**
 * 內嵌的靜態資源。
 *
 * 把 CSS 與 JavaScript 直接寫成字串常數，讓 `tsc` 編譯後不需要額外的
 * 檔案複製步驟，`npm run build && npm start` 就能直接運作。
 */

export const STYLESHEET = `
:root {
  --brand: #0b5fa5;
  --brand-dark: #08467a;
  --brand-light: #e8f1f9;
  --ink: #1f2933;
  --muted: #667081;
  --line: #d8dee7;
  --bg: #f4f6f9;
  --card: #ffffff;
  --ok: #1b7f4d;
  --ok-bg: #e6f5ed;
  --warn: #94620a;
  --warn-bg: #fdf3e0;
  --err: #b3261e;
  --err-bg: #fdecea;
  --info-bg: #eef2ff;
  --info: #3538cd;
  --radius: 10px;
  --shadow: 0 1px 2px rgba(16, 24, 40, .06), 0 1px 3px rgba(16, 24, 40, .1);
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.65;
}

a { color: var(--brand); text-decoration: none; }
a:hover { text-decoration: underline; }

.topbar {
  background: linear-gradient(135deg, var(--brand-dark), var(--brand));
  color: #fff;
  box-shadow: var(--shadow);
}
.topbar-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 58px;
  flex-wrap: wrap;
}
.brand { color: #fff; font-weight: 700; font-size: 17px; white-space: nowrap; }
.brand:hover { text-decoration: none; opacity: .9; }
.brand small { display: block; font-weight: 400; font-size: 11px; opacity: .8; letter-spacing: .04em; }

.nav { display: flex; gap: 2px; flex-wrap: wrap; flex: 1; }
.nav a {
  color: #e8f1f9;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 14px;
}
.nav a:hover { background: rgba(255, 255, 255, .14); text-decoration: none; }
.nav a.active { background: rgba(255, 255, 255, .22); color: #fff; font-weight: 600; }

.who { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.who .role-tag {
  background: rgba(255, 255, 255, .2);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
}

.shell { max-width: 1180px; margin: 0 auto; padding: 22px 20px 60px; }

.page-head { margin-bottom: 16px; }
.page-head h1 { margin: 0 0 4px; font-size: 21px; }
.page-head p { margin: 0; color: var(--muted); font-size: 14px; }

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 18px 20px;
  margin-bottom: 18px;
}
.card > h2 {
  margin: 0 0 14px;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card > h2::before {
  content: "";
  width: 4px;
  height: 16px;
  background: var(--brand);
  border-radius: 2px;
}

.grid { display: grid; gap: 16px; }
.grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.grid.cols-3 { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
.grid.cols-4 { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }

.stat { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow); }
.stat .label { color: var(--muted); font-size: 13px; }
.stat .value { font-size: 24px; font-weight: 700; line-height: 1.3; }
.stat .hint { color: var(--muted); font-size: 12px; }
.stat.ok .value { color: var(--ok); }
.stat.warn .value { color: var(--warn); }
.stat.err .value { color: var(--err); }

table { width: 100%; border-collapse: collapse; font-size: 14px; }
caption { text-align: left; color: var(--muted); font-size: 13px; padding-bottom: 8px; }
th, td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { background: #f7f9fc; font-weight: 600; color: #384252; white-space: nowrap; }
tbody tr:hover { background: #fafcff; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.table-wrap { overflow-x: auto; }

.badge {
  display: inline-block;
  padding: 1px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--brand-light);
  color: var(--brand-dark);
  white-space: nowrap;
}
.badge.ok { background: var(--ok-bg); color: var(--ok); }
.badge.warn { background: var(--warn-bg); color: var(--warn); }
.badge.err { background: var(--err-bg); color: var(--err); }
.badge.info { background: var(--info-bg); color: var(--info); }
.badge.muted { background: #eef0f4; color: var(--muted); }

.alert { padding: 11px 14px; border-radius: var(--radius); margin-bottom: 14px; border: 1px solid transparent; font-size: 14px; }
.alert-success { background: var(--ok-bg); color: #0f5735; border-color: #bfe3ce; }
.alert-error { background: var(--err-bg); color: #8c1d18; border-color: #f3c4c0; }
.alert-info { background: var(--info-bg); color: #26299e; border-color: #c9cdf5; }

.empty { text-align: center; color: var(--muted); padding: 28px 10px; font-size: 14px; }

form.stack { display: grid; gap: 14px; max-width: 460px; }
.field { display: grid; gap: 5px; }
.field label { font-size: 13px; color: #384252; font-weight: 600; }
.field .hint { color: var(--muted); font-size: 12px; }
input[type=text], input[type=password], input[type=email], input[type=number], input[type=date], input[type=search], select, textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font: inherit;
  background: #fff;
  color: inherit;
}
input:focus, select:focus, textarea:focus {
  outline: 2px solid var(--brand);
  outline-offset: 1px;
  border-color: var(--brand);
}
textarea { min-height: 130px; resize: vertical; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--brand);
  background: var(--brand);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.btn:hover { background: var(--brand-dark); text-decoration: none; color: #fff; }
.btn.ghost { background: #fff; color: var(--brand); }
.btn.ghost:hover { background: var(--brand-light); color: var(--brand-dark); }
.btn.danger { background: #fff; border-color: #e2b6b2; color: var(--err); }
.btn.danger:hover { background: var(--err-bg); color: #8c1d18; }
.btn.small { padding: 4px 10px; font-size: 13px; }
.btn[disabled] { opacity: .5; cursor: not-allowed; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 14px; }
.filters .field { min-width: 150px; }

.timetable { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
.timetable th { text-align: center; padding: 6px 4px; font-size: 12px; }
.timetable th.period-col { width: 76px; }
.timetable td { padding: 3px; border: 1px solid var(--line); height: 44px; }
.timetable td.period-label { background: #f7f9fc; text-align: center; font-size: 11px; color: var(--muted); }
.timetable td.empty-cell { background: #fcfdfe; }
.course-block { border-radius: 6px; padding: 5px 6px; color: #fff; height: 100%; line-height: 1.35; overflow: hidden; }
.course-block b { display: block; font-size: 12px; }
.course-block span { font-size: 11px; opacity: .9; }

.course-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.course-item { border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; background: #fff; }
.course-item h3 { margin: 0 0 2px; font-size: 16px; }
.course-item .meta { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
.course-item .foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; }

.lesson-list { display: grid; gap: 10px; }
.lesson { border: 1px solid var(--line); border-left: 4px solid var(--brand); border-radius: 8px; padding: 10px 14px; background: #fff; }
.lesson .time { font-size: 12px; color: var(--muted); }
.lesson h4 { margin: 2px 0 4px; font-size: 15px; }

.progress { height: 8px; background: #e8ecf2; border-radius: 999px; overflow: hidden; min-width: 90px; }
.progress > span { display: block; height: 100%; background: var(--brand); }
.progress.done > span { background: var(--ok); }

.note { background: var(--brand-light); border-radius: 8px; padding: 10px 12px; font-size: 13px; color: var(--brand-dark); }

.timeline { display: grid; gap: 10px; }
.timeline .entry { display: flex; gap: 12px; align-items: baseline; font-size: 13px; }
.timeline .entry time { color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }

.login-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: linear-gradient(135deg, #eaf1f8, #f7f9fc); }
.login-card { width: 100%; max-width: 900px; display: grid; grid-template-columns: 1.1fr .9fr; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 18px 40px rgba(16, 24, 40, .12); }
.login-hero { background: linear-gradient(160deg, var(--brand-dark), var(--brand)); color: #fff; padding: 36px 32px; }
.login-hero h1 { margin: 0 0 6px; font-size: 22px; }
.login-hero p { margin: 0; opacity: .88; font-size: 14px; }
.login-hero ul { margin: 18px 0 0; padding-left: 18px; font-size: 14px; opacity: .92; line-height: 1.9; }
.login-form { padding: 32px 28px; }
.demo-account { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 5px 0; border-bottom: 1px dashed var(--line); }
.demo-account:last-child { border-bottom: 0; }

.footer { max-width: 1180px; margin: 0 auto; padding: 0 20px 30px; color: var(--muted); font-size: 12px; }

@media (max-width: 720px) {
  .login-card { grid-template-columns: 1fr; }
  .timetable { font-size: 11px; }
  .timetable th.period-col { width: 58px; }
  .topbar-inner { gap: 10px; }
}
`.trim();

export const CLIENT_SCRIPT = `
'use strict';

// 送出表單前若帶 data-confirm，先跳出確認視窗。
document.addEventListener('submit', function (event) {
  var form = event.target;
  if (form instanceof HTMLFormElement === false) return;
  var message = form.getAttribute('data-confirm');
  if (message === null || message === '') return;
  if (!window.confirm(message)) event.preventDefault();
});

// 課程篩選表單：任一欄位變動就自動送出，不需要按查詢鈕。
document.addEventListener('change', function (event) {
  var target = event.target;
  if (target instanceof HTMLSelectElement === false) return;
  if (target.getAttribute('data-autosubmit') === 'true') target.form?.submit();
});
`.trim();