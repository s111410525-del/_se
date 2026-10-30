import type { Chapter, Comment, Database, Promotion, User, Work } from '../../types.js';
import { REVENUE_RULES, TIP_PRESETS, WORK_TYPE_LABELS } from '../../types.js';
import { escapeHtml, formatDate, formatDateTime, formatNumber, colorIndex, paragraphs } from '../../util/html.js';
import { creatorLink, emptyState, planBadge, statusBadge, tagList, workCard, workHref } from '../components.js';

export interface WorkDetailOptions {
  db: Database;
  work: Work;
  creator: User | undefined;
  user: User | undefined;
  chapters: Chapter[];
  comments: Comment[];
  bookmarked: boolean;
  bookmarks: number;
  tipTotal: number;
  promotion: Promotion | undefined;
  canManage: boolean;
  csrfToken: string;
}

export function workDetailPage(options: WorkDetailOptions): string {
  const { db, work, creator, user } = options;
  const firstChapter = options.chapters[0];
  const readButton = firstChapter === undefined
    ? '<span class="badge muted">尚未發布章節</span>'
    : `<a class="btn" href="/works/${encodeURIComponent(work.id)}/chapters/${encodeURIComponent(firstChapter.id)}">開始閱讀</a>`;

  const bookmarkButton = user === undefined
    ? `<a class="btn ghost" href="/login">登入收藏</a>`
    : `<form method="post" action="/works/${encodeURIComponent(work.id)}/bookmark" style="margin:0">
        <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
        <button class="btn ghost" type="submit">${options.bookmarked ? '★ 已收藏' : '☆ 收藏'}</button>
      </form>`;

  const manageLink = options.canManage
    ? `<a class="btn ghost small" href="/studio/works/${encodeURIComponent(work.id)}">管理作品</a>`
    : '';

  const notices: string[] = [];
  if (!work.published) notices.push('<div class="notice">這部作品尚未公開，只有你與平台管理員看得到。</div>');
  if (options.promotion !== undefined) {
    const days = Math.max(1, Math.ceil((Date.parse(options.promotion.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000)));
    notices.push(`<div class="notice">🔥 系統推流中（${options.promotion.source === 'admin' ? '平台推薦' : '付費方案'}），剩餘約 ${days} 天，將優先出現在首頁與推薦排序。</div>`);
  }

  const chapterItems = options.chapters.length === 0
    ? `<li><div class="empty" style="width:100%;border:0">作者還沒有發布章節，先收藏起來等更新吧。</div></li>`
    : options.chapters
        .map(
          (chapter) => `<li>
        <div>
          <div class="chapter-name"><a href="/works/${encodeURIComponent(work.id)}/chapters/${encodeURIComponent(chapter.id)}">第 ${chapter.order} 章　${escapeHtml(chapter.title)}</a></div>
          <div class="chapter-meta">${formatDate(chapter.updatedAt)} · ${formatNumber(chapter.views)} 次閱讀</div>
        </div>
        <a class="btn ghost small" href="/works/${encodeURIComponent(work.id)}/chapters/${encodeURIComponent(chapter.id)}">閱讀</a>
      </li>`,
        )
        .join('');

  const comments = options.comments.length === 0
    ? emptyState('還沒有留言，成為第一個留下感想的人吧。')
    : options.comments
        .map((comment) => {
          const author = db.users.find((item) => item.id === comment.userId);
          const canDelete = user !== undefined && (user.id === comment.userId || user.role === 'admin');
          const deleteButton = canDelete
            ? `<form method="post" action="/works/${encodeURIComponent(work.id)}/comments/${encodeURIComponent(comment.id)}/delete" style="margin:0">
                <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
                <button class="btn danger small" type="submit" data-confirm="確定要刪除這則留言嗎？">刪除</button>
              </form>`
            : '';
          return `<div class="comment">
        <div class="comment-avatar">${escapeHtml(author?.avatar ?? '🪶')}</div>
        <div>
          <div class="comment-head"><span><b>${escapeHtml(author?.name ?? '已刪除的使用者')}</b> ${planBadge(author)}</span><time>${formatDateTime(comment.createdAt)}</time></div>
          <div class="comment-body">${escapeHtml(comment.body)}</div>
          <div style="margin-top:6px">${deleteButton}</div>
        </div>
      </div>`;
        })
        .join('');

  const commentForm = user === undefined
    ? `<div class="notice">登入後就能留言、收藏與打賞。 <a href="/login">前往登入</a></div>`
    : `<form method="post" action="/works/${encodeURIComponent(work.id)}/comments" class="stack" style="max-width:none;margin-bottom:8px">
        <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
        <div class="field">
          <label for="comment-body">留下你的感想</label>
          <textarea id="comment-body" name="body" maxlength="500" placeholder="這段劇情讓你想到什麼？（最多 500 字）" required></textarea>
        </div>
        <div><button class="btn" type="submit">送出留言</button></div>
      </form>`;

  let supportBlock: string;
  if (creator === undefined) {
    supportBlock = '<p class="muted">作者資料不存在。</p>';
  } else if (user !== undefined && user.id === creator.id) {
    supportBlock = `<p class="muted" style="font-size:13px">這是你的作品。你可以在創作中心查看收益、章節與推流數據。</p>
      <a class="btn ghost" href="/studio/works/${encodeURIComponent(work.id)}">前往作品管理</a>`;
  } else if (creator.plan !== 'pro') {
    supportBlock = `<p class="muted" style="font-size:13px">${escapeHtml(creator.name)} 目前是免費帳號，尚未開通打賞與閱讀收益。</p>
      <p class="inline-note">喜歡這部作品嗎？留言支持作者，或等作者升級後再打賞。</p>`;
  } else if (user === undefined) {
    supportBlock = `<p class="muted" style="font-size:13px">打賞會將 90% 分潤給作者，其餘 10% 作為平台維運。</p>
      <a class="btn gold" href="/login">登入後打賞作者</a>`;
  } else {
    const presets = TIP_PRESETS.map(
      (amount) => `<button type="button" data-tip-amount="${amount}">NT$ ${amount}</button>`,
    ).join('');
    supportBlock = `<p class="muted" style="font-size:13px">打賞會將 90% 分潤給作者，其餘 10% 作為平台維運。</p>
      <form method="post" action="/works/${encodeURIComponent(work.id)}/tip" class="tip-form">
        <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
        <div class="tip-presets">${presets}</div>
        <div class="tip-amount">
          <span>NT$</span>
          <input id="tip-amount" type="number" name="amount" min="${REVENUE_RULES.tipMin}" max="${REVENUE_RULES.tipMax}" step="1" value="100" required>
        </div>
        <div class="field">
          <label for="tip-message">給作者的話（選填）</label>
          <input id="tip-message" type="text" name="message" maxlength="200" placeholder="謝謝你的故事">
        </div>
        <button class="btn gold" type="submit">送出打賞</button>
        <p class="inline-note">示範平台不會真的扣款。</p>
      </form>`;
  }

  const authorCard = creator === undefined
    ? ''
    : `<div class="card">
      <h2>關於作者</h2>
      <div style="display:flex;gap:12px;align-items:center">
        <div class="comment-avatar" style="width:52px;height:52px;font-size:25px">${escapeHtml(creator.avatar)}</div>
        <div>
          <div><a href="/creators/${encodeURIComponent(creator.id)}"><b>${escapeHtml(creator.name)}</b></a> ${planBadge(creator)}</div>
          <div class="inline-note">@${escapeHtml(creator.username)}</div>
        </div>
      </div>
      <p class="muted" style="font-size:13px;margin-top:10px">${escapeHtml(creator.bio === '' ? '這位作者還沒有填寫簡介。' : creator.bio)}</p>
      <a class="btn ghost small" href="/creators/${encodeURIComponent(creator.id)}">查看所有作品</a>
    </div>`;

  return `
${notices.join('')}
<div class="card">
  <div class="work-hero">
    <div class="work-cover-lg color-${colorIndex(work.id)}">
      <span class="cover-emoji" aria-hidden="true">${escapeHtml(work.cover)}</span>
      <span class="cover-kind">${WORK_TYPE_LABELS[work.type]}</span>
    </div>
    <div class="work-title-area">
      <div class="badge-row">${statusBadge(work)}<span class="badge ${work.type === 'novel' ? '' : 'warn'}">${WORK_TYPE_LABELS[work.type]}</span>${work.featured ? '<span class="badge gold">編輯精選</span>' : ''}${work.published ? '' : '<span class="badge err">未公開</span>'}</div>
      <h1>${escapeHtml(work.title)}</h1>
      <div class="work-byline">${escapeHtml(creator?.avatar ?? '🪶')} ${creatorLink(db, work)} ${planBadge(creator)}<span>·</span><span>更新於 ${formatDate(work.updatedAt)}</span></div>
      ${tagList(work.tags)}
      <p class="work-synopsis">${escapeHtml(work.synopsis)}</p>
      <div class="work-numbers">
        <div><b>${formatNumber(work.views)}</b>總閱讀</div>
        <div><b>${formatNumber(options.chapters.length)}</b>章節</div>
        <div><b>${formatNumber(options.tipTotal)}</b>累計打賞（NT$）</div>
        <div><b>${formatNumber(options.bookmarks)}</b>收藏</div>
      </div>
      <div class="actions">${readButton}${bookmarkButton}${manageLink}</div>
    </div>
  </div>
</div>

<div class="two-col">
  <div>
    <div class="card">
      <h2>章節列表</h2>
      <ul class="chapter-list">${chapterItems}</ul>
    </div>
    <div class="card">
      <h2>讀者留言（${options.comments.length}）</h2>
      ${commentForm}
      ${comments}
    </div>
  </div>
  <aside class="side-stack">
    ${authorCard}
    <div class="card">
      <h2>支持這部作品</h2>
      ${supportBlock}
    </div>
    <div class="card">
      <h2>收益規則</h2>
      <p class="muted" style="font-size:13px">付費帳號的作品，每次章節閱讀可獲得 NT$ ${REVENUE_RULES.viewReward}；讀者打賞則由作者獲得 90%。</p>
      <p class="inline-note">收益會累積在創作中心，滿 NT$ ${REVENUE_RULES.withdrawMin} 可申請提領。</p>
    </div>
  </aside>
</div>`;
}

export interface ReaderPageOptions {
  db: Database;
  work: Work;
  creator: User | undefined;
  chapter: Chapter;
  chapters: Chapter[];
  user: User | undefined;
  csrfToken: string;
  canManage: boolean;
  reward: number;
}

export function readerPage(options: ReaderPageOptions): string {
  const { work, chapter, chapters } = options;
  const index = chapters.findIndex((item) => item.id === chapter.id);
  const prev = index > 0 ? chapters[index - 1] : undefined;
  const next = index >= 0 ? chapters[index + 1] : undefined;

  const images = chapter.imageUrls.length === 0
    ? ''
    : chapter.imageUrls
        .map((url, i) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(work.title)} 第 ${i + 1} 頁" loading="lazy">`)
        .join('');
  const comicNote = work.type === 'comic' && chapter.imageUrls.length === 0
    ? '<div class="comic-placeholder">這是一篇漫畫作品，作者以文字分鏡呈現。若作者提供圖片網址，會顯示在這裡。</div>'
    : '';

  const reward = options.reward > 0
    ? `<p class="inline-note" style="margin-top:18px">本次閱讀已為作者帶來 NT$ ${options.reward} 的收益。</p>`
    : '';

  const pager = `<div class="chapter-pager">
    ${prev === undefined ? '<span></span>' : `<a class="btn ghost" href="/works/${encodeURIComponent(work.id)}/chapters/${encodeURIComponent(prev.id)}">← 上一章</a>`}
    <a class="btn ghost" href="${workHref(work)}">作品目錄</a>
    ${next === undefined ? '<span></span>' : `<a class="btn" href="/works/${encodeURIComponent(work.id)}/chapters/${encodeURIComponent(next.id)}">下一章 →</a>`}
  </div>`;

  const edit = options.canManage
    ? `<a class="btn ghost small" href="/studio/works/${encodeURIComponent(work.id)}/chapters/${encodeURIComponent(chapter.id)}/edit">編輯章節</a>`
    : '';

  return `<div class="reading-shell">
  <div class="reader-toolbar">
    <div><a href="${workHref(work)}">← ${escapeHtml(work.title)}</a> <span class="muted">· 第 ${chapter.order} 章</span></div>
    <div class="actions">
      <button class="btn ghost small" type="button" data-reader-size="down" aria-label="縮小字體">A−</button>
      <button class="btn ghost small" type="button" data-reader-size="up" aria-label="放大字體">A＋</button>
      ${edit}
    </div>
  </div>
  <article class="reading-paper">
    <div class="chapter-kicker">${WORK_TYPE_LABELS[work.type]} · 第 ${chapter.order} 章</div>
    <h1>${escapeHtml(chapter.title)}</h1>
    <div class="reader-meta">${escapeHtml(options.creator?.name ?? '未知作者')} · ${formatDate(chapter.updatedAt)} · ${formatNumber(chapter.views)} 次閱讀</div>
    <div class="reader-content">
      ${comicNote}
      ${images}
      ${paragraphs(chapter.content)}
    </div>
    ${reward}
    ${pager}
  </article>
  <div class="card" style="margin-top:18px">
    <h2>喜歡這個故事？</h2>
    <div class="actions">
      <a class="btn gold" href="${workHref(work)}#support">打賞作者</a>
      <a class="btn ghost" href="${workHref(work)}">回到作品頁留言</a>
    </div>
  </div>
</div>`;
}

export interface CreatorPageOptions {
  db: Database;
  creator: User;
  works: Work[];
  totalViews: number;
  totalTips: number;
  isSelf: boolean;
  promotedIds: Set<string>;
}

export function creatorPage(options: CreatorPageOptions): string {
  const { creator } = options;
  const works = options.works.length === 0
    ? emptyState('這位作者還沒有公開作品。')
    : `<div class="work-grid">${options.works
        .map((work) => workCard(options.db, work, { promoted: options.promotedIds.has(work.id) }))
        .join('')}</div>`;

  return `<div class="creator-hero">
    <div class="creator-avatar">${escapeHtml(creator.avatar)}</div>
    <div style="flex:1;min-width:220px">
      <h1>${escapeHtml(creator.name)} ${planBadge(creator)}</h1>
      <div class="inline-note">@${escapeHtml(creator.username)} · 加入於 ${formatDate(creator.createdAt)}${creator.planSince === null ? '' : ` · 付費方案自 ${formatDate(creator.planSince)} 起`}</div>
      <p>${escapeHtml(creator.bio === '' ? '這位作者還沒有填寫簡介。' : creator.bio)}</p>
    </div>
    <div class="actions">
      <div class="stat" style="min-width:110px"><div class="label">作品</div><div class="value">${options.works.length}</div></div>
      <div class="stat" style="min-width:110px"><div class="label">總閱讀</div><div class="value">${formatNumber(options.totalViews)}</div></div>
      <div class="stat" style="min-width:110px"><div class="label">累計打賞</div><div class="value">${formatNumber(options.totalTips)}</div></div>
    </div>
  </div>
  ${options.isSelf ? `<div class="notice">這是你的公開頁面。<a href="/studio">回到創作中心</a></div>` : ''}
  ${works}`;
}

export interface LibraryPageOptions {
  db: Database;
  works: Work[];
  promotedIds: Set<string>;
}

export function libraryPage(options: LibraryPageOptions): string {
  if (options.works.length === 0) {
    return `<div class="card">${emptyState('你的收藏夾還是空的。看到喜歡的作品時，按下「收藏」就會出現在這裡。', { href: '/works', label: '去探索作品' })}</div>`;
  }
  return `<p class="inline-note" style="margin-bottom:14px">共 ${options.works.length} 部收藏作品</p>
  <div class="work-grid">${options.works
    .map((work) => workCard(options.db, work, { promoted: options.promotedIds.has(work.id) }))
    .join('')}</div>`;
}
