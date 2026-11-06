import type { Conversation, Database, Job, Message, User } from '../../types.js';
import { CONVERSATION_STATUSES, CONVERSATION_STATUS_LABELS } from '../../types.js';
import {
  conversationList,
  conversationStatusBadge,
  statCard,
} from '../components.js';
import { unreadCount } from '../../services/messaging.js';
import {
  escapeHtml,
  formatDateTime,
  timeAgo,
} from '../../util/html.js';

export interface InboxOptions {
  db: Database;
  user: User;
  conversations: Conversation[];
  unread: number;
}

export function inboxPage(options: InboxOptions): string {
  const unreadConversations = options.conversations.filter(
    (conversation) => unreadCount(options.db, conversation, options.user.id) > 0,
  ).length;

  return `<div class="grid cols-3" style="margin-bottom:18px">
    ${statCard('對話數量', String(options.conversations.length), options.user.role === 'seeker' ? '與企業的私訊' : '與求職者的私訊')}
    ${statCard('未讀訊息', String(options.unread), '等待你查看', options.unread > 0 ? 'gold' : 'ok')}
    ${statCard('有未讀的對話', String(unreadConversations), '優先回覆', unreadConversations > 0 ? 'err' : 'ok')}
  </div>
  <div class="notice">應徵與聯繫都在這裡進行。回覆訊息不會額外收費。</div>
  ${conversationList(options.db, options.conversations, options.user)}`;
}

export interface ThreadOptions {
  db: Database;
  conversation: Conversation;
  job: Job | undefined;
  seeker: User | undefined;
  employer: User | undefined;
  viewer: User;
  messages: Message[];
  csrfToken: string;
}

export function threadPage(options: ThreadOptions): string {
  const { conversation, job, seeker, employer, viewer } = options;
  const isEmployerSide = viewer.id === conversation.employerId || viewer.role === 'admin';
  const other = isEmployerSide ? seeker : employer;
  const otherName = other === undefined
    ? '未知使用者'
    : (other.company !== '' && !isEmployerSide ? other.company : other.name);
  const jobLink = job === undefined
    ? '<span class="muted">職缺已移除</span>'
    : `<a href="/jobs/${encodeURIComponent(job.id)}">${escapeHtml(job.title)}</a>`;

  const messages = options.messages.length === 0
    ? '<div class="empty">還沒有人開口，送出第一則訊息吧。</div>'
    : options.messages.map((message) => messageRow(message, options)).join('');

  const statusForm = isEmployerSide
    ? `<form method="post" action="/messages/${encodeURIComponent(conversation.id)}/status" class="actions" style="margin:0">
        <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
        <select name="status" style="width:auto" aria-label="應徵狀態">
          ${CONVERSATION_STATUSES.map(
            (status) =>
              `<option value="${status}"${conversation.status === status ? ' selected' : ''}>${CONVERSATION_STATUS_LABELS[status]}</option>`,
          ).join('')}
        </select>
        <button class="btn ghost small" type="submit">更新狀態</button>
      </form>`
    : `<span class="inline-note">目前狀態：${CONVERSATION_STATUS_LABELS[conversation.status]}</span>`;

  return `<p><a href="/messages">← 回到訊息中心</a></p>
<section class="card">
  <div class="thread-head">
    <div>
      <div class="badge-row">${conversationStatusBadge(conversation)}<span class="badge muted">${isEmployerSide ? '企業端' : '求職者端'}</span></div>
      <h1>${escapeHtml(otherName)}</h1>
      <div class="inline-note">職缺：${jobLink} · 對話建立於 ${escapeHtml(formatDateTime(conversation.createdAt))}</div>
    </div>
    <div class="actions">${statusForm}</div>
  </div>

  ${isEmployerSide ? '' : `<div class="notice">你的應徵訊息會直接送給發布職缺的企業。企業更新狀態後，你可以回到這裡查看。</div>`}

  <div class="messages">${messages}</div>

  <form method="post" action="/messages/${encodeURIComponent(conversation.id)}" class="composer">
    <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
    <div class="field">
      <label for="body">回覆訊息</label>
      <textarea id="body" name="body" maxlength="2000" required placeholder="輸入訊息，按下送出後對方會在工作階段中看到。"></textarea>
      <span class="hint">最多 2,000 字</span>
    </div>
    <div class="actions">
      <button class="btn" type="submit">送出訊息</button>
      ${job === undefined ? '' : `<a class="btn ghost" href="/jobs/${encodeURIComponent(job.id)}">查看職缺</a>`}
    </div>
  </form>
</section>`;
}

function messageRow(message: Message, options: ThreadOptions): string {
  const mine = message.senderId === options.viewer.id;
  const sender = options.db.users.find((user) => user.id === message.senderId);
  return `<div class="message-row${mine ? ' mine' : ''}">
    <span class="message-avatar">${escapeHtml(sender?.avatar ?? '💬')}</span>
    <div>
      <div class="bubble">${escapeHtml(message.body)}</div>
      <div class="bubble-meta">${escapeHtml(sender?.name ?? '未知')} · ${escapeHtml(timeAgo(message.createdAt))}</div>
    </div>
  </div>`;
}
