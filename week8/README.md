# 墨流 InkFlow（Week 8 作品平台）

讓創作者連載小說與漫畫的文學作品投稿平台。註冊後即可開設創作空間、上傳作品與章節；付費帳號還能開通閱讀收益、打賞分潤與系統推流。平台端提供精選、推流與撥款審核後台。

本專案使用 TypeScript 與 Node.js 內建模組撰寫，採 SSR 與 JSON 檔案儲存，執行時不需要任何第三方套件。

## 功能

- 帳號註冊、登入、登出、個人資料維護與免費／付費方案切換
- 作品建立、編輯、公開／取消公開、章節新增／編輯／刪除
- 小說與漫畫分類、標籤、關鍵字搜尋、多種排序
- 作品閱讀頁、閱讀計次、收藏、留言與打賞
- 付費創作者收益明細、可提領餘額與提領申請
- 首頁系統推流區、精選作品與推薦／熱門／最新排行
- 管理員精選作品、替作品開啟 14 天推流、審核撥款與使用者列表
- Session、CSRF 驗證、角色權限、登入失敗鎖定與 JSON 原子寫入

## 快速開始

需求：Node.js 20 以上。

```powershell
npm install
npm start
```

開啟 <http://127.0.0.1:3000>。第一次啟動會自動建立 `data/inkflow.json` 與示範資料。

開發時可以讓 TypeScript 持續編譯，再另開一個終端執行伺服器：

```powershell
npm run dev
node dist/src/server.js
```

## 示範帳號

密碼皆為 `ink1234`。

| 帳號 | 角色 | 方案 | 說明 |
| --- | --- | --- | --- |
| `aurora` | 創作者 | 付費 | 有作品、收益、進行中的推流與一筆審核中提領 |
| `quill` | 創作者 | 付費 | 有作品收益與已撥款紀錄，適合測試提領 |
| `inkcat` | 創作者 | 免費 | 可投稿，但作品不能收打賞、不產生閱讀收益 |
| `reader` | 創作者 | 免費 | 一般讀者，適合測試收藏、留言與打賞 |
| `novice` | 創作者 | 免費 | 新作者，有一部短篇作品 |
| `admin` | 管理員 | 付費 | 可進入平台管理後台 |

## 收益與推流規則

- 閱讀收益：付費創作者的作品每被閱讀一章可得 NT$ 0.02；作者閱讀自己的作品不計，匿名讀者則照常計入。
- 打賞：單筆 NT$ 10～5000 的整數，創作者分得 90%，平台保留 10%。免費帳號的作品與自我打賞都會被拒絕。
- 提領：僅限付費帳號，單筆至少 NT$ 100，不可超過可提領餘額，且同時只能有一筆審核中的申請。
- 方案推流：付費創作者每次公開作品時自動建立 7 天推流；已有進行中的推流不會重複建立。
- 管理員推流：可替任何作品建立 14 天推流，不受方案限制。
- 推流效果：首頁「系統推流」會展示進行中的作品，推薦分數提高；首頁曝光會累計曝光數，從 `?ref=promo` 點進作品會累計點擊數。

## 路由總覽

| 區域 | 路徑 |
| --- | --- |
| 公開 | `/`、`/works`、`/works/:id`、`/works/:id/chapters/:chapterId`、`/creators/:id`、`/library`、`/health` |
| 帳號 | `/login`、`/register`、`/logout`、`/profile`、`/account/plan` |
| 創作中心 | `/studio`、`/studio/works/new`、`/studio/works/:id`、`/studio/works/:id/edit`、`/studio/works/:id/chapters/...`、`/studio/earnings`、`/studio/withdraw` |
| 互動 | `/works/:id/bookmark`、`/works/:id/comments`、`/works/:id/comments/:commentId/delete`、`/works/:id/tip` |
| 管理 | `/admin`、`/admin/works`、`/admin/users`、`/admin/payouts` |

所有 POST 表單都需要帶 CSRF 權杖；需要登入或特定角色的路由會自動檢查權限。

## 測試

```powershell
npm test                # 建置後執行單元測試與系統測試
npm run test:unit       # 只跑單元測試
npm run test:system     # 只跑系統測試
npm run test:coverage   # 加上 V8 覆蓋率輸出
```

- 單元測試涵蓋收益分潤、閱讀計次、提領規則、推流建立、排行計分、作品權限、章節編號與表單驗證。
- 系統測試會啟動真實 HTTP 伺服器，使用暫存資料檔與 Cookie 模擬瀏覽器，涵蓋註冊登入、CSRF、方案升級、作品建立、閱讀收益、打賞、提領與管理後台。
- 測試資料一律寫入系統暫存目錄，不會污染 `data/inkflow.json`。

## 專案結構

```text
week8/
├─ src/
│  ├─ app.ts              應用程式組裝、請求內容與路由分派
│  ├─ server.ts           HTTP 伺服器進入點
│  ├─ config.ts           環境變數設定
│  ├─ types.ts            領域型別與收益常數
│  ├─ core/               密碼、Session、HTTP、Router、驗證與錯誤
│  ├─ db/                 JSON Store 與示範資料
│  ├─ services/           帳號、作品、收益、推流、排行與互動邏輯
│  ├─ routes/             公開、帳號、創作中心、互動與管理路由
│  ├─ views/              SSR 版面、元件與頁面
│  └─ util/               HTML 轉義、格式化與 ID 工具
├─ test/
│  ├─ helpers.ts          HTTP 測試伺服器與 Cookie 工具
│  ├─ unit/               單元測試
│  └─ system/             系統測試
├─ data/inkflow.json      第一次啟動後自動建立的資料檔
└─ README.md
```

## 資料與環境變數

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `PORT` | `3000` | 伺服器埠號 |
| `HOST` | `127.0.0.1` | 監聽位址 |
| `INKFLOW_DATA` | `data/inkflow.json` | JSON 資料檔路徑 |
| `SESSION_TTL_MS` | `28800000` | 工作階段存活時間（8 小時） |
| `LOGIN_MAX_FAILURES` | `5` | 連續登入失敗幾次後鎖定 |
| `LOGIN_LOCKOUT_MS` | `300000` | 登入鎖定時間（5 分鐘） |

想重置示範資料時，停止伺服器後刪除 `data/inkflow.json`，下次啟動會重新建立種子資料。

## 備註

本專案是課程示範平台，金流、方案升級與撥款皆為模擬流程，不會產生真實交易。Session 存在記憶體中，伺服器重啟後需要重新登入。

本專案使用 **opencode** 協助完成程式開發、測試與文件撰寫。
