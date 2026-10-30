/**
 * 墨流 InkFlow 的領域型別。
 *
 * 型別層刻意與 HTTP、畫面分離，服務層只依賴這裡的結構。未來若把 JSON
 * 儲存區換成 SQLite 或 PostgreSQL，只要讓新的儲存層實作 `Database`
 * 的形狀即可，路由與畫面不需要跟著改。
 */

/** 平台角色。所有註冊者都是創作者，管理員另外擁有平台管理權。 */
export type Role = 'member' | 'admin';

/** 帳號方案：免費帳號可投稿；付費帳號可開通收益與系統推流。 */
export type Plan = 'free' | 'pro';

export const PLANS: Plan[] = ['free', 'pro'];

export const PLAN_LABELS: Record<Plan, string> = {
  free: '免費帳號',
  pro: '付費帳號',
};

export const PLAN_PRICES: Record<Plan, number> = {
  free: 0,
  pro: 199,
};

export const ROLE_LABELS: Record<Role, string> = {
  member: '創作者',
  admin: '平台管理員',
};

/** 作品類型。 */
export type WorkType = 'novel' | 'comic';

export const WORK_TYPES: WorkType[] = ['novel', 'comic'];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  novel: '小說',
  comic: '漫畫',
};

/** 作品的連載狀態。 */
export type WorkStatus = 'serializing' | 'completed';

export const WORK_STATUSES: WorkStatus[] = ['serializing', 'completed'];

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  serializing: '連載中',
  completed: '已完結',
};

/** 密碼雜湊與鹽值。 */
export interface Credentials {
  passwordHash: string;
  passwordSalt: string;
}

export interface User extends Credentials {
  id: string;
  /** 登入帳號，大小寫不敏感（比對時會轉小寫）。 */
  username: string;
  name: string;
  email: string;
  role: Role;
  plan: Plan;
  /** 個人簡介，顯示在創作者頁。 */
  bio: string;
  /** 頭像符號（單一 emoji 或一兩個字元）。 */
  avatar: string;
  createdAt: string;
  /** 升級為付費帳號的時間；免費帳號為 null。 */
  planSince: string | null;
  active: boolean;
}

export interface ProfileInput {
  name: string;
  email: string;
  bio: string;
  avatar: string;
}

export interface Work {
  id: string;
  creatorId: string;
  title: string;
  synopsis: string;
  type: WorkType;
  tags: string[];
  /** 封面符號，例如 `🌙`；封面底色由作品 id 決定。 */
  cover: string;
  status: WorkStatus;
  /** 是否公開展示。未公開的作品只有作者與管理員看得到。 */
  published: boolean;
  /** 管理員精選。 */
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  /** 作品總瀏覽數（讀者開啟章節時累加）。 */
  views: number;
}

export interface WorkInput {
  title: string;
  synopsis: string;
  type: WorkType;
  tags: string[];
  cover: string;
  status: WorkStatus;
  published: boolean;
}

export interface Chapter {
  id: string;
  workId: string;
  title: string;
  /** 小說正文，或漫畫的分鏡／文字說明。 */
  content: string;
  /** 漫畫可附上的圖片網址（僅允許 http/https）。 */
  imageUrls: string[];
  /** 顯示順序，從 1 開始。 */
  order: number;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterInput {
  title: string;
  content: string;
  imageUrls: string[];
}

export interface Comment {
  id: string;
  workId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface Bookmark {
  userId: string;
  workId: string;
  createdAt: string;
}

/** 讀者打賞。平台抽取 10%，其餘 90% 給付費創作者。 */
export interface Tip {
  id: string;
  workId: string;
  creatorId: string;
  fromUserId: string;
  amount: number;
  message: string;
  creatorShare: number;
  platformShare: number;
  createdAt: string;
}

export type EarningKind = 'view' | 'tip';

/** 創作者的收益明細。每次有效閱讀或打賞都會留下紀錄。 */
export interface Earning {
  id: string;
  creatorId: string;
  workId: string | null;
  kind: EarningKind;
  amount: number;
  note: string;
  createdAt: string;
}

export type WithdrawalStatus = 'pending' | 'paid' | 'rejected';

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: '審核中',
  paid: '已撥款',
  rejected: '已退回',
};

export interface Withdrawal {
  id: string;
  creatorId: string;
  amount: number;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt: string | null;
  note: string;
}

export type PromotionSource = 'plan' | 'admin';

/** 系統推流活動。擁有進行中推流的作品會出現在首頁推流區並獲得排序加權。 */
export interface Promotion {
  id: string;
  workId: string;
  creatorId: string;
  source: PromotionSource;
  startedAt: string;
  expiresAt: string;
  impressions: number;
  clicks: number;
}

/** 整個 JSON 資料檔的形狀。 */
export interface Database {
  users: User[];
  works: Work[];
  chapters: Chapter[];
  comments: Comment[];
  bookmarks: Bookmark[];
  tips: Tip[];
  earnings: Earning[];
  withdrawals: Withdrawal[];
  promotions: Promotion[];
}

/** 登入失敗紀錄（只存在記憶體）。 */
export interface LoginGuard {
  failures: number;
  lockedUntil: number;
}

/** 平台收益規則，集中在這裡讓畫面與服務層使用同一組數字。 */
export const REVENUE_RULES = {
  /** 付費創作者每獲得一次章節閱讀的收益（新台幣）。 */
  viewReward: 0.02,
  /** 打賞時創作者分潤比例。 */
  creatorTipShare: 0.9,
  /** 單次打賞下限與上限。 */
  tipMin: 10,
  tipMax: 5000,
  /** 申請提領的最低金額。 */
  withdrawMin: 100,
  /** 每檔系統推流的天數。 */
  promotionDays: 7,
  /** 付費帳號月費（示範用，不會真的扣款）。 */
  proMonthlyPrice: PLAN_PRICES.pro,
} as const;

/** 常見的打賞金額按鈕。 */
export const TIP_PRESETS = [30, 100, 300, 1000];

/** 作品標籤的長度與數量限制。 */
export const TAG_LIMIT = 5;
