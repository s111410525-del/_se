# minicurl 作業報告

## 1. 動機與目標

`curl` 是軟體工程中最常用的命令列工具之一。它看似只是「抓一個網址」，
但實際上要正確處理 HTTP 的細節並不容易：標頭順序與重複、方法的自動推斷、
重新導向時方法與內文的保留規則、`Content-Encoding` 解壓縮、Cookie 往返、
multipart 上傳、逾時與重試、以及和 curl 相容的離開代碼。

本作業的目標是**用 TypeScript 從零打造一個行為對齊 curl 的工具**，
藉此理解 HTTP 協定與命令列程式設計的實務細節。為了忠實呈現 curl 的行為，
本專案刻意**不使用** `fetch` 或 `axios` 等抽象層，而是直接使用 Node.js 的
`http`、`https`、`tls`、`zlib` 模組。

## 2. 系統架構

```
命令列 argv
   │
   ▼
┌──────────────┐   展開 --config、拆解短/長選項
│   args.ts    │──────────────────────────────┐
└──────────────┘                              │
   │ Options 物件                             │
   ▼                                          ▼
┌──────────────┐  組內文（form/json/file）  ┌──────────────┐
│  body.ts     │◄───────────────────────────│              │
└──────────────┘                            │  cli.ts      │
   │                                        │  （流程控制）│
   ▼                                        └──────────────┘
┌──────────────┐  送請求、重導向、重試          │
│ request.ts   │──────────────────────────────┘
└──────────────┘
   │ TransferResult
   ▼
┌──────────────┐
│  output.ts   │  檔案 / stdout / -w / 進度條
└──────────────┘
```

### 模組職責

| 模組 | 職責 |
|------|------|
| `args.ts` | 解析命令列為 `Options`；處理選項叢集、內嵌值、`--config` 展開、`@file` 讀取 |
| `request.ts` | 建立並送出請求；重新導向迴圈；`--retry` 指數退避；壓縮解碼；逾時 |
| `url.ts` | URL 正規化、Host 標頭、標頭查詢、`Content-Disposition` 檔名解析 |
| `body.ts` | `application/x-www-form-urlencoded`、`multipart/form-data`、JSON、Cookie jar |
| `output.ts` | 輸出目標解析（`-o`/`-O`/`-J`）、進度條、`-w` 變數替換、`-D`/`-c` 檔案寫入 |
| `proxy.ts` | Proxy 規格解析、HTTPS CONNECT 隧道 |
| `trace.ts` | `-v` 與 `--trace-ascii` 的診斷輸出，並遮蔽授權類標頭 |
| `cli.ts` | 串接流程、錯誤處理、curl 相容的 exit code |

## 3. 值得說明的設計決策

### 3.1 不使用 `fetch`

Node 的 `fetch` 會自動解壓縮、自動跟隨重新導向、正規化標頭，這些都與 curl
「由使用者控制」的哲學衝突。改用 `http.request` 之後，才能：

- 精確比對 curl 的 verbose 輸出（`> GET / HTTP/1.1`）。
- 自行決定何時跟隨 `3xx`，以及重導向時是否保留方法與內文。
- 只在 `--compressed` 時才送 `Accept-Encoding` 並解壓縮。

### 3.2 方法推斷（method inference）

curl 的規則是：有 `-d`/`-F`/`-T` 時預設用 `POST`，`-I` 用 `HEAD`，否則 `GET`。
實作於 `request.ts` 的 `inferMethod()`，並讓 `-X` 有最高優先權。

### 3.3 重新導向的方法語意

依 RFC 7231 / 9110：

| 狀態碼 | 行為 |
|--------|------|
| 303 | 一律改成 `GET` |
| 301 / 302 | 若原方法為 `POST` 則改成 `GET` |
| 307 / 308 | 保留原方法與內文 |

實作時於轉為 `GET`/`HEAD` 後一併移除 `Content-Length` 與 `Content-Type`，
避免送出不一致的請求。

### 3.4 參數解析器

自行手寫解析器而非使用 `commander` / `yargs`，因為：

- curl 的短選項可以**叢集**（`-sSLv`）也能**內嵌值**（`-XPOST`）。
- 同一個選項可重複（`-d a -d b`、`-H A: 1 -H B: 2`），需保留出現順序。
- 需要區分「後出現覆蓋先出現」（如 `-X`）與「全部保留」（如 `-H`）。

解析器先以 `tokenize()` 產生 `{ values: Map, booleans: Set, urls }`，
`--config` 檔案内容會被展開並插到命令列前面，使命令列選項能覆蓋設定檔。

### 3.5 進度條與輸出分離

curl 把進度條印在 stderr、主體印在 stdout，因此可以 `minicurl url > file`。
本專案遵循相同慣例；`-o` 指定檔案時主體不進 stdout。

### 3.6 安全預設

- `-v` 輸出時以 `<hidden>` 遮蔽 `Authorization` / `Cookie` / `Set-Cookie`。
- 憑證驗證預設開啟，`-k` 才關閉。

## 4. 測試策略

### 4.1 測試框架

使用 Node.js 內建的 `node:test` 與 `node:assert`，不引入外部測試框架，
保持與「零執行期相依」一致的輕量風格。

### 4.2 測試分層

1. **單元測試 `test/args.test.ts`（20 項）**
   直接呼叫 `parseArgs()`，驗證選項解析、覆蓋規則、`@file`、
   `--data-urlencode`、設定檔等。

2. **端對端測試 `test/http.test.ts`（36 項）**
   啟動一個本機 `http.Server`（`test/helpers.ts`），再用 `run()` 執行
   完整流程，涵蓋：GET/POST/PUT/HEAD、標頭、表單、multipart 上傳、
   `-o`/`-O`/`-J`/`-D`、重新導向、Cookie jar、gzip、重試、
   各種錯誤的 exit code、`-v` 與 `-s`。

### 4.3 驗證指令

```bash
npm run typecheck   # 嚴格模式型別檢查
npm test            # 56 tests, 56 pass
```

## 5. 使用 opencode 協助的歷程

本專案使用 **opencode** 作為 AI 協作工具。實際的分工如下：

| 階段 | opencode 的協助 | 作者負責的部分 |
|------|----------------|----------------|
| 規劃 | 提出模組切分與 curl 功能對照表 | 決定功能範圍（核心功能）與檔案位置 |
| 實作 | 產生各模組初稿與型別定義 | 閱讀程式碼、修正行為、確認語意 |
| 除錯 | 指出 TypeScript 嚴格模式的型別錯誤 | 執行 `tsc` 驗證、調整設計 |
| 測試 | 撰寫 `node:test` 測試案例與本機測試伺服器 | 檢視測試是否真的驗證行為 |
| 文件 | 整理 README 與本報告 | 確認内容正確並補上說明 |

開發過程中曾遇到並修正的問題包括：

1. **`HELP_TEXT` 內含反引號** 導致模板字串提前結束 → 改用中文引號。
2. **PowerShell `Set-Content` 以非 UTF-8 寫檔**造成中文註解損毀
   → 重寫檔案並改用支援 UTF-8 的編輯工具。
3. **`-H "Name:"` 的移除語意**：初版會送出空值標頭，經測試發現後
   改為 `''` 代表移除、`';'` 代表送出空值標頭。
4. **`-I` 沒有輸出**：`writeBody()` 初版直接因 `head` 而 return，
   遺漏了 curl 會把標頭印到 stdout 的行為。
5. **`--max-redirs 0` 的邊界**：需在跟隨前檢查次數，才能正確回傳 exit code 47。

這些問題都是**先由測試失敗浮現，再由作者判斷正確行為後修正**，
AI 扮演的是加速草稿與除錯的角色，最終正確性由測試把關。

## 6. 結論與未來改進

`minicurl` 以約 1500 行 TypeScript 實作了 curl 的核心子集，
並以 56 項自動化測試確保行為。過程中對 HTTP 的重新導向語意、壓縮協商、
multipart 格式與命令列設計有了更紮實的理解。

未來可延伸的方向：

- HTTP/2 與多檔並行下載。
- 完整的 cookie 屬性（domain / path / expires）支援。
- `--limit-rate` 限速與更大規模的進度顯示。
- 以 `--resolve`、`--interface` 等選項支援更細緻的網路控制。

## 7. 參考資料

- [curl 官方文件](https://curl.se/docs/manpage.html)
- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [Node.js HTTP 模組文件](https://nodejs.org/api/http.html)
- [Node.js Test Runner](https://nodejs.org/api/test.html)
