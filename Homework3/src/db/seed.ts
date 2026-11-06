import { hashPassword } from '../core/password.js';
import type {
  Conversation,
  Database,
  Job,
  LedgerEntry,
  Message,
  Promotion,
  Topup,
  User,
} from '../types.js';

/** 示範帳號密碼。 */
export const DEMO_PASSWORD = 'job1234';

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString();
}

interface UserSeed {
  id: string;
  username: string;
  name: string;
  email: string;
  role: User['role'];
  company: string;
  bio: string;
  avatar: string;
  balance: number;
  createdAt: string;
}

function user(seed: UserSeed): User {
  return { ...seed, active: true, ...hashPassword(DEMO_PASSWORD) };
}

interface JobSeed extends Omit<Job, 'createdAt' | 'updatedAt' | 'views'> {
  createdDaysAgo: number;
  updatedDaysAgo: number;
  views: number;
}

function job(seed: JobSeed): Job {
  const { createdDaysAgo, updatedDaysAgo, ...rest } = seed;
  return {
    ...rest,
    createdAt: daysAgo(createdDaysAgo),
    updatedAt: daysAgo(updatedDaysAgo),
  };
}

function promotion(
  id: string,
  jobId: string,
  employerId: string,
  source: Promotion['source'],
  days: number,
  amount: number,
  startedDaysAgo: number,
  remainingDays: number,
  impressions: number,
  clicks: number,
): Promotion {
  return {
    id,
    jobId,
    employerId,
    source,
    days,
    amount,
    startedAt: daysAgo(startedDaysAgo),
    expiresAt: daysFromNow(remainingDays),
    impressions,
    clicks,
  };
}

function ledger(
  id: string,
  userId: string,
  kind: LedgerEntry['kind'],
  amount: number,
  balanceAfter: number,
  note: string,
  days: number,
): LedgerEntry {
  return { id, userId, kind, amount, balanceAfter, note, createdAt: daysAgo(days) };
}

/**
 * 建立示範資料。
 *
 * 讓第一次啟動就能看到完整流程：企業已儲值並買過曝光、求職者已投遞
 * 並與企業私訊、平台也有一筆管理員贈送的曝光。
 */
export function createSeedDatabase(): Database {
  const users: User[] = [
    user({
      id: 'u_admin',
      username: 'admin',
      name: '職光小編',
      email: 'admin@jobbeam.example',
      role: 'admin',
      company: '職光 JobBeam',
      bio: '負責平台營運、職缺審核與企業曝光管理。',
      avatar: '🛠',
      balance: 0,
      createdAt: daysAgo(400),
    }),
    user({
      id: 'u_dean',
      username: 'dean',
      name: '林彥廷',
      email: 'dean@yunshan.example',
      role: 'employer',
      company: '雲杉科技',
      bio: '雲杉科技人資主管，負責研發與產品團隊招募，喜歡用作品說話的夥伴。',
      avatar: '🌲',
      balance: 1001,
      createdAt: daysAgo(260),
    }),
    user({
      id: 'u_mira',
      username: 'mira',
      name: '周以晴',
      email: 'mira@baydesign.example',
      role: 'employer',
      company: '海灣設計',
      bio: '海灣設計共同創辦人，專注品牌識別、數位產品與生活風格設計。',
      avatar: '🌊',
      balance: 501,
      createdAt: daysAgo(180),
    }),
    user({
      id: 'u_nova',
      username: 'nova',
      name: '陳柏宇',
      email: 'nova@startmap.example',
      role: 'employer',
      company: '星圖數據',
      bio: '星圖數據營運長，正在打造讓中小企業也能使用的資料分析工具。',
      avatar: '🛰',
      balance: 0,
      createdAt: daysAgo(120),
    }),
    user({
      id: 'u_lena',
      username: 'lena',
      name: '張芯瑜',
      email: 'lena@example.com',
      role: 'seeker',
      company: '',
      bio: '五年 React 開發經驗，喜歡把複雜流程做得簡單好用，正在尋找前端新挑戰。',
      avatar: '🦊',
      balance: 0,
      createdAt: daysAgo(90),
    }),
    user({
      id: 'u_kai',
      username: 'kai',
      name: '吳凱翔',
      email: 'kai@example.com',
      role: 'seeker',
      company: '',
      bio: '產品設計師，關注教育、交通與公共服務，作品集以使用者研究與互動設計為主。',
      avatar: '🐳',
      balance: 0,
      createdAt: daysAgo(60),
    }),
    user({
      id: 'u_iris',
      username: 'iris',
      name: '許采翎',
      email: 'iris@example.com',
      role: 'seeker',
      company: '',
      bio: '行銷企劃與內容編輯，擅長社群經營、數據觀察與品牌故事。',
      avatar: '🌻',
      balance: 0,
      createdAt: daysAgo(30),
    }),
  ];

  const jobs: Job[] = [
    job({
      id: 'job_frontend',
      employerId: 'u_dean',
      title: '資深前端工程師',
      category: 'tech',
      employmentType: 'full-time',
      location: '台北市信義區（混合辦公）',
      description:
        '你會加入雲杉科技的產品體驗團隊，負責企業資料平台的 Web 前端架構與功能開發。\n\n團隊目前有 6 位工程師、2 位設計師，每兩週一個 sprint，產品已服務超過 300 家企業客戶。我們重視可維護的程式碼、順暢的協作流程，以及對使用者體驗的堅持。\n\n主要工作包含：\n- 以 React 與 TypeScript 開發核心產品功能\n- 與設計師共同建立設計系統與元件庫\n- 改善效能、無障礙與前端測試品質\n- 參與技術選型與架構討論，協助指導團隊成員',
      requirements:
        '必要條件：\n- 5 年以上前端開發經驗\n- 精通 React、TypeScript、HTML/CSS\n- 熟悉前端測試（Vitest、Playwright 或同類工具）\n- 能清楚溝通技術決策，願意參與程式碼審查\n\n加分條件：\n- 有設計系統或元件庫建置經驗\n- 熟悉資料視覺化（D3、ECharts）\n- 有 SaaS 產品或 B2B 產品經驗',
      benefits: '彈性上下班、每週兩天遠端、年度學習補助 NT$ 20,000、員工旅遊、三節獎金。',
      tags: ['React', 'TypeScript', 'SaaS', '混合辦公'],
      salaryMin: 75000,
      salaryMax: 110000,
      salaryNote: '',
      published: true,
      createdDaysAgo: 12,
      updatedDaysAgo: 1,
      views: 1840,
    }),
    job({
      id: 'job_backend',
      employerId: 'u_dean',
      title: '後端工程師（Node.js）',
      category: 'tech',
      employmentType: 'full-time',
      location: '台北市信義區',
      description:
        '負責雲杉資料平台的 API、資料處理流程與雲端部署。你將與前端、資料工程團隊合作，把大量企業資料轉換成穩定、可查詢的產品功能。\n\n我們使用 TypeScript、PostgreSQL、Redis 與 AWS，重視自動化測試與可觀測性。',
      requirements:
        '必要條件：\n- 3 年以上後端開發經驗\n- 熟悉 Node.js／TypeScript 或 Go\n- 熟悉關聯式資料庫設計與效能調校\n- 具備 Docker 與 CI/CD 實務經驗\n\n加分條件：\n- 有資料處理或 ETL 經驗\n- 熟悉 AWS、觀測性工具或 Kubernetes',
      benefits: '遠端工作補助、健康檢查、團體保險、技術書籍與課程補助。',
      tags: ['Node.js', 'PostgreSQL', 'AWS', 'Backend'],
      salaryMin: 68000,
      salaryMax: 95000,
      salaryNote: '',
      published: true,
      createdDaysAgo: 9,
      updatedDaysAgo: 2,
      views: 960,
    }),
    job({
      id: 'job_pm',
      employerId: 'u_dean',
      title: '產品經理（資料平台）',
      category: 'operations',
      employmentType: 'full-time',
      location: '台北市信義區（可遠端）',
      description:
        '你將負責企業資料平台的功能規劃，從客戶訪談、需求整理、優先級排序到上線後的成效追蹤。這個角色需要與業務、設計、工程密切合作，把模糊的問題拆成可交付的計畫。',
      requirements:
        '必要條件：\n- 3 年以上產品管理經驗\n- 能獨立進行使用者訪談與需求分析\n- 熟悉 Agile／Scrum 協作模式\n- 具備良好的書面與口頭溝通能力\n\n加分條件：\n- 有 B2B SaaS 或資料產品經驗\n- 熟悉 SQL 與基本數據分析',
      benefits: '彈性工時、遠端津貼、年度績效獎金、學習補助。',
      tags: ['Product', 'B2B', 'SaaS', 'Agile'],
      salaryMin: 70000,
      salaryMax: 100000,
      salaryNote: '',
      published: true,
      createdDaysAgo: 6,
      updatedDaysAgo: 3,
      views: 620,
    }),
    job({
      id: 'job_uiux',
      employerId: 'u_mira',
      title: 'UI/UX 設計師',
      category: 'design',
      employmentType: 'full-time',
      location: '台中市西區',
      description:
        '海灣設計正在尋找能同時思考體驗與視覺的設計師，參與品牌網站、行動服務與內部工具的設計。你會從研究、資訊架構、線框圖一路做到高保真原型與設計交付。\n\n我們相信好的設計來自理解脈絡，而不是堆疊元件。團隊每週有設計分享，也會一起做使用者測試。',
      requirements:
        '必要條件：\n- 2 年以上 UI/UX 設計經驗\n- 熟悉 Figma、設計系統與原型工具\n- 能獨立完成使用者研究與易用性測試\n- 具備作品集，能說明設計決策\n\n加分條件：\n- 有設計顧問或接案經驗\n- 了解前端實作限制',
      benefits: '週休二日、彈性上班、作品集拍攝補助、員工聚餐與設計年會補助。',
      tags: ['Figma', 'UX Research', 'Design System', '台中'],
      salaryMin: 48000,
      salaryMax: 65000,
      salaryNote: '',
      published: true,
      createdDaysAgo: 8,
      updatedDaysAgo: 1,
      views: 1320,
    }),
    job({
      id: 'job_brand',
      employerId: 'u_mira',
      title: '品牌視覺設計師',
      category: 'design',
      employmentType: 'full-time',
      location: '台中市西區',
      description:
        '負責品牌識別、包裝、社群素材與空間視覺的設計。你將與策略與專案團隊合作，把品牌定位轉換成一致且有記憶點的視覺語言。',
      requirements:
        '必要條件：\n- 2 年以上品牌或平面設計經驗\n- 熟悉 Adobe Illustrator、Photoshop\n- 能獨立完成視覺提案與印刷發包\n\n加分條件：\n- 有包裝設計或空間陳列經驗\n- 具備插畫能力',
      benefits: '生日假、彈性工時、年度員工旅行、進修補助。',
      tags: ['Branding', 'Graphic', 'Packaging', 'Illustration'],
      salaryMin: 45000,
      salaryMax: 60000,
      salaryNote: '',
      published: true,
      createdDaysAgo: 20,
      updatedDaysAgo: 5,
      views: 540,
    }),
    job({
      id: 'job_marketing',
      employerId: 'u_nova',
      title: '數位行銷專員',
      category: 'marketing',
      employmentType: 'full-time',
      location: '高雄市前鎮區',
      description:
        '星圖數據正在拓展南部市場，需要一位能規劃內容、操作廣告並追蹤轉換的行銷夥伴。你會和業務與產品團隊一起設計獲客活動，並用數據驗證成效。',
      requirements:
        '必要條件：\n- 2 年以上數位行銷經驗\n- 熟悉 Google Ads、Meta Ads 與 GA4\n- 能撰寫引人入勝的產品與社群文案\n- 具備基本數據分析能力\n\n加分條件：\n- 有 B2B 或 SaaS 行銷經驗\n- 熟悉 SEO 與電子報行銷',
      benefits: '績效獎金、彈性工時、外部課程補助、每月共學日。',
      tags: ['Marketing', 'GA4', 'Content', '高雄'],
      salaryMin: 40000,
      salaryMax: 55000,
      salaryNote: '',
      published: true,
      createdDaysAgo: 4,
      updatedDaysAgo: 4,
      views: 310,
    }),
    job({
      id: 'job_data',
      employerId: 'u_nova',
      title: '資料分析師',
      category: 'tech',
      employmentType: 'full-time',
      location: '台北市中山區（可遠端）',
      description:
        '協助產品與客戶成功團隊建立指標、分析使用者行為，並把分析結果轉成可執行的產品決策。你會接觸真實的企業營運資料，設計儀表板與自動化報表。',
      requirements:
        '必要條件：\n- 2 年以上資料分析經驗\n- 熟悉 SQL 與 Python（pandas）\n- 具備視覺化工具經驗（Looker Studio、Metabase）\n- 能把分析結果說清楚給非技術夥伴聽\n\n加分條件：\n- 有 SaaS 產品分析經驗\n- 熟悉 A/B 測試與實驗設計',
      benefits: '完全遠端、年度健檢、學習補助、每季實體聚會。',
      tags: ['SQL', 'Python', 'Analytics', 'Remote'],
      salaryMin: 60000,
      salaryMax: 85000,
      salaryNote: '',
      published: true,
      createdDaysAgo: 3,
      updatedDaysAgo: 1,
      views: 480,
    }),
    job({
      id: 'job_teacher',
      employerId: 'u_admin',
      title: '兒童程式講師（兼職）',
      category: 'education',
      employmentType: 'part-time',
      location: '新竹市東區',
      description:
        '樂學教育與職光合作招募兼職講師，帶領國小中年級學生學習 Scratch 與基礎邏輯。課程教材已備妥，講師負責課堂引導、作品回饋與家長溝通。',
      requirements:
        '必要條件：\n- 熟悉 Scratch 或具備兒童教學經驗\n- 喜歡與孩子互動，有耐心\n- 週末至少可排兩個時段\n\n加分條件：\n- 有營隊或社團帶領經驗\n- 具備資訊或教育相關背景',
      benefits: '時薪制、教材與培訓免費、表現優良可轉任正職。',
      tags: ['Scratch', '教學', '兼職', '新竹'],
      salaryMin: 35000,
      salaryMax: 45000,
      salaryNote: '以時薪 NT$ 500–700 計，依排課量約 NT$ 35,000–45,000／月',
      published: true,
      createdDaysAgo: 15,
      updatedDaysAgo: 7,
      views: 270,
    }),
    job({
      id: 'job_cafe',
      employerId: 'u_mira',
      title: '門市夥伴（兼職）',
      category: 'service',
      employmentType: 'part-time',
      location: '台南市中西區',
      description:
        '海灣生活旗下咖啡門市招募兼職夥伴，負責飲品製作、顧客服務、環境整理與簡單備料。無經驗可，提供完整培訓。',
      requirements:
        '必要條件：\n- 對餐飲服務有熱情，喜歡與人互動\n- 可配合排班，每週至少 20 小時\n- 注重衛生與團隊合作\n\n加分條件：\n- 有咖啡或餐飲經驗\n- 具備基本英文溝通能力',
      benefits: '員工飲品、排班彈性、完整教育訓練、國定假日加倍。',
      tags: ['餐飲', '兼職', '無經驗可', '台南'],
      salaryMin: 30000,
      salaryMax: 36000,
      salaryNote: '時薪 NT$ 190 起，依排班量約 NT$ 30,000–36,000／月',
      published: true,
      createdDaysAgo: 5,
      updatedDaysAgo: 2,
      views: 430,
    }),
    job({
      id: 'job_intern',
      employerId: 'u_mira',
      title: '設計實習生',
      category: 'design',
      employmentType: 'internship',
      location: '台中市西區',
      description:
        '海灣設計暑期實習計畫，參與真實客戶專案的視覺研究、素材製作與設計提案。實習期間會有設計師 mentor 帶領，並安排每週學習任務。',
      requirements:
        '必要條件：\n- 設計、傳播或相關科系在學學生\n- 熟悉 Figma 或 Adobe 設計工具\n- 每週可配合 3 天，為期 3 個月\n\n加分條件：\n- 有社團、接案或競賽作品\n- 對品牌與社會議題有興趣',
      benefits: '實習津貼、mentor 制度、作品集健檢、表現優良可轉正。',
      tags: ['Internship', 'Figma', 'Design', '台中'],
      salaryMin: 28000,
      salaryMax: 32000,
      salaryNote: '按月計酬，依實際出席天數比例調整',
      published: true,
      createdDaysAgo: 2,
      updatedDaysAgo: 2,
      views: 190,
    }),
  ];

  const conversations: Conversation[] = [
    {
      id: 'conv_frontend',
      jobId: 'job_frontend',
      seekerId: 'u_lena',
      employerId: 'u_dean',
      status: 'reviewing',
      createdAt: daysAgo(4),
      updatedAt: hoursAgo(20),
      seekerReadAt: daysAgo(3),
      employerReadAt: hoursAgo(20),
    },
    {
      id: 'conv_uiux',
      jobId: 'job_uiux',
      seekerId: 'u_kai',
      employerId: 'u_mira',
      status: 'invited',
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(4),
      seekerReadAt: hoursAgo(4),
      employerReadAt: hoursAgo(3),
    },
  ];

  const messages: Message[] = [
    {
      id: 'msg_frontend_1',
      conversationId: 'conv_frontend',
      senderId: 'u_lena',
      body: '您好，我是張芯瑜，看到資深前端工程師的職缺很感興趣。我有五年 React 與 TypeScript 開發經驗，前一間公司負責建置 B2B 產品的設計系統，想了解這個職位目前的團隊組成與主要挑戰。',
      createdAt: daysAgo(4),
    },
    {
      id: 'msg_frontend_2',
      conversationId: 'conv_frontend',
      senderId: 'u_dean',
      body: '芯瑜你好，謝謝你的訊息。團隊目前有 6 位工程師、2 位設計師，接下來半年會把資料平台的前端架構重構，並建立共用元件庫。這會是這個角色最重要的任務之一。方便的話，可以分享你的作品集或 GitHub 嗎？',
      createdAt: daysAgo(3),
    },
    {
      id: 'msg_frontend_3',
      conversationId: 'conv_frontend',
      senderId: 'u_lena',
      body: '沒問題，作品集放在 https://example.com/lena ，GitHub 是 github.com/lena-dev。裡面有一個設計系統 side project，包含元件文件與視覺回歸測試，應該和你們的需求滿接近的。',
      createdAt: daysAgo(2),
    },
    {
      id: 'msg_frontend_4',
      conversationId: 'conv_frontend',
      senderId: 'u_dean',
      body: '收到了，作品集的整理方式很清楚。我們想邀請你下週來聊聊，時間可能是週二下午或週三上午，方便回覆你比較適合的時段嗎？',
      createdAt: hoursAgo(20),
    },
    {
      id: 'msg_uiux_1',
      conversationId: 'conv_uiux',
      senderId: 'u_kai',
      body: '您好，我是吳凱翔，想應徵 UI/UX 設計師。我過去三年在顧問公司做公共服務與教育產品的體驗設計，作品集裡有兩個完整的設計研究到上線案例，想了解海灣設計目前的專案類型。',
      createdAt: daysAgo(2),
    },
    {
      id: 'msg_uiux_2',
      conversationId: 'conv_uiux',
      senderId: 'u_mira',
      body: '凱翔你好，謝謝你來訊。我們目前的專案包含品牌網站、餐飲 POS 與一個新的會員服務，團隊很小但參與度很高。你的公共服務經驗對我們很有幫助，想約個時間聊聊，也想看看你怎麼做使用者訪談。',
      createdAt: daysAgo(1),
    },
    {
      id: 'msg_uiux_3',
      conversationId: 'conv_uiux',
      senderId: 'u_kai',
      body: '好的，我週四下午或週五上午都可以。作品集：https://example.com/kai ，裡面第三個案例有完整的訪談與易用性測試紀錄。',
      createdAt: hoursAgo(4),
    },
  ];

  const promotions: Promotion[] = [
    promotion('promo_frontend', 'job_frontend', 'u_dean', 'wallet', 14, 499, 2, 12, 1840, 126),
    promotion('promo_uiux', 'job_uiux', 'u_mira', 'wallet', 7, 299, 1, 6, 720, 54),
    promotion('promo_data', 'job_data', 'u_nova', 'admin', 7, 0, 1, 6, 310, 22),
  ];

  const topups: Topup[] = [
    {
      id: 'top_dean',
      userId: 'u_dean',
      amount: 1500,
      method: '信用卡（模擬）',
      createdAt: daysAgo(30),
    },
    {
      id: 'top_mira',
      userId: 'u_mira',
      amount: 800,
      method: 'ATM 轉帳（模擬）',
      createdAt: daysAgo(20),
    },
  ];

  const ledgerEntries: LedgerEntry[] = [
    ledger('led_dean_1', 'u_dean', 'topup', 1500, 1500, '錢包儲值（信用卡模擬）', 30),
    ledger('led_dean_2', 'u_dean', 'promotion', -499, 1001, '「資深前端工程師」14 天曝光', 2),
    ledger('led_mira_1', 'u_mira', 'topup', 800, 800, '錢包儲值（ATM 模擬）', 20),
    ledger('led_mira_2', 'u_mira', 'promotion', -299, 501, '「UI/UX 設計師」7 天曝光', 1),
  ];

  return { users, jobs, conversations, messages, promotions, topups, ledger: ledgerEntries };
}

/** 登入頁顯示的示範帳號。 */
export function demoAccounts(): { username: string; role: string; note: string }[] {
  return [
    { username: 'dean', role: '企業雇主', note: '雲杉科技 · 已儲值' },
    { username: 'mira', role: '企業雇主', note: '海灣設計 · 曝光中' },
    { username: 'lena', role: '求職者', note: '已應徵前端職缺' },
    { username: 'kai', role: '求職者', note: '已收到面談邀請' },
    { username: 'admin', role: '平台管理員', note: '管理職缺與曝光' },
  ];
}
