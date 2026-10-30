import type { Database, User, Work } from '../../types.js';
import { WORK_STATUSES, WORK_TYPES, WORK_TYPE_LABELS, WORK_STATUS_LABELS } from '../../types.js';
import { escapeHtml, formatNumber } from '../../util/html.js';
import { sectionHeader, workCard, workLinks } from '../components.js';

export interface HomePageOptions {
  db: Database;
  user: User | undefined;
  promoted: Work[];
  trending: Work[];
  newest: Work[];
  stats: { works: number; creators: number; chapters: number; readers: number; paidOut: number };
}

export function homePage(options: HomePageOptions): string {
  const { db, user, stats } = options;
  const promotedIds = new Set(options.promoted.map((work) => work.id));
  const cta = user === undefined
    ? `<a class="btn gold" href="/register">免費開始創作</a><a class="btn ghost" href="/works">先逛逛作品</a>`
    : `<a class="btn gold" href="/studio/works/new">發表新作品</a><a class="btn ghost" href="/studio/earnings">查看創作收益</a>`;

  const promotedBlock = options.promoted.length === 0
    ? '<div class="empty">目前沒有進行中的系統推流。付費帳號公開作品後會自動獲得推流。</div>'
    : `<div class="work-grid">${options.promoted
        .map((work) => workCard(db, work, { promoted: true }))
        .join('')}</div>`;

  const featureCards = `<div class="grid cols-3" style="margin-bottom:8px">
    <div class="card" style="margin:0">
      <h2>作品展示空間</h2>
      <p class="muted" style="font-size:13px">小說與漫畫都能連載。每部作品有獨立頁面、章節列表、標籤、留言與收藏，讓讀者一口氣追完。</p>
    </div>
    <div class="card" style="margin:0">
      <h2>收益與打賞</h2>
      <p class="muted" style="font-size:13px">付費帳號依章節閱讀數取得收益，讀者打賞再分潤 90%。收益明細與提領申請都在創作中心。</p>
    </div>
    <div class="card" style="margin:0">
      <h2>系統推流</h2>
      <p class="muted" style="font-size:13px">付費作品公開後自動進入 7 天推流，首頁推流區與推薦排序都會優先曝光，並提供曝光與點擊數據。</p>
    </div>
  </div>`;

  const planBlock = `<div class="grid cols-2">
    <div class="plan-card">
      <h3>免費帳號</h3>
      <p class="muted" style="font-size:13px">適合剛開始連載的你。</p>
      <div class="plan-price">NT$ 0 <small>永久</small></div>
      <ul class="plan-features">
        <li>上傳小說與漫畫作品</li>
        <li>無限章節與讀者留言</li>
        <li>作品公開展示與收藏</li>
      </ul>
      <a class="btn ghost" href="/register">建立免費帳號</a>
    </div>
    <div class="plan-card pro">
      <h3>付費帳號 <span class="badge pro">PRO</span></h3>
      <p class="muted" style="font-size:13px">讓創作開始產生收入。</p>
      <div class="plan-price">NT$ 199 <small>／月（示範）</small></div>
      <ul class="plan-features">
        <li>閱讀收益：每次章節閱讀 NT$ 0.02</li>
        <li>讀者打賞 90% 分潤</li>
        <li>作品自動系統推流 7 天</li>
        <li>收益明細與提領申請</li>
      </ul>
      <a class="btn gold" href="${user === undefined ? '/register' : '/profile#plans'}">${user?.plan === 'pro' ? '你已是付費帳號' : '升級付費帳號'}</a>
    </div>
  </div>`;

  return `
<section class="hero">
  <div class="hero-inner">
    <span class="eyebrow">LITERATURE &amp; COMICS · 連載平台</span>
    <h1>把還沒說完的故事，<br>放到會被看見的地方。</h1>
    <p>墨流是讓創作者投稿小說與漫畫的空間。免費帳號就能開始連載；付費帳號還能依閱讀與打賞獲得收入，並讓作品進入系統推流。</p>
    <div class="hero-actions">${cta}</div>
    <div class="hero-facts">
      <div class="hero-fact"><b>${formatNumber(stats.works)}</b><span>公開作品</span></div>
      <div class="hero-fact"><b>${formatNumber(stats.creators)}</b><span>創作者</span></div>
      <div class="hero-fact"><b>${formatNumber(stats.chapters)}</b><span>連載章節</span></div>
      <div class="hero-fact"><b>${formatNumber(stats.readers)}</b><span>註冊讀者</span></div>
    </div>
  </div>
</section>

${sectionHeader('系統推流', '付費作品公開後自動曝光；管理員也能手動推薦值得被看見的作品。', '/works?sort=recommend', '探索所有作品')}
${promotedBlock}

${sectionHeader('本週熱門', '以閱讀、留言、收藏與打賞綜合排序。', '/works?sort=trending')}
${workLinks(db, options.trending, promotedIds)}

${sectionHeader('最新連載', '剛剛更新章節的作品。', '/works?sort=newest')}
${workLinks(db, options.newest, promotedIds)}

${sectionHeader('為什麼是墨流？', '從發表到收益，一個平台完成。')}
${featureCards}

${sectionHeader('選擇你的方案', '免費開始，準備好時再升級。')}
${planBlock}
`;
}

export interface ExplorePageOptions {
  db: Database;
  user: User | undefined;
  works: Work[];
  tags: string[];
  promotedIds: Set<string>;
  filters: { q: string; type: string; tag: string; status: string; sort: string };
  total: number;
}

export function explorePage(options: ExplorePageOptions): string {
  const { filters, db } = options;
  const optionsHtml = (values: { value: string; label: string }[], selected: string, placeholder: string): string =>
    [`<option value="">${escapeHtml(placeholder)}</option>`]
      .concat(values.map((item) => `<option value="${escapeHtml(item.value)}"${item.value === selected ? ' selected' : ''}>${escapeHtml(item.label)}</option>`))
      .join('');

  const filterForm = `<form class="filters" method="get" action="/works">
    <div class="field grow">
      <label for="q">搜尋</label>
      <input id="q" type="search" name="q" value="${escapeHtml(filters.q)}" placeholder="作品名稱、簡介、標籤或作者">
    </div>
    <div class="field">
      <label for="type">類型</label>
      <select id="type" name="type" data-autosubmit="true">
        ${optionsHtml(WORK_TYPES.map((type) => ({ value: type, label: WORK_TYPE_LABELS[type] })), filters.type, '全部類型')}
      </select>
    </div>
    <div class="field">
      <label for="status">狀態</label>
      <select id="status" name="status" data-autosubmit="true">
        ${optionsHtml(WORK_STATUSES.map((status) => ({ value: status, label: WORK_STATUS_LABELS[status] })), filters.status, '全部狀態')}
      </select>
    </div>
    <div class="field">
      <label for="tag">標籤</label>
      <select id="tag" name="tag" data-autosubmit="true">
        ${optionsHtml(options.tags.map((tag) => ({ value: tag, label: `#${tag}` })), filters.tag, '全部標籤')}
      </select>
    </div>
    <div class="field">
      <label for="sort">排序</label>
      <select id="sort" name="sort" data-autosubmit="true">
        ${optionsHtml([
          { value: 'recommend', label: '推薦' },
          { value: 'trending', label: '熱門' },
          { value: 'newest', label: '最新更新' },
          { value: 'tips', label: '打賞最多' },
        ], filters.sort, '推薦')}
      </select>
    </div>
    <button class="btn" type="submit">套用</button>
  </form>`;

  const resultText = `<p class="inline-note" style="margin-bottom:12px">共 ${formatNumber(options.total)} 部作品${filters.q === '' ? '' : `，搜尋「${escapeHtml(filters.q)}」`}</p>`;

  return `${filterForm}${resultText}${workLinks(db, options.works, options.promotedIds)}`;
}
