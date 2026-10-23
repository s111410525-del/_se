# NQU 校務系統（Week 7 測試示範）

以金門大學校務系統為藍圖的示範網站，包含學生、教師與教務管理員三種角色，並附上單元測試、系統測試與 Playwright E2E 測試。專案使用 TypeScript 撰寫，執行期零第三方依賴，資料存放在 JSON 檔中。

## 功能

- 登入、登出、Session、CSRF 防護與基本安全標頭
- 課程查詢、關鍵字搜尋、選課、退選、候補與自動遞補
- 學分上限、衝堂、先修條件等選課規則
- 個人課表與今日課程
- 教師輸入成績、公布成績；學生查詢成績單、GPA
- 學雜費查詢、部分繳費、一次繳清與收據
- 公告列表、搜尋、置頂、發布與刪除
- 個人資料維護
- 教務管理：開課、名額、選課開放狀態、使用者名冊、繳費總覽

## 快速開始

需求：Node.js 20 以上。

```powershell
npm install
npm start
```

開啟 <http://127.0.0.1:3000>。預設資料檔為 `data/campus.json`，第一次啟動時會自動建立種子資料。

開發時可另開一個終端機執行：

```powershell
npm run dev
```

## 測試指令

| 指令 | 說明 |
| --- | --- |
| `npm test` | 建置後執行單元測試與系統測試 |
| `npm run test:unit` | 只執行單元測試 |
| `npm run test:system` | 只執行系統測試 |
| `npm run test:coverage` | 單元＋系統測試並輸出 V8 覆蓋率 |
| `npm run test:e2e` | 建置、重置 E2E 資料，再用 Playwright 操作真實瀏覽器 |
| `npm run test:all` | 執行上述所有測試 |

E2E 預設使用本機的 Microsoft Edge（`channel: 'msedge'`），因此不需要額外下載瀏覽器。若要用 Chrome，可設定環境變數：

```powershell
$env:E2E_CHANNEL = "chrome"
npm run test:e2e
```

## 測試帳號

密碼皆為 `nqu1234`。

| 帳號 | 角色 | 姓名 |
| --- | --- | --- |
| `s001` | 學生 | 陳秉硯 |
| `s002` | 學生 | 林佩璇 |
| `s003` | 學生 | 王柏翰 |
| `s004` | 學生 | 張雅婷 |
| `s005` | 學生 | 劉承恩 |
| `tchen` | 教師 | 陳鍾誠 |
| `tlin` | 教師 | 林志豪 |
| `admin` | 管理員 | 教務處 |

## 專案結構

```text
week7/
├─ src/
│  ├─ app.ts              路由、權限與表單處理
│  ├─ server.ts           HTTP 伺服器進入點
│  ├─ config.ts           環境變數設定
│  ├─ core/               密碼、HTTP、Router、Session、驗證
│  ├─ db/                 JSON Store 與種子資料
│  ├─ services/           選課、成績、繳費、公告等商業邏輯
│  ├─ util/               HTML 轉義與格式化
│  └─ views/               SSR 頁面與元件
├─ test/
│  ├─ helpers.ts          系統測試用的伺服器與 Cookie 工具
│  ├─ unit/               單元測試（13 個檔案）
│  ├─ system/             系統測試（7 個檔案）
│  └─ e2e/                Playwright E2E（3 個檔案、4 個案例）
├─ scripts/reset-e2e.mjs  清除 E2E 資料與輸出
├─ playwright.config.ts
└─ TESTING.md             測試筆記
```

## 資料隔離

- 一般執行與系統測試使用各自的暫存資料檔，不會互相污染。
- E2E 使用 `data/e2e-campus.json`，每次 `npm run test:e2e` 前會由 `scripts/reset-e2e.mjs` 清除。
- 若要重置本機資料，停止伺服器後刪除 `data/campus.json`，下次啟動會重新產生種子資料。

## 備註

本專案的程式碼整理、測試設計與文件撰寫是在 **opencode** 協助下完成；詳細的測試分層與實作說明請見 [TESTING.md](TESTING.md)。
