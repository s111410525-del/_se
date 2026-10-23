# 測試筆記

這份筆記說明本專案為什麼要分三種測試、每一層實際測了什麼、如何執行，以及目前的結果。本專案的程式碼整理、測試產生與除錯是在 **opencode** 協助下完成，所有測試案例皆已實際執行並通過。

## 一、三種測試有什麼不同

| 層級 | 測試範圍 | 啟動什麼 | 速度 | 本專案工具 |
| --- | --- | --- | --- | --- |
| 單元測試 | 單一函式或服務，不經過 HTTP | 不需要伺服器 | 最快 | `node:test` + `node:assert` |
| 系統測試 | 真實 HTTP 伺服器與多個模組整合 | 伺服器、暫存資料檔、Cookie | 中等 | `node:test` + `fetch` |
| E2E 測試 | 真實瀏覽器操作完整使用者流程 | 伺服器 + Edge/Chrome | 最慢 | Playwright |

三層測試不是互相取代，而是互補：

- 單元測試最容易定位錯誤，適合把邊界條件測滿。
- 系統測試確認路由、權限、Session、CSRF、Service 與 Store 串起來是對的。
- E2E 確認使用者真的能在瀏覽器完成任務，包含 HTML 表單、重新導向與 JavaScript 行為。

## 二、單元測試

位置：`test/unit/`，共 13 個檔案、166 個案例。

每個測試都先透過 `test/unit/helpers.ts` 的 `freshDb()` 取得一份全新的種子資料，再直接呼叫 `src/services`、`src/core` 或 `src/util` 的函式。這層不啟動伺服器，也不寫入正式資料檔。

涵蓋內容：

- `accounts.test.ts`：帳號查詢、角色判斷、個人資料更新與驗證
- `password.test.ts`：scrypt 雜湊、鹽、錯誤密碼
- `validate.test.ts`：文字、整數、選項與格式驗證
- `router.test.ts`：靜態路由、參數路由、404/405、尾端斜線
- `session.test.ts`：Session 建立、滑動到期、過期、輪替、flash
- `store.test.ts`：JSON 載入、寫檔、重載、損毀退回種子、reset
- `courses.test.ts`：課程查詢、篩選、名額統計
- `enrollment.test.ts`：選課、退選、候補、遞補、衝堂、先修、學分上限
- `schedule.test.ts`：課表格位、今日課程、學期標籤
- `grades.test.ts`：加權分數、等第、GPA、成績單、權限、公布狀態
- `fees.test.ts`：金額計算、繳費狀態、部分繳費、合法金額、收據
- `notices.test.ts`：公告查詢、排序、搜尋、置頂、新增與刪除
- `html.test.ts`：HTML 轉義、屬性、日期/金額/分數格式化、關鍵字切割

## 三、系統測試

位置：`test/system/`，共 7 個檔案、64 個案例。

`test/helpers.ts` 會啟動一個真正的 HTTP 伺服器（使用隨機埠與暫存資料檔），並提供帶 Cookie jar 的 `Browser`。測試透過 `fetch` 送出表單，取得 CSRF 權杖後完成登入與後續操作，最後關閉伺服器並刪除暫存檔。

涵蓋流程：

- `auth.test.ts`：未登入導向、登入/登出、錯誤密碼、CSRF、角色權限
- `enrollment.test.ts`：選課、重複選課、衝堂、先修、候補、退選遞補、學分上限
- `fees.test.ts`：繳費頁、部分繳費、金額驗證、繳清、權限
- `grades.test.ts`：教師輸入成績、公布、學生 GPA 即時更新、未公布不可見
- `admin.test.ts`：開課、名額、選課開放、公告置頂/刪除、名冊與 API 權限
- `profile-notices.test.ts`：公告瀏覽與搜尋、個人資料更新與格式錯誤
- `http.test.ts`：健康檢查、靜態資源快取、安全標頭、Cookie 屬性、404/405

## 四、E2E 測試

位置：`test/e2e/`，共 3 個檔案、4 個案例，使用 Playwright 操作真實瀏覽器。

- `student-flow.spec.ts`
  1. `s001` 登入。
  2. 到課程查詢搜尋 `CS399`。
  3. 到選課頁加選 `CS399`，確認 flash 訊息與「正取」狀態。
  4. 到課表頁確認課程出現。
  5. 到成績頁確認 `CS101` 與「尚未公布」。
  6. 到繳費頁按「確認繳費」，確認繳費成功與紀錄。
  7. 登出回到登入頁。
- `admin-flow.spec.ts`
  1. 管理員新增 `E2E101` 課程，確認列表與課程查詢都看得到。
  2. 發布置頂公告，確認排在最前面。
  3. 取消置頂，確認 flash 與按鈕狀態。
  4. 接受瀏覽器確認對話框後刪除公告，確認列表不再出現。
- `teacher-flow.spec.ts`
  1. `tchen` 登入並進入 `CS101` 成績管理。
  2. 編輯 `劉承恩` 的成績：88（權重 40）、92（權重 60）。
  3. 確認加權總分 `90.4`，儲存後公布。
  4. 登出後以 `s005` 登入，確認成績頁可看到 `90.4` 與等第 `A`。

E2E 使用 `data/e2e-campus.json`，並在每次執行前由 `scripts/reset-e2e.mjs` 清除，避免測試互相影響。Playwright 設定 `workers: 1`，讓共享同一份資料檔的案例依序執行。

## 五、如何執行

```powershell
npm install
npm run build
npm test              # 單元 + 系統
npm run test:coverage # 單元 + 系統 + 覆蓋率
npm run test:e2e      # Playwright E2E
npm run test:all      # 全部
```

E2E 預設使用本機 Edge；若環境沒有 Edge，可改用 Chrome：

```powershell
$env:E2E_CHANNEL = "chrome"
npm run test:e2e
```

## 六、實際結果

執行環境：Windows、Node.js `v24.14.0`、npm `11.9.0`。

| 項目 | 結果 |
| --- | --- |
| 單元測試 | 166 / 166 通過 |
| 系統測試 | 64 / 64 通過 |
| E2E 測試 | 4 / 4 通過 |
| 合計 | 234 個案例全數通過 |

`npm run test:coverage` 的 V8 覆蓋率（單元＋系統，不含 E2E）：

| 指標 | 數值 |
| --- | --- |
| 行覆蓋率 | 89.41% |
| 分支覆蓋率 | 82.89% |
| 函式覆蓋率 | 94.05% |

覆蓋率較低的主要是 `src/views/pages/schedule.ts`、`courses.ts`、`dashboard.ts` 等頁面樣板；這些頁面主要由 E2E 與系統測試以「頁面是否正確呈現」的方式驗證，而不是逐行呼叫。

## 七、測試過程中發現並修正的問題

1. **一次繳清會失敗**：`pay()` 原本要求金額必須是 100 的倍數，但學雜費總額 `16050` 不是 100 的倍數，導致「一次繳清」永遠被拒絕。改為只驗證正整數與 `acceptableAmounts`（必須對應完整項目），並同步調整單元與系統測試。
2. **公告置頂沒有回饋訊息**：切換置頂後直接重新導向，使用者看不到結果。補上 `已更新公告置頂狀態。` 的 flash 訊息，E2E 也以此驗證。
3. **關鍵字切割不支援頓號**：先修條件常寫成 `CS201、CS210`，原本只支援空白與逗號。`splitTokens` 加入 `、` 後，管理員開課與課程查詢都能正確解析。
4. **HTML 重複 ID**：公告頁的篩選表單與新增表單都有 `id="f_category"`。E2E 改用表單範圍定位，避免 strict mode 誤選；這也是後續可改進的無障礙議題。
5. **測試自身的錯誤**：個人資料測試重複讀取同一個 `Response` body，導致 `Body is unusable`；改為先取出 HTML 字串再斷言。
6. **測試資料不足**：候補測試的合成學生沒有先修成績，無法進入候補流程；補上一筆已公布的 `CS100` 成績後，才能正確驗證候補順位。

## 八、測試資料策略

- 單元測試：每個案例都複製一份全新的種子資料，修改只在記憶體中，不落地。
- 系統測試：每個 `describe` 啟動獨立伺服器與暫存 JSON 檔，`after` 時關閉並刪除。
- E2E：固定使用 `data/e2e-campus.json`，執行前重置，案例之間依賴順序由 `workers: 1` 控制。
- 所有測試帳號密碼皆為 `nqu1234`，僅供本機示範使用。

## 九、後續可以再加強的地方

- 補齊 `views/pages` 的單元測試，拉高行覆蓋率。
- 為手機版版面與無障礙標籤增加 E2E 檢查。
- 將公告篩選表單的 `id` 改為唯一值，修正重複 ID。
- 在 CI 上分別執行 unit、system、E2E，並保存 Playwright trace 與覆蓋率報告。

## 十、關於 opencode

本專案使用 **opencode** 協助：

- 規劃測試金字塔與檔案結構。
- 產生單元、系統與 E2E 測試案例。
- 實際執行建置與測試，解讀失敗訊息並修正程式或測試。
- 整理這份測試筆記與 README。

所有修正都經過實際測試驗證；最終結果為 234 個案例全數通過。
