/**
 * 校務系統的領域型別。
 *
 * 這個檔案是整個系統的「資料契約」：儲存層、服務層與檢視層都只依賴這裡
 * 宣告的介面，因此在沒有資料庫的情況下，只要替換 `Database` 的實作即可
 * 換掉後端（例如改接 SQLite 或真正的 SQL Server）。
 */

/** 系統角色：學生、教師、教職員管理者。 */
export type Role = 'student' | 'teacher' | 'admin';

/** 星期，1 代表週一，5 代表週五。 */
export type Day = 1 | 2 | 3 | 4 | 5;

/** 第幾節課。 */
export type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** 學期代碼，例如 `115-1` 代表 115 學年度第 1 學期。 */
export type Term = string;

/** 學期身分別。 */
export const TERMS: Term[] = ['115-1', '114-2'];

export const ROLE_LABELS: Record<Role, string> = {
  student: '學生',
  teacher: '教師',
  admin: '教職員',
};

/** 每週上課的節次安排。 */
export const DAYS: Day[] = [1, 2, 3, 4, 5];

export const PERIODS: Period[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const DAY_LABELS: Record<Day, string> = {
  1: '週一',
  2: '週二',
  3: '週三',
  4: '週四',
  5: '週五',
};

/** 每節課的上課時間。 */
export const PERIOD_TIMES: Record<Period, string> = {
  1: '08:00-09:00',
  2: '09:10-10:00',
  3: '10:10-11:00',
  4: '11:10-12:00',
  5: '12:10-13:00',
  6: '13:10-14:00',
  7: '14:10-15:00',
  8: '15:20-16:10',
  9: '16:20-17:10',
  10: '17:20-18:10',
  11: '18:30-19:20',
  12: '19:30-20:20',
};

/** 密碼雜湊所需的鹽與雜湊值。 */
export interface Credentials {
  passwordHash: string;
  passwordSalt: string;
}

/** 所有帳號共用的欄位。 */
export interface UserBase extends Credentials {
  id: string;
  /** 登入帳號。 */
  username: string;
  /** 中文姓名。 */
  name: string;
  role: Role;
  email: string;
  /** 建立時間（ISO 字串）。 */
  createdAt: string;
  /** 是否停用。 */
  active: boolean;
}

export interface Student extends UserBase {
  role: 'student';
  /** 學號。 */
  studentId: string;
  department: string;
  /** 年級（1～4）。 */
  gradeYear: number;
  className: string;
  phone: string;
  address: string;
  /** 導師帳號 id。 */
  advisorId: string | null;
}

export interface Teacher extends UserBase {
  role: 'teacher';
  employeeId: string;
  title: string;
  department: string;
  office: string;
  phone: string;
}

export interface Staff extends UserBase {
  role: 'admin';
  employeeId: string;
  title: string;
}

export type User = Student | Teacher | Staff;

/** 送出表單時允許修改的個人資料欄位。 */
export interface ProfileInput {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

/** 一週中的一次上課時間（以節次為單位）。 */
export interface Session {
  day: Day;
  start: Period;
}

/** 課程類別。 */
export type CourseCategory = '必修' | '選修' | '共同必修' | '專業選修';

export const CATEGORIES: CourseCategory[] = ['必修', '選修', '共同必修', '專業選修'];

export interface Course {
  id: string;
  /** 課程代號，例如 `CS210`。 */
  code: string;
  name: string;
  englishName: string;
  credits: number;
  category: CourseCategory;
  term: Term;
  teacherId: string;
  /** 修課人數上限。 */
  capacity: number;
  location: string;
  intro: string;
  /** 每週的節次安排。 */
  sessions: Session[];
  /** 每次上課佔幾節（1 或 2）。 */
  periods: 1 | 2;
  /** 先修課程代號。 */
  prerequisites: string[];
  /** 選課是否開放。 */
  open: boolean;
}

export type EnrollmentStatus = 'enrolled' | 'waitlisted' | 'dropped';

export const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  enrolled: '已選',
  waitlisted: '候補',
  dropped: '已退',
};

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  status: EnrollmentStatus;
  /** 候補順位，僅 `waitlisted` 有值。 */
  queue: number;
  createdAt: string;
  updatedAt: string;
}

/** 一次評分的構成（期中考、平時成績…）。 */
export interface ScoreItem {
  name: string;
  /** 0～100 的分數。 */
  score: number;
  /** 佔總成績的百分比。 */
  weight: number;
}

/** 學生在單一課程的成績檔案。 */
export interface ScoreRecord {
  id: string;
  studentId: string;
  courseId: string;
  items: ScoreItem[];
  /** 是否已公布給學生。 */
  published: boolean;
  updatedAt: string;
}

/** 公告。 */
export interface Notice {
  id: string;
  title: string;
  category: '公告' | '活動' | '選課' | '繳費' | '其他';
  body: string;
  authorId: string;
  pinned: boolean;
  publishedAt: string;
}

export const NOTICE_CATEGORIES: Notice['category'][] = ['公告', '活動', '選課', '繳費', '其他'];

export interface FeeItem {
  name: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
}

export interface FeeBill {
  id: string;
  studentId: string;
  term: Term;
  items: FeeItem[];
  /** 學費減免金額。 */
  discount: number;
  dueDate: string;
}

export type PaymentMethod = 'ATM' | '銀行臨櫃' | '線上刷卡' | '郵局劃撥';

export const PAYMENT_METHODS: PaymentMethod[] = ['ATM', '銀行臨櫃', '線上刷卡', '郵局劃撥'];

export interface Payment {
  id: string;
  billId: string;
  studentId: string;
  amount: number;
  method: PaymentMethod;
  /** 收據／交易序號。 */
  serial: string;
  paidAt: string;
}

/** 整個資料庫的內容，會被序列化成一個 JSON 檔案。 */
export interface Database {
  users: User[];
  courses: Course[];
  enrollments: Enrollment[];
  scores: ScoreRecord[];
  notices: Notice[];
  bills: FeeBill[];
  payments: Payment[];
}

/** 登入失敗紀錄，用於暫時鎖定。 */
export interface LoginGuard {
  failures: number;
  lockedUntil: number;
}