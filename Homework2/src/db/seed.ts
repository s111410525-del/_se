import { hashPassword } from '../core/password.js';
import type { Course, Database, Enrollment, FeeBill, Notice, Payment, ScoreRecord, User } from '../types.js';

/** 所有示範帳號的預設密碼。 */
export const DEMO_PASSWORD = 'nqu1234';

const CREATED_AT = '2026-08-20T00:00:00.000Z';

function student(
  id: string,
  username: string,
  name: string,
  studentId: string,
  className: string,
  gradeYear: number,
  advisorId: string | null,
  phone: string,
  address: string,
): User {
  return {
    id,
    username,
    name,
    role: 'student',
    email: `${username}@student.nqu.edu.tw`,
    studentId,
    department: '資訊工程系',
    gradeYear,
    className,
    advisorId,
    phone,
    address,
    active: true,
    createdAt: CREATED_AT,
    ...hashPassword(DEMO_PASSWORD),
  };
}

function teacher(
  id: string,
  username: string,
  name: string,
  employeeId: string,
  title: string,
  department: string,
  office: string,
  phone: string,
): User {
  return {
    id,
    username,
    name,
    role: 'teacher',
    email: `${username}@nqu.edu.tw`,
    employeeId,
    title,
    department,
    office,
    phone,
    active: true,
    createdAt: CREATED_AT,
    ...hashPassword(DEMO_PASSWORD),
  };
}

function staff(id: string, username: string, name: string, employeeId: string, title: string): User {
  return {
    id,
    username,
    name,
    role: 'admin',
    email: `${username}@nqu.edu.tw`,
    employeeId,
    title,
    active: true,
    createdAt: CREATED_AT,
    ...hashPassword(DEMO_PASSWORD),
  };
}

function course(
  id: string,
  code: string,
  name: string,
  englishName: string,
  credits: number,
  category: Course['category'],
  term: string,
  teacherId: string,
  capacity: number,
  location: string,
  sessions: Course['sessions'],
  periods: 1 | 2 = 2,
  prerequisites: string[] = [],
): Course {
  return {
    id,
    code,
    name,
    englishName,
    credits,
    category,
    term,
    teacherId,
    capacity,
    location,
    intro: `${name}（${englishName}）為${category}課程，共 ${credits} 學分，上課地點 ${location}。`,
    sessions,
    periods,
    prerequisites,
    open: true,
  };
}

function enrollment(id: string, studentId: string, courseId: string, status: Enrollment['status'], queue = 0, at = CREATED_AT): Enrollment {
  return { id, studentId, courseId, status, queue, createdAt: at, updatedAt: at };
}

function score(id: string, studentId: string, courseId: string, midterm: number, final: number, published: boolean, at = CREATED_AT): ScoreRecord {
  return {
    id,
    studentId,
    courseId,
    items: [
      { name: '平時成績', score: midterm, weight: 40 },
      { name: '期中考試', score: final, weight: 60 },
    ],
    published,
    updatedAt: at,
  };
}

function bill(id: string, studentId: string, term: string, paidNames: string[]): FeeBill {
  const items: FeeBill['items'] = [
    { name: '學費', amount: 51000, paid: paidNames.includes('學費'), paidAt: null },
    { name: '雜費', amount: 13800, paid: paidNames.includes('雜費'), paidAt: null },
    { name: '電腦與網路使用費', amount: 2000, paid: paidNames.includes('電腦與網路使用費'), paidAt: null },
    { name: '平安保險費', amount: 250, paid: paidNames.includes('平安保險費'), paidAt: null },
  ];
  for (const item of items) item.paidAt = item.paid ? '2026-09-05T01:20:00.000Z' : null;
  return { id, studentId, term, items, discount: 0, dueDate: '2026-10-31' };
}

function notice(id: string, title: string, category: Notice['category'], body: string, authorId: string, publishedAt: string, pinned = false): Notice {
  return { id, title, category, body, authorId, pinned, publishedAt };
}

function payment(id: string, billId: string, studentId: string, amount: number, method: Payment['method'], serial: string, paidAt: string): Payment {
  return { id, billId, studentId, amount, method, serial, paidAt };
}

/**
 * 建立示範用資料集。
 *
 * 情境設計刻意涵蓋各種邊界，讓第一次開啟系統就能看到完整行為：
 *
 * - `CS330 網路程式設計` 名額只有 4 席且已被其他同學選滿，`s001` 排在候補第 1 位，
 *   隨時有人退選就會自動遞補。
 * - `CS330` 與 `CS305` 同時在週二、週四第 5-6 節，可用來觀察衝堂擋下。
 * - `CS320 機器學習` 需要先修 `CS305`，示範先修條件擋下。
 * - `114-2` 學期有已公布成績（可算 GPA），`115-1` 的成績尚未公布。
 */
export function createSeedDatabase(): Database {
  const users: User[] = [
    staff('u_admin', 'admin', '張淑婷', 'A1001', '教務處課務組組長'),
    teacher('u_tchen', 'tchen', '陳鍾誠', 'T2001', '教授', '資訊工程系', '計算機實驗室 TA202', '082-336-2001'),
    teacher('u_twang', 'twang', '王美玲', 'T2002', '助理教授', '資訊工程系', '資訊大樓 A305', '082-336-2002'),
    teacher('u_tlin', 'tlin', '林志豪', 'T2003', '助理教授', '資訊與網路安全管理系', '資訊大樓 B412', '082-336-2003'),
    teacher('u_tyang', 'tyang', '楊淑芬', 'T3001', '講師', '共同教育中心', '人文大樓 C201', '082-336-3001'),
    student('u_s001', 's001', '陳秉硯', '41115001', '資工一甲', 1, 'u_tchen', '0900-123-456', '金門縣金沙鎮山外里 1 號'),
    student('u_s002', 's002', '李佳蓉', '41115002', '資工一甲', 1, 'u_tchen', '0901-222-333', '金門縣金湖鎮溪邊村 2 號'),
    student('u_s003', 's003', '張家豪', '41115003', '資工一甲', 1, 'u_twang', '0902-333-444', '金門縣金城鎮前水頭 3 號'),
    student('u_s004', 's004', '黃詩涵', '41115004', '資工一乙', 1, 'u_twang', '0903-444-555', '金門縣烈嶼鄉東坑 4 號'),
    student('u_s005', 's005', '劉承恩', '41115005', '資工一乙', 1, 'u_tchen', '0904-555-666', '金門縣烏坵鄉東村 5 號'),
  ];

  const courses: Course[] = [
    // ── 115 學年度第 1 學期（目前學期） ───────────────────────────
    course('c_cs101', 'CS101', '程式設計', 'Introduction to Computer Programming', 3, '必修', '115-1', 'u_tchen', 60, '計算機實驗室 TA202', [
      { day: 1, start: 3 },
      { day: 3, start: 3 },
    ]),
    course('c_cs210', 'CS210', '資料結構', 'Data Structures', 3, '必修', '115-1', 'u_twang', 50, '資訊大樓 A305', [
      { day: 1, start: 5 },
      { day: 3, start: 5 },
    ]),
    course('c_cs201', 'CS201', '物件導向程式設計', 'Object-Oriented Programming', 3, '選修', '115-1', 'u_tchen', 45, '資訊大樓 A305', [
      { day: 2, start: 3 },
      { day: 4, start: 3 },
    ], 1, ['CS100']),
    course('c_cs305', 'CS305', '演算法', 'Algorithms', 3, '專業選修', '115-1', 'u_tlin', 40, '資訊大樓 B412', [
      { day: 2, start: 5 },
      { day: 4, start: 5 },
    ]),
    course('c_cs330', 'CS330', '網路程式設計', 'Network Programming', 3, '專業選修', '115-1', 'u_tlin', 4, '資訊大樓 B412', [
      { day: 2, start: 5 },
    ], 2, ['CS100']),
    course('c_cs320', 'CS320', '機器學習', 'Machine Learning', 3, '專業選修', '115-1', 'u_tlin', 30, '資訊大樓 B503', [
      { day: 3, start: 7 },
    ], 2, ['CS305']),
    course('c_cs399', 'CS399', '專題實務', 'Project Practice', 2, '選修', '115-1', 'u_tchen', 20, '計算機實驗室 TA204', [
      { day: 5, start: 7 },
    ]),
    course('c_ge101', 'GE101', '大學國文', 'College Chinese', 2, '共同必修', '115-1', 'u_tyang', 80, '人文大樓 C201', [
      { day: 1, start: 7 },
      { day: 3, start: 7 },
    ], 1),
    course('c_en201', 'EN201', '學術英文', 'Academic English', 2, '共同必修', '115-1', 'u_tyang', 60, '人文大樓 C305', [
      { day: 2, start: 7 },
      { day: 4, start: 7 },
    ], 1),

    // ── 114 學年度第 2 學期（已結束，成績已公布） ─────────────────
    course('c_cs100', 'CS100', '計算機概論', 'Introduction to Computer Science', 3, '必修', '114-2', 'u_tchen', 60, '計算機實驗室 TA202', [
      { day: 1, start: 3 },
      { day: 3, start: 3 },
    ]),
    course('c_ma101', 'MA101', '微積分', 'Calculus', 3, '必修', '114-2', 'u_twang', 60, '資訊大樓 A305', [
      { day: 2, start: 5 },
      { day: 4, start: 5 },
    ]),
    course('c_cs102', 'CS102', '網頁設計與實作', 'Web Design and Practice', 2, '選修', '114-2', 'u_tlin', 40, '資訊大樓 B412', [
      { day: 5, start: 3 },
    ], 1),
  ];

  const enrollments: Enrollment[] = [
    // 115-1 必修
    enrollment('e_001', 'u_s001', 'c_cs101', 'enrolled'),
    enrollment('e_002', 'u_s002', 'c_cs101', 'enrolled'),
    enrollment('e_003', 'u_s003', 'c_cs101', 'enrolled'),
    enrollment('e_004', 'u_s004', 'c_cs101', 'enrolled'),
    enrollment('e_005', 'u_s005', 'c_cs101', 'enrolled'),
    enrollment('e_006', 'u_s001', 'c_cs210', 'enrolled'),
    enrollment('e_007', 'u_s002', 'c_cs210', 'enrolled'),
    enrollment('e_008', 'u_s003', 'c_cs210', 'enrolled'),
    enrollment('e_009', 'u_s004', 'c_cs210', 'enrolled'),
    enrollment('e_010', 'u_s005', 'c_cs210', 'enrolled'),
    enrollment('e_011', 'u_s001', 'c_ge101', 'enrolled'),
    enrollment('e_012', 'u_s002', 'c_ge101', 'enrolled'),
    enrollment('e_013', 'u_s004', 'c_ge101', 'enrolled'),
    enrollment('e_014', 'u_s005', 'c_en201', 'enrolled'),
    enrollment('e_015', 'u_s003', 'c_en201', 'enrolled'),
    // 115-1 選修：CS330 名額 4 席，s002～s005 已選滿，s001 候補第 1 位
    enrollment('e_016', 'u_s002', 'c_cs330', 'enrolled'),
    enrollment('e_017', 'u_s003', 'c_cs330', 'enrolled'),
    enrollment('e_018', 'u_s004', 'c_cs330', 'enrolled'),
    enrollment('e_019', 'u_s005', 'c_cs330', 'enrolled'),
    enrollment('e_025', 'u_s001', 'c_cs330', 'waitlisted', 1),
    enrollment('e_026', 'u_s002', 'c_cs320', 'waitlisted', 1),
    enrollment('e_020', 'u_s001', 'c_cs201', 'enrolled'),
    enrollment('e_021', 'u_s002', 'c_cs201', 'enrolled'),
    enrollment('e_022', 'u_s003', 'c_cs305', 'enrolled'),
    enrollment('e_023', 'u_s004', 'c_cs305', 'enrolled'),
    enrollment('e_024', 'u_s005', 'c_cs305', 'enrolled'),
    // 114-2 已結束課程
    enrollment('e_101', 'u_s001', 'c_cs100', 'enrolled'),
    enrollment('e_102', 'u_s002', 'c_cs100', 'enrolled'),
    enrollment('e_103', 'u_s003', 'c_cs100', 'enrolled'),
    enrollment('e_104', 'u_s004', 'c_cs100', 'enrolled'),
    enrollment('e_105', 'u_s005', 'c_cs100', 'enrolled'),
    enrollment('e_106', 'u_s001', 'c_ma101', 'enrolled'),
    enrollment('e_107', 'u_s002', 'c_ma101', 'enrolled'),
    enrollment('e_108', 'u_s003', 'c_ma101', 'enrolled'),
    enrollment('e_109', 'u_s004', 'c_ma101', 'enrolled'),
    enrollment('e_110', 'u_s005', 'c_ma101', 'enrolled'),
    enrollment('e_111', 'u_s004', 'c_cs102', 'enrolled'),
    enrollment('e_112', 'u_s005', 'c_cs102', 'enrolled'),
  ];

  const scores: ScoreRecord[] = [
    score('s_001', 'u_s001', 'c_cs100', 94, 91, true),
    score('s_002', 'u_s001', 'c_ma101', 80, 77, true),
    score('s_003', 'u_s002', 'c_cs100', 88, 83, true),
    score('s_004', 'u_s002', 'c_ma101', 66, 62, true),
    score('s_005', 'u_s003', 'c_cs100', 62, 55, true),
    score('s_006', 'u_s003', 'c_ma101', 74, 69, true),
    score('s_007', 'u_s004', 'c_cs100', 90, 87, true),
    score('s_008', 'u_s004', 'c_ma101', 92, 90, true),
    score('s_009', 'u_s005', 'c_cs100', 75, 68, true),
    score('s_010', 'u_s005', 'c_ma101', 58, 52, true),
    score('s_011', 'u_s004', 'c_cs102', 88, 90, true),
    // 115-1 成績輸入中（尚未公布）
    score('s_021', 'u_s001', 'c_cs101', 92, 0, false),
    score('s_022', 'u_s002', 'c_cs101', 85, 0, false),
    score('s_023', 'u_s003', 'c_cs101', 71, 0, false),
  ];

  const notices: Notice[] = [
    notice(
      'n_001',
      '115 學年度第 1 學期選課系統開放公告',
      '選課',
      '選課開放期間為 9 月 1 日至 9 月 15 日，請於期限內完成選課。\n每學期修課上限 25 學分，若需加選請攜帶加選單至註冊課務組辦理。\n候補系統將於退選後自動依順位遞補，請留意系統通知。',
      'u_admin',
      '2026-08-25T01:00:00.000Z',
      true,
    ),
    notice(
      'n_002',
      '第 115 學年度第 1 學期學雜費繳費公告',
      '繳費',
      '本學期學雜費合計 67,050 元，繳費截止日為 10 月 31 日。\n請利用 ATM、銀行臨櫃或線上刷卡繳費；逾期未繳者將被停止選課權利。\n已完成繳費者請於系統中確認收據序號。',
      'u_admin',
      '2026-08-28T01:00:00.000Z',
      true,
    ),
    notice(
      'n_003',
      '資訊大樓機房維護與停機通知',
      '公告',
      '10 月 8 日（週四） 13:00 起至翌日 08:00，資訊大樓 A、B 棟進行年度網路設備維護。\n維護期間校園網路將中斷，線上選課與成績查詢可能無法使用，請預先完成作業。',
      'u_tchen',
      '2026-09-30T02:00:00.000Z',
      false,
    ),
    notice(
      'n_004',
      '計算機實驗室開放與 TA 值班時段',
      '公告',
      '計算機實驗室（TA202）平日 08:00 至 21:00 開放，假日不開放。\n每週二、週四 14:00 至 16:00 由助教值班，協助修課同學排除安裝與環境設定問題。',
      'u_tchen',
      '2026-09-12T02:00:00.000Z',
      false,
    ),
    notice(
      'n_005',
      '專題實務課程說明會',
      '活動',
      'CS399 專題實務將於 10 月 15 日（三）下午 14:00 於資訊大樓 A305 舉行說明會。\n有意願參與的同學請於說明會前至系統填寫分組意向表。',
      'u_tchen',
      '2026-10-01T02:00:00.000Z',
      false,
    ),
  ];

  const bills: FeeBill[] = [
    bill('b_1151_s001', 'u_s001', '115-1', ['學費']),
    bill('b_1151_s002', 'u_s002', '115-1', ['學費', '雜費']),
    bill('b_1151_s003', 'u_s003', '115-1', []),
    bill('b_1151_s004', 'u_s004', '115-1', ['學費', '雜費', '電腦與網路使用費', '平安保險費']),
    bill('b_1151_s005', 'u_s005', '115-1', ['平安保險費']),
    bill('b_1142_s001', 'u_s001', '114-2', ['學費', '雜費', '電腦與網路使用費', '平安保險費']),
    bill('b_1142_s002', 'u_s002', '114-2', ['學費', '雜費', '電腦與網路使用費', '平安保險費']),
  ];

  const payments: Payment[] = [
    payment('pay_001', 'b_1151_s001', 'u_s001', 51000, 'ATM', 'NQU11510001', '2026-09-05T01:20:00.000Z'),
    payment('pay_002', 'b_1151_s002', 'u_s002', 51000, '銀行臨櫃', 'NQU11510002', '2026-09-05T03:40:00.000Z'),
    payment('pay_003', 'b_1151_s002', 'u_s002', 13800, 'ATM', 'NQU11510003', '2026-09-06T02:10:00.000Z'),
    payment('pay_004', 'b_1151_s004', 'u_s004', 67050, '線上刷卡', 'NQU11510004', '2026-09-07T06:00:00.000Z'),
    payment('pay_005', 'b_1151_s005', 'u_s005', 250, '郵局劃撥', 'NQU11510005', '2026-09-08T00:30:00.000Z'),
  ];

  return { users, courses, enrollments, scores, notices, bills, payments };
}

/** 登入頁要提示的示範帳號清單。 */
export function demoAccounts(): { username: string; role: string }[] {
  return [
    { username: 's001', role: '學生 陳秉硯' },
    { username: 'tchen', role: '教師 陳鍾誠' },
    { username: 'admin', role: '教務 張淑婷' },
  ];
}