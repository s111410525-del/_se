# Homework 1 — minicurl：一個類似 curl 的 HTTP 命令列工具

欄位 | 內容
-----|--------
學期 | 115 學年上學期
課程 | 現代軟體工程
教師 | [陳鍾誠](https://www.nqu.edu.tw/educsie/index.php?act=blog&code=list&ids=4)
學校 | [金門大學資訊工程系](https://www.nqu.edu.tw/educsie/index.php)
學生 | 陳秉硯
學號 | 25

## 一、專案簡介

**minicurl** 是一個用 TypeScript 撰寫、模仿 `curl` 行為的 HTTP 命令列工具。
它不依賴任何第三方 HTTP 函式庫，只使用 Node.js 內建的 `http` / `https` / `tls` / `zlib`
模組來完成請求，因此可以完整掌控標頭順序、重新導向、壓縮、Cookie 與輸出格式等細節。

> **AI 協助聲明**：本專案在 [opencode](https://opencode.ai) 的協助下完成。
> 開發過程中使用 opencode 進行程式骨架設計、TypeScript 型別除錯、測試案例撰寫與文件整理。
> 所有程式碼皆經由作者閱讀、編譯、執行測試後確認行為正確。

## 二、功能列表

### 請求（Request）
| 選項 | 說明 |
|------|------|
| `-X, --request <method>` | 指定 HTTP 方法；未指定時依資料自動推斷（有資料 → POST） |
| `-I, --head` | 使用 HEAD 方法，只取回應標頭 |
| `--url <url>` | 指定 URL，可取代結尾的位置參數 |
| `-G, --get` | 將資料改放到 query string，並使用 GET |
| `--json <data>` | 送出 JSON 內文，自動加上 `Content-Type` 與 `Accept` |

### 標頭（Headers）
| 選項 | 說明 |
|------|------|
| `-H, --header <header>` | 自訂標頭，可重複；`Name:` 移除標頭、`Name;` 送出空值 |
| `-A, --user-agent <name>` | 設定 User-Agent |
| `-e, --referer <url>` | 設定 Referer |
| `-u, --user <user[:pass]>` | 送出 HTTP Basic 認證 |
| `-b, --cookie <data>` | 送出 Cookie |
| `-c, --cookie-jar <file>` | 將收到的 Cookie 寫入 Netscape 格式的檔案 |

### 資料（Data）
| 選項 | 說明 |
|------|------|
| `-d, --data <data>` | POST 資料；`@file` 讀檔、`@-` 讀 stdin，多個 `-d` 以 `&` 串接 |
| `--data-raw` / `--data-binary` | 不處理 `@` 前綴 / 保留原始內容 |
| `--data-urlencode` | 支援 curl 的六種 URL 編碼形式 |
| `-F, --form` / `--form-string` | 送出 `multipart/form-data`，`@file` 為檔案上傳 |
| `-T, --upload-file <file>` | 以 PUT/POST 上傳檔案 |

### 輸出（Output）
| 選項 | 說明 |
|------|------|
| `-o, --output <file>` | 輸出到檔案 |
| `-O, --remote-name` / `--remote-header-name` | 檔名取自 URL / `Content-Disposition` |
| `-D, --dump-header <file>` | 將回應標頭寫入檔案 |
| `-i, --include` | 輸出中包含回應標頭 |
| `--no-body` | 不輸出回應主體 |
| `-a, --append` | 附加而非覆寫輸出檔 |
| `-w, --write-out <format>` | 以 `%{http_code}` 等變數輸出統計資訊（支援 `\n`、`\t` 轉義） |
| `-s, -S, -v, -#` | 靜默 / 顯示錯誤 / 詳細模式 / 進度條 |
| `--trace-ascii <file>` | 將診斷輸出寫入檔案 |

### 網路（Network）
| 選項 | 說明 |
|------|------|
| `-L, --location` / `--max-redirs <n>` | 跟隨重新導向，並限制次數 |
| `-k, --insecure` | 略過 TLS 憑證驗證 |
| `-m, --max-time` / `--connect-timeout` | 整體 / 連線逾時 |
| `--retry <n>` / `--retry-delay <sec>` | 暫時性錯誤的自動重試（指數退避） |
| `-x, --proxy <spec>` | HTTP proxy（HTTPS 目標會建立 CONNECT 隧道） |
| `-C, --continue-at <off\|->` | 續傳 |
| `--compressed` | 送出 `Accept-Encoding` 並自動解壓縮（gzip / deflate / br / zstd） |

### 其他
| 選項 | 說明 |
|------|------|
| `--config <file>` | 從檔案讀取選項（支援 `#` 註解與引號） |
| `-h, --help` / `-V, --version` | 說明 / 版本 |

## 三、環境需求與安裝

- Node.js **>= 20**（開發與測試使用 Node.js 24）
- 無執行期第三方相依套件

```bash
cd Homework1
npm install          # 安裝 TypeScript 等開發相依套件
npm run build        # 將 src/ 編譯到 dist/
node dist/src/cli.js --help
```

可將 `minicurl` 加入 npm link 後直接使用：

```bash
npm link
minicurl --version
```

## 四、使用範例

```bash
# 1. 最簡單的 GET
minicurl https://example.com

# 2. 送出 JSON
minicurl --json '{"name":"minicurl"}' https://httpbin.org/post

# 3. 自訂標頭與 POST 表單資料
minicurl -X POST -H "X-Token: abc123" -d "user=alice&pw=secret" https://httpbin.org/post

# 4. multipart 上傳檔案
minicurl -F "file=@report.pdf" -F "title=報告" https://httpbin.org/post

# 5. 跟隨重新導向並把結果存檔
minicurl -L -O https://example.com/archive.tar.gz

# 6. 只看標頭並輸出統計資訊
minicurl -sS -I -w "http_code=%{http_code} time=%{time_total}s\n" https://example.com

# 7. 使用 Cookie jar
minicurl -c cookies.txt https://httpbin.org/cookies/set?session=42
minicurl -b cookies.txt https://httpbin.org/cookies

# 8. 從設定檔讀取常用選項
minicurl --config .mycurlrc.example https://example.com
```

## 五、專案結構

```
Homework1/
├── src/
│   ├── cli.ts        # 命令列進入點、exit code 對應、錯誤處理
│   ├── args.ts       # 參數解析器（短/長選項、叢集、設定檔）
│   ├── request.ts    # HTTP 引擎：送請求、重新導向、重試、壓縮
│   ├── url.ts        # URL 正規化、標頭工具、檔案名稱推導
│   ├── body.ts       # 請求內文：表單、multipart、JSON、Cookie
│   ├── output.ts     # 輸出：檔案、標頭、進度條、-w 格式化
│   ├── proxy.ts      # HTTP proxy 與 CONNECT 隧道
│   ├── trace.ts      # -v / --trace-ascii 診斷輸出
│   └── types.ts      # 共用型別
├── test/
│   ├── helpers.ts       # 測試用本機 HTTP 伺服器與輸出擷取
│   ├── args.test.ts     # 參數解析單元測試
│   └── http.test.ts     # 端對端 HTTP 行為測試
├── .mycurlrc.example # 設定檔範例
├── README.md         # 本文件
├── REPORT.md         # 作業報告
├── package.json
└── tsconfig.json
```

## 六、測試

```bash
npm run typecheck   # TypeScript 嚴格模式型別檢查
npm test            # 先編譯，再以 node:test 執行 56 個測試
```

測試內容涵蓋：參數解析、請求方法推斷、自訂標頭、表單與 multipart 上傳、
重新導向、Cookie、gzip 解壓縮、重試、輸出檔案、`-w` 格式化，
以及各種錯誤情境的 exit code。

## 七、AI 協助（opencode）說明

依課程要求，在此明確標註本作業使用 AI 工具協助：

- **使用工具**：opencode（CLI 形式的 AI 程式開發代理）
- **協助範圍**：
  1. 專案架構規劃與 TypeScript 專案骨架產生
  2. HTTP 請求引擎、重新導向與重試邏輯的初稿
  3. TypeScript 嚴格模式下的型別錯誤修正
  4. 單元測試與端對端測試案例的撰寫
  5. README 與報告文件的整理
- **作者責任**：所有程式碼均由作者逐行檢視，並實際執行
  `npm run typecheck` 與 `npm test`（56 項全部通過）驗證行為，
  確認符合 curl 的預期語意後才納入作業。

更完整的設計說明與開發歷程請見 [REPORT.md](./REPORT.md)。
