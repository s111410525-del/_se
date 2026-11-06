/**
 * 內嵌的靜態資源。
 *
 * CSS 與 JavaScript 以字串常數保存，`tsc` 編譯後不需要額外複製檔案，
 * `npm run build && npm start` 就能直接運作。
 */

export const STYLESHEET = `
:root {
  --navy: #102a43;
  --navy-soft: #1f3d5c;
  --teal: #0f766e;
  --teal-dark: #0b5d57;
  --teal-soft: #e3f2ef;
  --amber: #d97706;
  --amber-soft: #fdf1dc;
  --paper: #ffffff;
  --bg: #f3f6f9;
  --card: #ffffff;
  --line: #dbe4ec;
  --text: #1f2d3b;
  --muted: #6b7a8a;
  --ok: #2f7d58;
  --ok-soft: #e6f3eb;
  --info: #2f5ea8;
  --info-soft: #e8eef9;
  --err: #a8322a;
  --err-soft: #fbe9e7;
  --gold: #a86f13;
  --radius: 14px;
  --shadow: 0 1px 2px rgba(16, 42, 67, .05), 0 12px 32px rgba(16, 42, 67, .07);
  --sans: "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", system-ui, sans-serif;
  --serif: "Noto Serif TC", "Songti TC", "PingFang TC", serif;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background:
    radial-gradient(circle at 8% 0%, rgba(15, 118, 110, .06), transparent 38%),
    radial-gradient(circle at 96% 12%, rgba(217, 119, 6, .06), transparent 30%),
    var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.7;
}
h1, h2, h3, h4 { font-family: var(--serif); font-weight: 700; line-height: 1.35; margin-top: 0; }
a { color: var(--teal); text-decoration: none; }
a:hover { text-decoration: underline; }
p { margin: 0 0 10px; }
img { max-width: 100%; }
.muted { color: var(--muted); }
.mono { font-variant-numeric: tabular-nums; }
.inline-note { font-size: 12px; color: var(--muted); }

.topbar {
  background:
    radial-gradient(circle at 12% -70%, rgba(217, 119, 6, .32), transparent 55%),
    linear-gradient(120deg, #0c2236, #123049 55%, #16445a);
  color: #f4f8fb;
  box-shadow: 0 8px 26px rgba(9, 28, 45, .24);
}
.topbar-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 68px;
  flex-wrap: wrap;
}
.brand { color: #fff; font-family: var(--serif); font-size: 24px; font-weight: 700; letter-spacing: .07em; white-space: nowrap; }
.brand:hover { text-decoration: none; opacity: .94; }
.brand span { font-family: var(--sans); font-size: 12px; letter-spacing: .16em; margin-left: 6px; opacity: .68; }
.brand small { display: block; font-family: var(--sans); font-weight: 400; font-size: 10px; letter-spacing: .18em; opacity: .55; }

.nav { display: flex; gap: 2px; flex-wrap: wrap; flex: 1; }
.nav a { color: #d6e2ec; padding: 7px 11px; border-radius: 999px; font-size: 14px; }
.nav a:hover { background: rgba(255, 255, 255, .1); text-decoration: none; }
.nav a.active { background: rgba(255, 255, 255, .16); color: #fff; font-weight: 600; }

.who { display: flex; align-items: center; gap: 9px; font-size: 13px; color: #e5eef5; }
.who.guest { gap: 8px; }
.who-link { display: inline-flex; align-items: center; gap: 7px; color: #fff; }
.who-link:hover { text-decoration: none; opacity: .9; }
.who-avatar { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(255, 255, 255, .14); }
.role-tag { background: rgba(255, 255, 255, .12); border-radius: 999px; padding: 2px 9px; font-size: 11px; color: #dbe7f0; }

.shell { max-width: 1180px; margin: 0 auto; padding: 26px 20px 64px; }
.page-head { margin-bottom: 20px; }
.page-head h1 { margin: 0 0 5px; font-size: 27px; letter-spacing: .02em; }
.page-head p { margin: 0; color: var(--muted); font-size: 14px; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px 22px; margin-bottom: 20px; }
.card > h2 { margin: 0 0 14px; font-size: 18px; display: flex; align-items: center; gap: 8px; }
.card > h2::before { content: ""; width: 4px; height: 17px; background: var(--teal); border-radius: 2px; }
.card.flush { padding: 0; overflow: hidden; }

.hero {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  margin-bottom: 28px;
  padding: 48px 46px 38px;
  background:
    radial-gradient(circle at 84% 14%, rgba(217, 119, 6, .3), transparent 34%),
    radial-gradient(circle at 4% 120%, rgba(15, 118, 110, .42), transparent 42%),
    linear-gradient(125deg, #0d2438, #143a52 58%, #145266);
  color: #f5f9fc;
  box-shadow: 0 24px 54px rgba(9, 28, 45, .24);
}
.hero::after {
  content: "職";
  position: absolute;
  right: 30px;
  bottom: -62px;
  font-family: var(--serif);
  font-size: 250px;
  line-height: 1;
  color: rgba(255, 255, 255, .05);
  pointer-events: none;
}
.hero-inner { position: relative; z-index: 1; max-width: 700px; }
.hero .eyebrow { display: inline-block; font-size: 12px; letter-spacing: .22em; color: #f3c37f; margin-bottom: 14px; }
.hero h1 { margin: 0 0 14px; font-size: clamp(31px, 4.2vw, 48px); line-height: 1.22; letter-spacing: .03em; }
.hero p { color: #d6e3ec; font-size: 15px; line-height: 1.9; max-width: 600px; }
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
.hero-facts { display: flex; gap: 30px; flex-wrap: wrap; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, .15); }
.hero-fact b { display: block; font-family: var(--serif); font-size: 23px; color: #fff; }
.hero-fact span { font-size: 12px; color: #b9cbd9; letter-spacing: .05em; }

.hero-search { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; max-width: 620px; }
.hero-search input { flex: 1; min-width: 220px; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,.28); background: rgba(255,255,255,.12); color: #fff; font: inherit; }
.hero-search input::placeholder { color: #c4d4e0; }
.hero-search input:focus { outline: 2px solid rgba(243, 195, 127, .7); outline-offset: 1px; }
.hero-search .btn { background: #f0b45c; border-color: #f0b45c; color: #2b1a03; }
.hero-search .btn:hover { background: #f6c474; border-color: #f6c474; }

.section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin: 30px 0 16px; }
.section-head h2 { margin: 0; font-size: 21px; display: flex; align-items: center; gap: 9px; }
.section-head h2::before { content: ""; width: 5px; height: 20px; border-radius: 2px; background: linear-gradient(var(--teal), var(--amber)); }
.section-head p { margin: 3px 0 0; color: var(--muted); font-size: 13px; }
.section-link { font-size: 13px; white-space: nowrap; }

.job-grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); }
.job-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); display: flex; flex-direction: column; transition: transform .18s ease, box-shadow .18s ease; }
.job-card:hover { transform: translateY(-3px); box-shadow: 0 16px 36px rgba(16, 42, 67, .12); }
.job-card-top { position: relative; padding: 16px 18px 12px; min-height: 82px; color: #fff; display: flex; align-items: flex-end; gap: 10px; }
.job-card-top::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 82% 8%, rgba(255,255,255,.25), transparent 55%); }
.job-emoji { position: relative; z-index: 1; font-size: 34px; filter: drop-shadow(0 6px 12px rgba(0,0,0,.22)); }
.job-card-top .badge { position: relative; z-index: 1; margin-left: auto; }
.job-card-body { padding: 15px 17px 16px; display: flex; flex-direction: column; flex: 1; }
.job-card h3 { margin: 0 0 5px; font-size: 17px; }
.job-card h3 a { color: var(--text); }
.job-card h3 a:hover { color: var(--teal); text-decoration: none; }
.company-line { font-size: 13px; color: #415366; margin-bottom: 7px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.salary { font-family: var(--serif); font-size: 17px; font-weight: 700; color: var(--teal-dark); margin: 0 0 7px; }
.job-req { color: var(--muted); font-size: 12px; line-height: 1.6; margin: 0 0 9px; flex: 1; }
.job-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-bottom: 8px; }
.job-card-foot { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--muted); border-top: 1px dashed var(--line); padding-top: 9px; margin-top: 8px; }

.color-0 { background: linear-gradient(135deg, #1f4e6b, #2f7691); }
.color-1 { background: linear-gradient(135deg, #4c3a63, #765a92); }
.color-2 { background: linear-gradient(135deg, #235a4f, #3d8172); }
.color-3 { background: linear-gradient(135deg, #6b4526, #a06f3f); }
.color-4 { background: linear-gradient(135deg, #3d456b, #5b6699); }

.badge-row { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 9px; }
.badge { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--teal-soft); color: var(--teal-dark); white-space: nowrap; }
.badge.ok { background: var(--ok-soft); color: var(--ok); }
.badge.warn { background: var(--amber-soft); color: #8a5a10; }
.badge.err { background: var(--err-soft); color: var(--err); }
.badge.info { background: var(--info-soft); color: var(--info); }
.badge.muted { background: #edf1f5; color: var(--muted); }
.badge.promo { background: linear-gradient(135deg, #d97706, #f0b45c); color: #332007; }
.badge.gold { background: var(--amber-soft); color: #8a5a10; border: 1px solid #f0d7ab; }

.tag-list { display: flex; gap: 6px; flex-wrap: wrap; margin: 9px 0; }
.tag { background: #f0f4f7; color: #5b6b7b; border-radius: 999px; padding: 2px 10px; font-size: 12px; }

.alert { padding: 11px 14px; border-radius: 10px; margin-bottom: 14px; border: 1px solid transparent; font-size: 14px; }
.alert-success { background: var(--ok-soft); color: #1f5b3f; border-color: #bcdccb; }
.alert-error { background: var(--err-soft); color: #7d211b; border-color: #efc3bd; }
.alert-info { background: var(--info-soft); color: #2d4a80; border-color: #c7d4ec; }
.flash-stack { display: grid; gap: 8px; }

.empty { text-align: center; color: var(--muted); padding: 34px 12px; font-size: 14px; border: 1px dashed var(--line); border-radius: var(--radius); background: rgba(255,255,255,.6); }
.notice { background: var(--amber-soft); border: 1px solid #f0d7ab; color: #6d4e16; border-radius: 10px; padding: 11px 14px; font-size: 13px; margin-bottom: 14px; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; border-radius: 9px; border: 1px solid var(--teal); background: var(--teal); color: #fff; font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn:hover { background: var(--teal-dark); border-color: var(--teal-dark); color: #fff; text-decoration: none; }
.btn.ghost { background: transparent; color: var(--teal); }
.btn.ghost:hover { background: var(--teal-soft); color: var(--teal-dark); }
.btn.ghost-light { background: transparent; border-color: rgba(255, 255, 255, .45); color: #fff; }
.btn.ghost-light:hover { background: rgba(255, 255, 255, .14); }
.btn.gold { background: linear-gradient(135deg, #d97706, #ec9c31); border-color: #d97706; color: #2f1e06; }
.btn.gold:hover { background: #d97706; }
.btn.danger { background: #fff; border-color: #e3b6b0; color: var(--err); }
.btn.danger:hover { background: var(--err-soft); color: #7d211b; }
.btn.small { padding: 4px 11px; font-size: 13px; }
.btn.block { width: 100%; }
.btn[disabled] { opacity: .45; cursor: not-allowed; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.stack { display: grid; gap: 14px; max-width: 520px; }
.field { display: grid; gap: 5px; }
.field label { font-size: 13px; font-weight: 600; color: #3d4f61; }
.field .hint { font-size: 12px; color: var(--muted); }
.field .error { font-size: 12px; color: var(--err); }
input[type=text], input[type=password], input[type=email], input[type=number], input[type=search], select, textarea {
  width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; font: inherit; background: #fbfdff; color: var(--text);
}
input:focus, select:focus, textarea:focus { outline: 2px solid rgba(15, 118, 110, .35); outline-offset: 1px; border-color: var(--teal); }
textarea { min-height: 130px; resize: vertical; }
textarea.tall { min-height: 280px; line-height: 1.8; }
input[type=checkbox], input[type=radio] { width: 16px; height: 16px; accent-color: var(--teal); }
.check-line { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.form-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.form-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.radio-row { display: flex; gap: 10px; flex-wrap: wrap; }
.radio-card { flex: 1; min-width: 180px; display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: #fbfdff; cursor: pointer; }
.radio-card:has(input:checked) { border-color: var(--teal); box-shadow: 0 0 0 2px rgba(15, 118, 110, .12); background: var(--teal-soft); }
.radio-card b { display: block; font-size: 14px; }
.radio-card span { font-size: 12px; color: var(--muted); }

.filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 18px; padding: 14px 16px; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
.filters .field { min-width: 130px; flex: 1; }
.filters .field.grow { flex: 2.2; min-width: 200px; }
.filter-summary { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; color: var(--muted); font-size: 13px; }

.chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 5px 13px; font-size: 13px; color: #43576a; }
.chip:hover { border-color: var(--teal); color: var(--teal); text-decoration: none; }
.chip.active { background: var(--teal); border-color: var(--teal); color: #fff; }

.grid { display: grid; gap: 16px; }
.grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.grid.cols-3 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.grid.cols-4 { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 15px 17px; box-shadow: var(--shadow); }
.stat .label { color: var(--muted); font-size: 12px; letter-spacing: .04em; }
.stat .value { font-family: var(--serif); font-size: 25px; font-weight: 700; line-height: 1.3; }
.stat .hint { color: var(--muted); font-size: 11px; }
.stat.ok .value { color: var(--ok); }
.stat.gold .value { color: var(--gold); }
.stat.err .value { color: var(--err); }

table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 10px 11px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { background: #f4f7fa; font-weight: 600; color: #405366; white-space: nowrap; font-size: 13px; }
tbody tr:hover { background: #fafcfd; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); }
.table-wrap table { min-width: 640px; }
.table-wrap th:first-child, .table-wrap td:first-child { padding-left: 16px; }
.table-wrap th:last-child, .table-wrap td:last-child { padding-right: 16px; }

.two-col { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(290px, 1fr); gap: 20px; align-items: start; }
.side-stack { display: grid; gap: 18px; }
.detail-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
.detail-head h1 { margin: 0 0 6px; font-size: clamp(25px, 3.2vw, 34px); }
.detail-company { color: #42576a; font-size: 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.salary-big { font-family: var(--serif); font-size: 24px; font-weight: 700; color: var(--teal-dark); margin: 14px 0 8px; }
.detail-meta { display: flex; gap: 18px; flex-wrap: wrap; color: var(--muted); font-size: 13px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 12px 0; margin: 16px 0; }
.detail-section { margin-top: 26px; }
.detail-section h2 { font-size: 19px; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
.detail-section h2::before { content: ""; width: 4px; height: 17px; border-radius: 2px; background: var(--teal); }
.prose { color: #394c5e; font-size: 14.5px; line-height: 1.95; }
.prose p { margin: 0 0 1em; }
.prose ul { margin: 0 0 1em; padding-left: 20px; }
.prose li { margin-bottom: 3px; }

.company-card { display: flex; gap: 14px; align-items: flex-start; }
.company-avatar { width: 56px; height: 56px; border-radius: 14px; display: grid; place-items: center; font-size: 28px; background: var(--teal-soft); flex: none; }
.company-card h3 { margin: 0 0 3px; font-size: 18px; }
.company-card p { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.apply-box { border: 1px solid var(--line); border-radius: var(--radius); background: linear-gradient(160deg, #ffffff, #f4faf9); padding: 20px; box-shadow: var(--shadow); }
.apply-box h2 { margin: 0 0 8px; font-size: 18px; }
.apply-box .hint-note { font-size: 12px; color: var(--muted); margin-bottom: 12px; }
.apply-box textarea { min-height: 120px; }

.conversation-list { display: grid; gap: 12px; }
.conversation-card { display: flex; gap: 14px; align-items: flex-start; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 15px 17px; box-shadow: var(--shadow); }
.conversation-card:hover { border-color: #b9cdd9; }
.conversation-avatar { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-size: 21px; background: #eef4f7; flex: none; }
.conversation-main { flex: 1; min-width: 0; }
.conversation-main h3 { margin: 0 0 2px; font-size: 16px; }
.conversation-main h3 a { color: var(--text); }
.conversation-main h3 a:hover { color: var(--teal); text-decoration: none; }
.conversation-preview { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.conversation-side { text-align: right; font-size: 12px; color: var(--muted); display: grid; gap: 5px; justify-items: end; flex: none; }
.unread-dot { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--amber); color: #fff; font-size: 11px; font-weight: 700; }

.thread-head { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; align-items: flex-start; margin-bottom: 18px; }
.thread-head h1 { margin: 0 0 4px; font-size: 24px; }
.messages { display: grid; gap: 12px; padding: 16px; background: #f7fafc; border: 1px solid var(--line); border-radius: var(--radius); margin-bottom: 16px; }
.message-row { display: flex; gap: 10px; align-items: flex-end; }
.message-row.mine { flex-direction: row-reverse; }
.message-avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: #e6eef3; font-size: 16px; flex: none; }
.bubble { max-width: min(74%, 560px); background: #fff; border: 1px solid var(--line); border-radius: 14px 14px 14px 4px; padding: 10px 13px; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
.message-row.mine .bubble { background: var(--teal); border-color: var(--teal); color: #fff; border-radius: 14px 14px 4px 14px; }
.bubble-meta { font-size: 11px; color: var(--muted); margin-top: 4px; }
.message-row.mine .bubble-meta { text-align: right; color: #cfe3e0; }
.composer { display: grid; gap: 10px; }

.balance-card { background: linear-gradient(135deg, #0e2a40, #14546b); color: #f2f8fb; border-radius: 18px; padding: 26px 28px; box-shadow: 0 20px 44px rgba(9, 28, 45, .22); margin-bottom: 20px; position: relative; overflow: hidden; }
.balance-card::after { content: "錢"; position: absolute; right: 18px; bottom: -52px; font-family: var(--serif); font-size: 190px; color: rgba(255,255,255,.05); }
.balance-card .label { font-size: 12px; letter-spacing: .18em; color: #a9c1d2; }
.balance-card .amount { font-family: var(--serif); font-size: 40px; font-weight: 700; line-height: 1.2; margin: 6px 0; }
.balance-card p { color: #c4d7e3; font-size: 13px; margin: 0; position: relative; z-index: 1; }
.balance-card .actions { margin-top: 16px; position: relative; z-index: 1; }
.preset-row { display: flex; gap: 7px; flex-wrap: wrap; }
.preset-row button { border: 1px solid var(--line); background: #fbfdff; border-radius: 999px; padding: 4px 13px; cursor: pointer; font: inherit; font-size: 13px; color: #4a5f72; }
.preset-row button:hover { border-color: var(--teal); color: var(--teal); }
.plan-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.plan-card { border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; background: #fbfdff; display: flex; flex-direction: column; gap: 6px; }
.plan-card h3 { margin: 0; font-size: 17px; }
.plan-card .price { font-family: var(--serif); font-size: 24px; font-weight: 700; color: var(--teal-dark); }
.plan-card .hint { font-size: 12px; color: var(--muted); flex: 1; }

.promo-panel { border-top: 1px dashed var(--line); padding-top: 12px; margin-top: 12px; display: grid; gap: 8px; }
.promo-options { display: flex; gap: 7px; flex-wrap: wrap; }
.promo-options form { margin: 0; }

.auth-body { min-height: 100vh; background: radial-gradient(circle at 10% 15%, #dcebf0, transparent 45%), radial-gradient(circle at 90% 82%, #f6e8cf, transparent 45%), var(--bg); }
.auth-wrap { min-height: 100vh; display: grid; place-items: center; padding: 28px; }
.auth-card { width: 100%; max-width: 980px; display: grid; grid-template-columns: 1.02fr .98fr; background: var(--card); border-radius: 20px; overflow: hidden; box-shadow: 0 30px 76px rgba(13, 36, 56, .22); }
.auth-hero { background: radial-gradient(circle at 80% 8%, rgba(217, 119, 6, .3), transparent 40%), linear-gradient(150deg, #0c2236, #123c53); color: #f3f8fb; padding: 44px 36px; position: relative; overflow: hidden; }
.auth-hero::after { content: "光"; position: absolute; right: -22px; bottom: -62px; font-family: var(--serif); font-size: 220px; color: rgba(255,255,255,.05); }
.auth-hero h1 { margin: 12px 0 8px; font-size: 29px; color: #fff; }
.auth-hero p { color: #c6d8e4; font-size: 14px; line-height: 1.9; }
.auth-hero ul { margin: 22px 0 0; padding-left: 18px; color: #dbe8f1; font-size: 13px; line-height: 2; }
.auth-form { padding: 38px 34px; }
.auth-form h2 { margin: 0 0 6px; font-size: 24px; }
.auth-form .lead { color: var(--muted); font-size: 13px; margin-bottom: 22px; }
.demo-account { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 6px 0; border-bottom: 1px dashed var(--line); }
.demo-account:last-child { border-bottom: 0; }
.demo-account .note { color: var(--muted); }
.auth-switch { margin-top: 18px; text-align: center; font-size: 13px; color: var(--muted); }

.footer { max-width: 1180px; margin: 0 auto; padding: 0 20px 34px; color: var(--muted); font-size: 12px; display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; }

.steps { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.step { background: #fbfdff; border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; }
.step b { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--teal); color: #fff; font-size: 13px; margin-bottom: 8px; }
.step h3 { margin: 0 0 4px; font-size: 15px; }
.step p { margin: 0; font-size: 12px; color: var(--muted); }

@media (max-width: 900px) {
  .two-col { grid-template-columns: 1fr; }
  .auth-card { grid-template-columns: 1fr; }
  .auth-hero { padding: 30px 28px; }
}
@media (max-width: 640px) {
  .topbar-inner { gap: 10px; padding: 10px 16px; }
  .brand { font-size: 21px; }
  .nav { order: 3; width: 100%; overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; }
  .nav a { white-space: nowrap; }
  .shell { padding: 18px 14px 50px; }
  .hero { padding: 30px 24px 26px; }
  .hero-facts { gap: 18px; }
  .job-grid { grid-template-columns: 1fr; }
  .bubble { max-width: 86%; }
  .section-head { margin-top: 22px; }
}
`.trim();

export const CLIENT_SCRIPT = `
'use strict';

// 需要確認的危險操作。
document.addEventListener('submit', function (event) {
  var form = event.target;
  if (form instanceof HTMLFormElement === false) return;
  var message = form.getAttribute('data-confirm');
  if (message === null || message === '') return;
  if (!window.confirm(message)) event.preventDefault();
});

// 篩選表單：下拉選單變動就送出。
document.addEventListener('change', function (event) {
  var target = event.target;
  if (target instanceof HTMLSelectElement === false) return;
  if (target.getAttribute('data-autosubmit') === 'true') {
    if (target.form) target.form.submit();
  }
});

// 儲值金額快速按鈕。
document.addEventListener('click', function (event) {
  var target = event.target;
  if (!(target instanceof HTMLElement)) return;
  var amount = target.getAttribute('data-topup-amount');
  if (amount === null) return;
  var input = document.getElementById('topup-amount');
  if (input instanceof HTMLInputElement) {
    input.value = amount;
    input.focus();
  }
});

// 註冊表單：切換求職者／企業時顯示公司名稱欄位。
var roleRadios = document.querySelectorAll('input[name="role"]');
var companyField = document.querySelector('[data-role-field="employer"]');
function syncRoleFields() {
  if (!(companyField instanceof HTMLElement)) return;
  var selected = document.querySelector('input[name="role"]:checked');
  var isEmployer = selected instanceof HTMLInputElement && selected.value === 'employer';
  companyField.hidden = !isEmployer;
  var input = companyField.querySelector('input');
  if (input instanceof HTMLInputElement) input.required = isEmployer;
}
if (roleRadios.length > 0) {
  roleRadios.forEach(function (radio) {
    radio.addEventListener('change', syncRoleFields);
  });
  syncRoleFields();
}

// 訊息頁自動捲到最底部。
var thread = document.querySelector('.messages');
if (thread instanceof HTMLElement) thread.scrollTop = thread.scrollHeight;
`.trim();
