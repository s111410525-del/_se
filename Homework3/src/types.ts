/**
 * 職光 JobBeam 型別層。
 *
 * 服務層與畫面層都只依賴這裡的結構；資料目前存成 JSON，未來若要換成
 * SQLite 或 PostgreSQL，只要維持 `Database` 的形狀即可。
 */

/** 平台角色：求職者、企業雇主、平台管理員。 */
export type Role = 'seeker' | 'employer' | 'admin';

export const ROLES: Role[] = ['seeker', 'employer', 'admin'];

export const ROLE_LABELS: Record<Role, string> = {
  seeker: '求職者',
  employer: '企業雇主',
  admin: '平台管理員',
};

/** 註冊時可選的角色；管理員僅由種子資料建立。 */
export type SignupRole = 'seeker' | 'employer';

export const SIGNUP_ROLES: SignupRole[] = ['seeker', 'employer'];

/** 密碼雜湊與鹽值。 */
export interface Credentials {
  passwordHash: string;
  passwordSalt: string;
}

export interface User extends Credentials {
  id: string;
  /** 登入帳號，大小寫不敏感。 */
  username: string;
  name: string;
  email: string;
  role: Role;
  /** 企業名稱；求職者為空字串。 */
  company: string;
  bio: string;
  /** 頭像符號（單一 emoji）。 */
  avatar: string;
  /** 錢包餘額（新台幣整數）。 */
  balance: number;
  createdAt: string;
  active: boolean;
}

export interface ProfileInput {
  name: string;
  email: string;
  company: string;
  bio: string;
  avatar: string;
}

/** 工作型態。 */
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';

export const EMPLOYMENT_TYPES: EmploymentType[] = ['full-time', 'part-time', 'contract', 'internship'];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  'full-time': '全職',
  'part-time': '兼職',
  contract: '約聘',
  internship: '實習',
};

/** 職缺分類。 */
export type JobCategory =
  | 'tech'
  | 'design'
  | 'marketing'
  | 'operations'
  | 'finance'
  | 'education'
  | 'service'
  | 'other';

export const JOB_CATEGORIES: JobCategory[] = [
  'tech',
  'design',
  'marketing',
  'operations',
  'finance',
  'education',
  'service',
  'other',
];

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  tech: '資訊科技',
  design: '設計創意',
  marketing: '行銷企劃',
  operations: '營運管理',
  finance: '財務金融',
  education: '教育培訓',
  service: '餐飲服務',
  other: '其他',
};

export const JOB_CATEGORY_EMOJI: Record<JobCategory, string> = {
  tech: '💻',
  design: '🎨',
  marketing: '📣',
  operations: '📊',
  finance: '💰',
  education: '📚',
  service: '☕',
  other: '🧩',
};

export interface Job {
  id: string;
  employerId: string;
  title: string;
  category: JobCategory;
  employmentType: EmploymentType;
  location: string;
  /** 職缺內容與工作說明。 */
  description: string;
  /** 工作要求、必備技能與經驗。 */
  requirements: string;
  benefits: string;
  tags: string[];
  /** 預設月薪下限／上限（新台幣整數，0 表示未填）。 */
  salaryMin: number;
  salaryMax: number;
  /** 薪資補充說明，例如「保障年薪 14 個月」。 */
  salaryNote: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  views: number;
}

export interface JobInput {
  title: string;
  category: JobCategory;
  employmentType: EmploymentType;
  location: string;
  description: string;
  requirements: string;
  benefits: string;
  tags: string[];
  salaryMin: number;
  salaryMax: number;
  salaryNote: string;
  published: boolean;
}

/** 應徵對話的處理狀態（由企業更新）。 */
export type ConversationStatus = 'applied' | 'reviewing' | 'invited' | 'closed';

export const CONVERSATION_STATUSES: ConversationStatus[] = ['applied', 'reviewing', 'invited', 'closed'];

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  applied: '已投遞',
  reviewing: '審閱中',
  invited: '邀請面談',
  closed: '已結束',
};

/** 一則職缺對應一組「求職者 ↔ 雇主」的私訊對話。 */
export interface Conversation {
  id: string;
  jobId: string;
  seekerId: string;
  employerId: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  /** 雙方各自讀到哪裡，用來計算未讀訊息。 */
  seekerReadAt: string | null;
  employerReadAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

/** 付費曝光來源：錢包購買或管理員贈送。 */
export type PromotionSource = 'wallet' | 'admin';

export interface Promotion {
  id: string;
  jobId: string;
  employerId: string;
  source: PromotionSource;
  days: number;
  amount: number;
  startedAt: string;
  expiresAt: string;
  impressions: number;
  clicks: number;
}

export interface Topup {
  id: string;
  userId: string;
  amount: number;
  method: string;
  createdAt: string;
}

export type LedgerKind = 'topup' | 'promotion' | 'adjustment';

export const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  topup: '儲值',
  promotion: '曝光扣款',
  adjustment: '平台調整',
};

/** 錢包流水帳，每次餘額變動都留一筆。 */
export interface LedgerEntry {
  id: string;
  userId: string;
  kind: LedgerKind;
  /** 正數為入帳，負數為扣款。 */
  amount: number;
  balanceAfter: number;
  note: string;
  createdAt: string;
}

/** 整份 JSON 資料檔的形狀。 */
export interface Database {
  users: User[];
  jobs: Job[];
  conversations: Conversation[];
  messages: Message[];
  promotions: Promotion[];
  topups: Topup[];
  ledger: LedgerEntry[];
}

/** 登入失敗紀錄。 */
export interface LoginGuard {
  failures: number;
  lockedUntil: number;
}

export interface PromotionPlan {
  days: number;
  price: number;
  label: string;
  hint: string;
}

/** 付費曝光方案（模擬金流）。 */
export const PROMOTION_PLANS: PromotionPlan[] = [
  { days: 7, price: 299, label: '7 天曝光', hint: '適合急徵職缺' },
  { days: 14, price: 499, label: '14 天曝光', hint: '最受企業歡迎' },
  { days: 30, price: 899, label: '30 天曝光', hint: '長期招募' },
];

export const WALLET_RULES = {
  topupMin: 100,
  topupMax: 10000,
  topupPresets: [300, 600, 1200, 3000],
  /** 管理員手動贈送曝光的天數。 */
  adminPromotionDays: 7,
} as const;

export const JOB_RULES = {
  salaryMax: 1000000,
  tagLimit: 8,
  titleMax: 60,
} as const;

/** 常見搜尋條件。 */
export type JobSort = 'recommend' | 'newest' | 'salary' | 'popular';

export const JOB_SORT_LABELS: Record<JobSort, string> = {
  recommend: '推薦排序',
  newest: '最新刊登',
  salary: '薪資最高',
  popular: '最多瀏覽',
};
