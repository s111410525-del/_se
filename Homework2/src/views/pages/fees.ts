import type { Database, FeeBill, Student, Term } from '../../types.js';
import { PAYMENT_METHODS } from '../../types.js';
import { escapeHtml, formatDateTime, formatMoney } from '../../util/html.js';
import {
  BILL_STATUS_LABELS,
  acceptableAmounts,
  balanceOf,
  paidOf,
  paymentsOf,
  statusOf,
  totalOf,
} from '../../services/fees.js';
import { termLabel } from '../../services/schedule.js';
import { badge, card, csrfInput, selectField, stat, table, type Tone } from '../components.js';

const STATUS_TONE: Record<string, Tone> = {
  paid: 'ok',
  partial: 'warn',
  unpaid: 'warn',
  overdue: 'err',
};

export interface FeePageOptions {
  db: Database;
  student: Student;
  term: Term;
  csrfToken: string;
  error: string | null;
  now: Date;
}

/** 學生繳費頁。 */
export function feePage(options: FeePageOptions): string {
  const { db, student, term, csrfToken, now } = options;
  const bills = db.bills
    .filter((bill) => bill.studentId === student.id)
    .sort((a, b) => b.term.localeCompare(a.term));
  const bill = bills.find((item) => item.term === term) ?? bills[0];

  if (bill === undefined) {
    return card('繳費資訊', '<p class="empty">目前沒有待繳的費用資料。</p>');
  }

  const status = statusOf(bill, now);
  const total = totalOf(bill);
  const paid = paidOf(bill);
  const balance = balanceOf(bill);
  const due = new Date(`${bill.dueDate}T23:59:59+08:00`);

  const overview = `<div class="grid cols-4">
    ${stat('應繳總額', formatMoney(total), `${bill.term}　${termLabel(bill.term)}`)}
    ${stat('已繳金額', formatMoney(paid), paid === 0 ? '尚未繳費' : '感謝繳費')}
    ${stat('繳費狀態', BILL_STATUS_LABELS[status], `截止 ${escapeHtml(bill.dueDate)}`, STATUS_TONE[status] ?? 'muted')}
    ${stat(
      '待繳餘額',
      balance === 0 ? '已繳清' : formatMoney(balance),
      balance === 0 ? '本學期無欠費' : now.getTime() > due.getTime() ? '已逾期，請儘速繳費' : `剩 ${Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 86400000))} 天`,
      balance === 0 ? 'ok' : now.getTime() > due.getTime() ? 'err' : 'warn',
    )}
  </div>`;

  const itemTable = table(
    [
      { header: '項目', render: (item) => escapeHtml(item.name) },
      { header: '金額', align: 'num', render: (item) => formatMoney(item.amount) },
      {
        header: '狀態',
        render: (item) => (item.paid ? badge(`已繳 ${formatDateTime(item.paidAt)}`, 'ok') : badge('未繳', 'warn')),
      },
    ],
    bill.items,
  );

  const discount = bill.discount === 0
    ? ''
    : `<p class="note" style="margin-top:12px">已申請學費減免 ${formatMoney(bill.discount)}，應繳總額已據此扣除。</p>`;

  // 繳費金額必須剛好沖銷一或多個完整項目，因此以選單列出所有合法金額。
  const amounts = acceptableAmounts(bill);

  const payForm = balance === 0
    ? '<p class="empty">本學期費用已繳清，無須再繳費。</p>'
    : `<form class="stack" method="post" action="/fees/${escapeHtml(bill.id)}/pay">
        ${csrfInput(csrfToken)}
        ${selectField(
          '繳費金額',
          'amount',
          amounts.map((value) => ({ value: String(value), label: `${formatMoney(value)}${value === balance ? '（繳清全部）' : ''}` })),
          String(balance),
        )}
        ${selectField('繳費方式', 'method', PAYMENT_METHODS.map((item) => ({ value: item, label: item })), 'ATM')}
        <div class="actions"><button class="btn" type="submit">確認繳費</button></div>
        <p class="hint">金額必須對應一或多個完整項目的合計；待繳餘額 ${formatMoney(balance)}，截止 ${escapeHtml(bill.dueDate)}。</p>
        <p class="hint">此為示範系統，點擊後不會真的向銀行扣款。</p>
      </form>`;

  const alert = options.error === null ? '' : `<div class="alert alert-error" role="alert"><b>!</b> ${escapeHtml(options.error)}</div>`;

  const history = table(
    [
      { header: '收據序號', render: (row) => `<code>${escapeHtml(row.serial)}</code>` },
      { header: '金額', align: 'num', render: (row) => formatMoney(row.amount) },
      { header: '方式', render: (row) => badge(row.method, 'muted') },
      { header: '時間', render: (row) => escapeHtml(formatDateTime(row.paidAt)) },
    ],
    paymentsOf(db, student.id),
    { empty: '尚無繳費紀錄' },
  );

  return [
    overview,
    card(`${bill.term} 學雜費明細`, `${itemTable}${discount}`),
    card('線上繳費', `${alert}${payForm}`),
    card('繳費紀錄', history),
  ].join('');
}

export interface FeeSummaryOptions {
  db: Database;
  term: Term;
  terms: Term[];
}

/** 管理員的繳費總覽。 */
export function feeSummaryPage(options: FeeSummaryOptions): string {
  const { db, term } = options;
  const bills = db.bills.filter((bill) => bill.term === term);
  const now = new Date();

  const totals = bills.reduce(
    (acc, bill) => {
      acc.billed += totalOf(bill);
      acc.paid += paidOf(bill);
      if (balanceOf(bill) === 0) acc.cleared += 1;
      return acc;
    },
    { billed: 0, paid: 0, cleared: 0 },
  );

  const overview = `<div class="grid cols-4">
    ${stat('應繳總額', formatMoney(totals.billed), `${bills.length} 張繳費單`)}
    ${stat('已收金額', formatMoney(totals.paid), `${Math.round((totals.paid / Math.max(1, totals.billed)) * 100)}% 收繳率`, 'ok')}
    ${stat('未繳餘額', formatMoney(Math.max(0, totals.billed - totals.paid)), '待催繳')}
    ${stat('繳清人數', `${totals.cleared} / ${bills.length}`, '本學期')}
  </div>`;

  const rows: { bill: FeeBill; studentName: string; studentId: string; total: number; paid: number; balance: number; status: string }[] = bills
    .map((bill) => {
      const user = db.users.find((item) => item.id === bill.studentId);
      return {
        bill,
        studentName: user?.name ?? '（已移除）',
        studentId: user !== undefined && user.role === 'student' ? user.studentId : '—',
        total: totalOf(bill),
        paid: paidOf(bill),
        balance: balanceOf(bill),
        status: statusOf(bill, now),
      };
    })
    .sort((a, b) => b.balance - a.balance);

  const list = table(
    [
      { header: '學號', render: (row) => escapeHtml(row.studentId) },
      { header: '姓名', render: (row) => escapeHtml(row.studentName) },
      { header: '學期', render: (row) => escapeHtml(row.bill.term) },
      { header: '應繳', align: 'num', render: (row) => formatMoney(row.total) },
      { header: '已繳', align: 'num', render: (row) => formatMoney(row.paid) },
      { header: '欠繳', align: 'num', render: (row) => formatMoney(row.balance) },
      { header: '狀態', render: (row) => badge(BILL_STATUS_LABELS[row.status as keyof typeof BILL_STATUS_LABELS], STATUS_TONE[row.status] ?? 'muted') },
      { header: '期限', render: (row) => escapeHtml(row.bill.dueDate) },
    ],
    rows,
    { empty: '此學期尚未產生繳費單' },
  );

  const filters = `<form class="filters" method="get" action="/admin/fees">
    ${selectField('學期', 'term', options.terms.map((item) => ({ value: item, label: `${item}　${termLabel(item)}` })), term, { 'data-autosubmit': 'true' })}
  </form>`;

  return [overview, card(`繳費總覽（${term}）`, `${filters}${list}`)].join('');
}