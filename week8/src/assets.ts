/**
 * 內嵌的靜態資源。
 *
 * CSS 與 JavaScript 以字串常數保存，`tsc` 編譯後不需要額外複製檔案，
 * `npm run build && npm start` 就能直接運作。
 */

export const STYLESHEET = `
:root {
  --ink: #241f2d;
  --ink-soft: #373043;
  --paper: #fbf7ef;
  --bg: #f2ece1;
  --card: #fffdf8;
  --line: #e4dacb;
  --text: #2b2632;
  --muted: #7a7268;
  --accent: #b04438;
  --accent-dark: #8f3329;
  --accent-soft: #f7e7e2;
  --gold: #b98a3c;
  --gold-soft: #f8efd9;
  --ok: #2f7d58;
  --ok-soft: #e6f3eb;
  --info: #3d5d9e;
  --info-soft: #e8eef9;
  --err: #a8322a;
  --err-soft: #fbe9e7;
  --radius: 12px;
  --shadow: 0 1px 2px rgba(50, 38, 25, .05), 0 10px 30px rgba(50, 38, 25, .06);
  --serif: "Noto Serif TC", "Songti TC", "Source Han Serif TC", "PingFang TC", serif;
  --sans: "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", system-ui, sans-serif;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.7;
}
h1, h2, h3, h4 { font-family: var(--serif); font-weight: 700; line-height: 1.35; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
p { margin: 0 0 10px; }
img { max-width: 100%; }
.muted { color: var(--muted); }

.topbar {
  background:
    radial-gradient(circle at 15% -60%, rgba(185, 138, 60, .28), transparent 55%),
    linear-gradient(135deg, #1d1926, #322a40 60%, #40344b);
  color: #f8f1e6;
  box-shadow: 0 8px 26px rgba(25, 20, 32, .28);
}
.topbar-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 22px;
  min-height: 68px;
  flex-wrap: wrap;
}
.brand { color: #fff8ec; font-family: var(--serif); font-size: 24px; font-weight: 700; letter-spacing: .08em; white-space: nowrap; }
.brand:hover { text-decoration: none; opacity: .92; }
.brand span { font-family: var(--sans); font-size: 12px; letter-spacing: .18em; margin-left: 7px; opacity: .65; }
.brand small { display: block; font-family: var(--sans); font-weight: 400; font-size: 10px; letter-spacing: .22em; opacity: .55; }

.nav { display: flex; gap: 2px; flex-wrap: wrap; flex: 1; }
.nav a { color: #e4d9c8; padding: 7px 12px; border-radius: 999px; font-size: 14px; }
.nav a:hover { background: rgba(255, 248, 236, .1); text-decoration: none; }
.nav a.active { background: rgba(255, 248, 236, .17); color: #fff; font-weight: 600; }

.who { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #eee4d5; }
.who.guest { gap: 8px; }
.who-link { display: inline-flex; align-items: center; gap: 7px; color: #fff6e9; }
.who-link:hover { text-decoration: none; opacity: .9; }
.who-avatar { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(255, 248, 236, .14); }
.role-tag { background: rgba(255, 248, 236, .12); border-radius: 999px; padding: 2px 9px; font-size: 11px; color: #ded2c0; }

.shell { max-width: 1180px; margin: 0 auto; padding: 26px 20px 64px; }
.page-head { margin-bottom: 20px; }
.page-head h1 { margin: 0 0 5px; font-size: 26px; letter-spacing: .02em; }
.page-head p { margin: 0; color: var(--muted); font-size: 14px; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px 22px; margin-bottom: 20px; }
.card > h2 { margin: 0 0 14px; font-size: 18px; display: flex; align-items: center; gap: 8px; }
.card > h2::before { content: ""; width: 4px; height: 17px; background: var(--accent); border-radius: 2px; }
.card.flush { padding: 0; overflow: hidden; }

.hero {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  margin-bottom: 28px;
  padding: 46px 46px 38px;
  background:
    radial-gradient(circle at 82% 16%, rgba(185, 138, 60, .34), transparent 34%),
    radial-gradient(circle at 5% 120%, rgba(176, 68, 56, .35), transparent 40%),
    linear-gradient(135deg, #221d2d, #352c42 58%, #45364b);
  color: #fbf3e5;
  box-shadow: 0 22px 50px rgba(35, 27, 43, .24);
}
.hero::after {
  content: "文";
  position: absolute;
  right: 34px;
  bottom: -58px;
  font-family: var(--serif);
  font-size: 240px;
  line-height: 1;
  color: rgba(255, 248, 236, .045);
  pointer-events: none;
}
.hero-inner { position: relative; z-index: 1; max-width: 660px; }
.hero .eyebrow { display: inline-block; font-size: 12px; letter-spacing: .22em; color: #d8bf8a; margin-bottom: 14px; }
.hero h1 { margin: 0 0 14px; font-size: clamp(30px, 4vw, 46px); line-height: 1.25; letter-spacing: .04em; }
.hero p { color: #ded2c1; font-size: 15px; line-height: 1.9; max-width: 580px; }
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
.hero-facts { display: flex; gap: 26px; flex-wrap: wrap; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255, 248, 236, .14); }
.hero-fact b { display: block; font-family: var(--serif); font-size: 22px; color: #fff6e8; }
.hero-fact span { font-size: 12px; color: #c9bcab; letter-spacing: .06em; }

.section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin: 30px 0 16px; }
.section-head h2 { margin: 0; font-size: 21px; display: flex; align-items: center; gap: 9px; }
.section-head h2::before { content: ""; width: 5px; height: 20px; border-radius: 2px; background: linear-gradient(var(--accent), var(--gold)); }
.section-head p { margin: 3px 0 0; color: var(--muted); font-size: 13px; }
.section-link { font-size: 13px; white-space: nowrap; }

.work-grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.work-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); display: flex; flex-direction: column; transition: transform .18s ease, box-shadow .18s ease; }
.work-card:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(50, 38, 25, .12); }
.cover { position: relative; display: block; height: 148px; overflow: hidden; color: #fff; }
.cover:hover { text-decoration: none; }
.cover::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 76% 12%, rgba(255,255,255,.25), transparent 55%); }
.cover-emoji { position: absolute; left: 20px; bottom: 14px; font-size: 46px; filter: drop-shadow(0 6px 12px rgba(0,0,0,.22)); }
.cover-kind { position: absolute; right: 14px; top: 12px; font-size: 11px; letter-spacing: .14em; background: rgba(0,0,0,.24); border: 1px solid rgba(255,255,255,.22); border-radius: 999px; padding: 2px 10px; }
.color-0 { background: linear-gradient(135deg, #33415c, #4d5f83); }
.color-1 { background: linear-gradient(135deg, #5c3a4e, #8d5a70); }
.color-2 { background: linear-gradient(135deg, #37564e, #5b8071); }
.color-3 { background: linear-gradient(135deg, #64462f, #9a7249); }
.color-4 { background: linear-gradient(135deg, #3d3a64, #656087); }

.work-card-body { padding: 15px 17px 16px; display: flex; flex-direction: column; flex: 1; }
.badge-row { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 9px; }
.work-card h3 { margin: 0 0 7px; font-size: 17px; }
.work-card h3 a { color: var(--text); }
.work-card h3 a:hover { color: var(--accent); text-decoration: none; }
.synopsis { color: var(--muted); font-size: 13px; line-height: 1.65; margin: 0 0 10px; flex: 1; }
.work-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-bottom: 8px; }
.creator-dot { font-size: 14px; }
.work-stats { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); border-top: 1px dashed var(--line); padding-top: 9px; }

.badge { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--accent-soft); color: var(--accent-dark); white-space: nowrap; }
.badge.ok { background: var(--ok-soft); color: var(--ok); }
.badge.warn { background: var(--gold-soft); color: #8a621d; }
.badge.err { background: var(--err-soft); color: var(--err); }
.badge.info { background: var(--info-soft); color: var(--info); }
.badge.muted { background: #efece5; color: var(--muted); }
.badge.pro { background: linear-gradient(135deg, #b98a3c, #d6b26a); color: #3a2a0e; }
.badge.gold { background: var(--gold-soft); color: #8a621d; border: 1px solid #ecd8ae; }

.tag-list { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
.tag { background: #f1ece2; color: #6e6459; border-radius: 999px; padding: 2px 10px; font-size: 12px; }

.alert { padding: 11px 14px; border-radius: 10px; margin-bottom: 14px; border: 1px solid transparent; font-size: 14px; }
.alert-success { background: var(--ok-soft); color: #1f5b3f; border-color: #bcdccb; }
.alert-error { background: var(--err-soft); color: #7d211b; border-color: #efc3bd; }
.alert-info { background: var(--info-soft); color: #2d4a80; border-color: #c7d4ec; }
.flash-stack { display: grid; gap: 8px; }

.empty { text-align: center; color: var(--muted); padding: 34px 12px; font-size: 14px; border: 1px dashed var(--line); border-radius: var(--radius); background: rgba(255,255,255,.45); }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn:hover { background: var(--accent-dark); border-color: var(--accent-dark); color: #fff; text-decoration: none; }
.btn.ghost { background: transparent; color: var(--accent); }
.btn.ghost:hover { background: var(--accent-soft); color: var(--accent-dark); }
.btn.ghost-light { background: transparent; border-color: rgba(255, 248, 236, .45); color: #fff7ea; }
.btn.ghost-light:hover { background: rgba(255, 248, 236, .14); }
.btn.gold { background: linear-gradient(135deg, #b98a3c, #d0a853); border-color: #b98a3c; color: #33240b; }
.btn.gold:hover { background: #b98a3c; }
.btn.danger { background: #fff; border-color: #e3b6b0; color: var(--err); }
.btn.danger:hover { background: var(--err-soft); color: #7d211b; }
.btn.small { padding: 4px 11px; font-size: 13px; }
.btn.block { width: 100%; }
.btn[disabled] { opacity: .45; cursor: not-allowed; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.stack { display: grid; gap: 14px; max-width: 520px; }
.field { display: grid; gap: 5px; }
.field label { font-size: 13px; font-weight: 600; color: #4a4238; }
.field .hint { font-size: 12px; color: var(--muted); }
.field .error { font-size: 12px; color: var(--err); }
input[type=text], input[type=password], input[type=email], input[type=number], input[type=search], select, textarea {
  width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px; font: inherit; background: #fffdf9; color: var(--text);
}
input:focus, select:focus, textarea:focus { outline: 2px solid rgba(176, 68, 56, .45); outline-offset: 1px; border-color: var(--accent); }
textarea { min-height: 130px; resize: vertical; }
textarea.tall { min-height: 320px; font-family: var(--serif); font-size: 15px; line-height: 1.9; }
input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--accent); }
.check-line { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.form-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.form-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }

.filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 18px; padding: 14px 16px; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); }
.filters .field { min-width: 130px; flex: 1; }
.filters .field.grow { flex: 2; min-width: 200px; }

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
th { background: #f7f2e8; font-weight: 600; color: #51483d; white-space: nowrap; font-size: 13px; }
tbody tr:hover { background: #fdfaf3; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); }
.table-wrap table { min-width: 620px; }
.table-wrap th:first-child, .table-wrap td:first-child { padding-left: 16px; }
.table-wrap th:last-child, .table-wrap td:last-child { padding-right: 16px; }

.work-hero { display: grid; grid-template-columns: 220px 1fr; gap: 26px; align-items: start; }
.work-cover-lg { border-radius: 14px; min-height: 280px; display: grid; place-items: center; position: relative; overflow: hidden; box-shadow: 0 18px 40px rgba(35, 27, 43, .22); }
.work-cover-lg .cover-emoji { position: static; font-size: 82px; filter: drop-shadow(0 10px 16px rgba(0,0,0,.25)); }
.work-cover-lg .cover-kind { top: auto; bottom: 14px; }
.work-title-area h1 { margin: 0 0 8px; font-size: clamp(25px, 3.2vw, 36px); }
.work-byline { color: var(--muted); font-size: 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.work-synopsis { font-size: 15px; line-height: 1.9; color: #4a4238; margin: 16px 0; }
.work-numbers { display: flex; gap: 22px; flex-wrap: wrap; margin: 18px 0; padding: 14px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.work-numbers div { font-size: 12px; color: var(--muted); }
.work-numbers b { display: block; font-family: var(--serif); font-size: 20px; color: var(--text); }

.two-col { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 20px; align-items: start; }
.side-stack { display: grid; gap: 18px; }

.chapter-list { list-style: none; margin: 0; padding: 0; }
.chapter-list li { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 13px 4px; border-bottom: 1px solid var(--line); }
.chapter-list li:last-child { border-bottom: 0; }
.chapter-list .chapter-name { font-family: var(--serif); font-size: 17px; }
.chapter-list .chapter-meta { font-size: 12px; color: var(--muted); }
.chapter-list a { color: var(--text); }
.chapter-list a:hover { color: var(--accent); text-decoration: none; }

.comment { display: grid; grid-template-columns: 40px 1fr; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.comment:last-child { border-bottom: 0; }
.comment-avatar { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: #f1eadd; font-size: 20px; }
.comment-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; font-size: 13px; }
.comment-head time { color: var(--muted); font-size: 12px; }
.comment-body { font-size: 14px; color: #4c453b; white-space: pre-wrap; margin-top: 2px; }

.tip-form { display: grid; gap: 10px; }
.tip-presets { display: flex; gap: 7px; flex-wrap: wrap; }
.tip-presets button { border: 1px solid var(--line); background: #fffdf9; border-radius: 999px; padding: 4px 13px; cursor: pointer; font: inherit; font-size: 13px; color: #5b5247; }
.tip-presets button:hover { border-color: var(--gold); color: var(--gold); }
.tip-amount { display: flex; align-items: center; gap: 8px; }
.tip-amount input { max-width: 140px; }

.plan-card { border: 1px solid var(--line); border-radius: var(--radius); padding: 18px 20px; background: #fffdf8; }
.plan-card.current { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(185, 138, 60, .18); }
.plan-card.pro { background: linear-gradient(150deg, #fffdf8, #faf1dc); }
.plan-card h3 { margin: 0 0 4px; font-size: 19px; }
.plan-price { font-family: var(--serif); font-size: 28px; color: var(--accent); margin: 8px 0 2px; }
.plan-price small { font-family: var(--sans); font-size: 12px; color: var(--muted); }
.plan-features { margin: 12px 0 16px; padding-left: 18px; color: #5a5248; font-size: 13px; line-height: 1.9; }

.reading-body { background: #efe8dc; }
.reading-shell { max-width: 820px; margin: 0 auto; padding: 24px 20px 80px; }
.reader-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 18px; box-shadow: var(--shadow); }
.reader-toolbar .actions { gap: 6px; }
.reader-toolbar .btn { padding: 4px 10px; font-size: 12px; }
.reading-paper { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 42px 48px 52px; box-shadow: 0 18px 46px rgba(50, 38, 25, .08); }
.reading-paper .chapter-kicker { font-size: 12px; letter-spacing: .18em; color: var(--muted); }
.reading-paper h1 { margin: 6px 0 6px; font-size: clamp(24px, 3.4vw, 34px); }
.reading-paper .reader-meta { color: var(--muted); font-size: 13px; border-bottom: 1px solid var(--line); padding-bottom: 18px; margin-bottom: 26px; }
.reader-content { font-family: var(--serif); font-size: var(--reader-size, 17px); line-height: 2.1; color: #332d36; }
.reader-content p { margin: 0 0 1.35em; }
.reader-content img { display: block; margin: 0 auto 18px; border-radius: 8px; }
.comic-placeholder { border: 1px dashed #cdbfa9; border-radius: 10px; padding: 40px 20px; text-align: center; color: var(--muted); font-family: var(--sans); font-size: 13px; margin-bottom: 20px; background: #faf6ed; }
.chapter-pager { display: flex; justify-content: space-between; gap: 10px; margin-top: 34px; padding-top: 20px; border-top: 1px solid var(--line); }

.creator-hero { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow); margin-bottom: 24px; }
.creator-avatar { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; font-size: 40px; background: linear-gradient(135deg, #efe4d2, #fbf7ef); border: 1px solid var(--line); }
.creator-hero h1 { margin: 0 0 3px; font-size: 26px; }
.creator-hero p { margin: 6px 0 0; color: var(--muted); font-size: 14px; max-width: 640px; }

.plan-banner { display: flex; justify-content: space-between; align-items: center; gap: 18px; flex-wrap: wrap; padding: 18px 22px; border-radius: var(--radius); margin-bottom: 20px; background: linear-gradient(135deg, #2a2435, #3b3047); color: #f8f0e2; box-shadow: var(--shadow); }
.plan-banner.free { background: linear-gradient(135deg, #6b5a48, #8a755d); }
.plan-banner h2 { margin: 0 0 3px; font-size: 19px; color: #fff8ec; }
.plan-banner p { margin: 0; font-size: 13px; color: #d8cbbb; }

.auth-body { min-height: 100vh; background: radial-gradient(circle at 12% 18%, #e9dfcc, transparent 45%), radial-gradient(circle at 88% 80%, #e3d2c6, transparent 45%), var(--bg); }
.auth-wrap { min-height: 100vh; display: grid; place-items: center; padding: 28px; }
.auth-card { width: 100%; max-width: 920px; display: grid; grid-template-columns: 1.02fr .98fr; background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: 0 28px 70px rgba(35, 27, 43, .22); }
.auth-hero { background: radial-gradient(circle at 80% 10%, rgba(185, 138, 60, .3), transparent 40%), linear-gradient(150deg, #211c2b, #382e44); color: #f8f0e2; padding: 44px 36px; position: relative; overflow: hidden; }
.auth-hero::after { content: "墨"; position: absolute; right: -22px; bottom: -60px; font-family: var(--serif); font-size: 210px; color: rgba(255,248,236,.05); }
.auth-hero h1 { margin: 12px 0 8px; font-size: 28px; color: #fff8ec; }
.auth-hero p { color: #d6c8b5; font-size: 14px; line-height: 1.9; }
.auth-hero ul { margin: 22px 0 0; padding-left: 18px; color: #e6d9c7; font-size: 13px; line-height: 2; }
.auth-form { padding: 38px 34px; }
.auth-form h2 { margin: 0 0 6px; font-size: 23px; }
.auth-form .lead { color: var(--muted); font-size: 13px; margin-bottom: 22px; }
.demo-account { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 6px 0; border-bottom: 1px dashed var(--line); }
.demo-account:last-child { border-bottom: 0; }
.auth-switch { margin-top: 18px; text-align: center; font-size: 13px; color: var(--muted); }

.footer { max-width: 1180px; margin: 0 auto; padding: 0 20px 34px; color: var(--muted); font-size: 12px; display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; }

.hero .btn.ghost { color: #f6ead6; border-color: rgba(246, 234, 214, .45); }
.hero .btn.ghost:hover { background: rgba(246, 234, 214, .12); color: #fff; }

.notice { background: var(--gold-soft); border: 1px solid #ecd9b0; color: #6d4e16; border-radius: 10px; padding: 11px 14px; font-size: 13px; margin-bottom: 14px; }
.inline-note { font-size: 12px; color: var(--muted); }
.mono { font-variant-numeric: tabular-nums; }

@media (max-width: 900px) {
  .two-col { grid-template-columns: 1fr; }
  .work-hero { grid-template-columns: 170px 1fr; }
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
  .work-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .cover { height: 118px; }
  .cover-emoji { font-size: 36px; left: 14px; bottom: 10px; }
  .work-card-body { padding: 12px; }
  .work-card h3 { font-size: 15px; }
  .synopsis { display: none; }
  .work-hero { grid-template-columns: 1fr; }
  .work-cover-lg { min-height: 190px; }
  .reading-paper { padding: 28px 20px 36px; }
  .work-numbers { gap: 16px; }
  .section-head { margin-top: 22px; }
}
`.trim();

export const CLIENT_SCRIPT = `
'use strict';

// 需要確認的危險操作（例：刪除章節、降級方案）。
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

// 打賞金額快速按鈕。
document.addEventListener('click', function (event) {
  var target = event.target;
  if (!(target instanceof HTMLElement)) return;
  var amount = target.getAttribute('data-tip-amount');
  if (amount === null) return;
  var input = document.getElementById('tip-amount');
  if (input instanceof HTMLInputElement) {
    input.value = amount;
    input.focus();
  }
});

// 閱讀頁字級調整，設定會存在瀏覽器裡。
var sizeKey = 'inkflow-reader-size';
var reading = document.querySelector('.reader-content');
if (reading instanceof HTMLElement) {
  var saved = window.localStorage.getItem(sizeKey);
  if (saved !== null) reading.style.setProperty('--reader-size', saved + 'px');
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;
    var action = target.getAttribute('data-reader-size');
    if (action === null) return;
    var current = parseInt(window.localStorage.getItem(sizeKey) || '17', 10);
    var next = action === 'up' ? Math.min(24, current + 1) : Math.max(14, current - 1);
    window.localStorage.setItem(sizeKey, String(next));
    reading.style.setProperty('--reader-size', next + 'px');
  });
}
`.trim();
