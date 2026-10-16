# Docker 微服務系統實作 — 作業與學習記錄

> 用 Docker / Docker Compose 建置一個由 **Nginx + Node.js + Python + PostgreSQL** 組成的微服務系統，並附上一個展示用的簡易 Web 介面。

---

## 目錄

- [1. 專案簡介](#1-專案簡介)
- [2. 系統架構](#2-系統架構)
- [3. 目錄結構](#3-目錄結構)
- [4. 快速開始](#4-快速開始)
- [5. 微服務說明](#5-微服務說明)
- [6. Docker 核心概念筆記](#6-docker-核心概念筆記)
- [7. 關鍵設計與最佳實踐](#7-關鍵設計與最佳實踐)
- [8. API 一覽](#8-api-一覽)
- [9. 常用指令備忘錄](#9-常用指令備忘錄)
- [10. 與原始版本的改進對照](#10-與原始版本的改進對照)
- [11. 疑難排解](#11-疑難排解)
- [12. 心得與結論](#12-心得與結論)

---

## 1. 專案簡介

這是一個用來練習 Docker 的微服務範例。整個系統由四個獨立容器組成，各自負責單一職責（Single Responsibility），透過 Docker 的內部網路互相溝通，並由 Nginx 統一對外提供服務。

**學習目標**

- 理解映像檔（Image）、容器（Container）、資料卷（Volume）、網路（Network）的差異與用途
- 學會撰寫 `Dockerfile`（多階段建置、`.dockerignore`、非 root 使用者）
- 學會用 `docker-compose.yml` 編排多個服務（相依性、健康檢查、環境變數）
- 學會用 **Nginx 反向代理** 將前端與多個後端微服務整合
- 做一個能被實際操作、看到即時狀態的 Web 介面來驗證整個系統

**成果**：打開瀏覽器 `http://localhost` 就能看到一個儀表板，即時顯示四個服務的健康狀態，還能實際新增留言到 PostgreSQL、呼叫 Python 服務做文字分析。

---

## 2. 系統架構

```
                         ┌──────────────────────────────────────────────┐
                         │                  Docker Host                  │
                         │                                               │
   ┌──────────┐          │   ┌───────────────────────────────────────┐   │
   │  瀏覽器   │  :80     │   │            frontend network           │   │
   │ Browser  │ ─────────┼──▶│              ┌───────────┐            │   │
   └──────────┘          │   │              │   nginx   │            │   │
                         │   │              │  (proxy)  │            │   │
                         │   │              └─────┬─────┘            │   │
                         │   └────────────────────┼──────────────────┘   │
                         │                        │                      │
                         │   ┌────────────────────┼──────────────────┐   │
                         │   │            backend network            │   │
                         │   │        ┌───────────┴───────────┐      │   │
                         │   │        │                       │      │   │
                         │   │   ┌────▼─────┐          ┌──────▼────┐ │   │
                         │   │   │  node.js │          │  python   │ │   │
                         │   │   │   api    │          │ analyzer  │ │   │
                         │   │   │  :3000   │          │  :8000    │ │   │
                         │   │   └────┬─────┘          └───────────┘ │   │
                         │   │        │                              │   │
                         │   │   ┌────▼─────┐                        │   │
                         │   │   │ postgres │  volume: pgdata        │   │
                         │   │   │  :5432   │                        │   │
                         │   │   └──────────┘                        │   │
                         │   └───────────────────────────────────────┘   │
                         └──────────────────────────────────────────────┘
```

**請求流程**

| 路徑 | 流向 | 說明 |
| --- | --- | --- |
| `/` | Nginx → 靜態檔 | 前端網頁（HTML/CSS/JS） |
| `/api/*` | Nginx → `api:3000` | Node.js REST API（含資料庫操作） |
| `/py/*` | Nginx → `analyzer:8000` | Python 文字分析服務 |
| `/healthz` | Nginx 自己回應 | Nginx 健康檢查 |

只有 **Nginx 對外開放 port 80**，其餘服務都在 Docker 內部網路中，不會直接暴露到主機，這是一般反向代理架構的安全性做法。

---

## 3. 目錄結構

```
week6/
├── docker-compose.yml        # 整體服務編排（最重要的檔案）
├── .env                      # 實際環境變數（不進版控）
├── .env.example              # 環境變數範本
├── .gitignore
├── README.md
│
├── nginx/                    # 反向代理 + 前端靜態網頁
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx.conf            # 全域設定（gzip、log、隱藏版本號）
│   ├── conf.d/
│   │   └── default.conf      # server block：路由規則與 upstream
│   └── html/                 # 前端網頁
│       ├── index.html
│       ├── style.css
│       └── app.js
│
├── api/                      # Node.js (Express) 微服務
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
│
├── analyzer/                 # Python (FastAPI) 微服務
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   └── app.py
│
└── db/
    └── init.sql              # 資料庫初始化腳本（建表 + 種子資料）
```

---

## 4. 快速開始

### 前置需求

- 已安裝 **Docker Desktop**（Windows / macOS）或 **Docker Engine + Compose plugin**（Linux）
- 確認指令可用：

```bash
docker --version
docker compose version
```

### 步驟

```bash
# 1. 進入專案目錄
cd week6

# 2. 建立環境變數檔（首次執行）
#    Windows PowerShell:
Copy-Item .env.example .env
#    macOS / Linux:
#    cp .env.example .env

# 3. 建置映像檔
docker compose build

# 4. 啟動所有服務（背景執行）
docker compose up -d

# 5. 確認四個容器都是 healthy
docker compose ps
```

### 開啟網頁

瀏覽器打開 **<http://localhost>**，即可看到系統儀表板。

### 停止 / 清除

```bash
docker compose stop            # 停止（保留容器與資料）
docker compose down            # 停止並移除容器、網路（保留資料卷）
docker compose down -v         # 連資料卷一起刪除（重設資料庫，下次重新初始化）
```

> 服務啟動後，`depends_on` 會依照健康檢查的結果依序啟動：**db → api → analyzer → nginx**，所以你不需要手動等待資料庫。

---

## 5. 微服務說明

### 5.1 Nginx — 反向代理與靜態網頁

對外唯一的入口，負責兩件事：

1. **提供靜態前端**：`/usr/share/nginx/html` 下的 HTML/CSS/JS
2. **反向代理**：把 `/api/` 轉給 Node 服務、`/py/` 轉給 Python 服務

```nginx
upstream node_api       { server api:3000; }
upstream python_analyzer{ server analyzer:8000; }

location /api/ { proxy_pass http://node_api; }        # 保留 /api/ 前綴
location /py/  { proxy_pass http://python_analyzer/; } # 去掉 /py/ 前綴
```

> **小陷阱**：`proxy_pass` 結尾有沒有 `/` 會改變行為。
> `http://node_api`（無斜線）→ 後端收到 `/api/status`；
> `http://python_analyzer/`（有斜線）→ 後端收到 `/status` 而不是 `/py/status`。

**Dockerfile**（`nginx/Dockerfile`）把設定與網頁「烤」進映像檔，而不是用 volume 掛載。這樣映像檔本身即為可部署的完整單元，部署時不依賴主機上的檔案。

### 5.2 Node.js — 後端 API

採用 **Express + pg**，提供 REST API 並負責存取 PostgreSQL。重點設計：

- **連線池（Pool）**：重複利用連線，避免每次請求都重新連線
- **環境變數設定**： `DB_HOST`、`DB_USER`…等全部從環境變數讀取，不寫死在程式裡
- **`/api/health`**：給 Docker 做健康檢查用，會實際打一次資料庫
- **多階段建置 Dockerfile**：建置階段安裝依賴，執行階段只帶走 `node_modules` 與程式碼
- **非 root 使用者**：`USER node`，降低容器被入侵後的風險

### 5.3 Python — 文字分析服務

採用 **FastAPI + Uvicorn**，提供文字統計分析（字元數、單字數、不重複單字、常見詞彙…）。選擇 Python 的原因是要展示「不同語言的服務也能放在同一個系統裡」，這是微服務架構的一大優點。

- 使用 `python:3.12-slim` 精簡映像檔
- 同樣建立非 root 使用者（`appuser`）
- 健康檢查用 Python 內建的 `urllib`，不額外安裝 `curl`

### 5.4 PostgreSQL — 資料庫

- 使用官方 `postgres:16-alpine`
- **資料持久化**：透過具名資料卷 `pgdata` 掛載到 `/var/lib/postgresql/data`，容器刪掉資料還在
- **初始化腳本**：`./db/init.sql` 掛到 `/docker-entrypoint-initdb.d/`，容器**第一次**啟動時會自動執行，建立 `notes` 表並寫入兩筆種子資料
- 使用 `pg_isready` 作為健康檢查，確保資料庫真的能接受連線後才讓其他服務啟動

> **重要**：`init.sql` 只會在資料卷為空（全新資料庫）時執行。若修改了 `init.sql`，需要 `docker compose down -v` 清掉資料卷才會重新執行。

---

## 6. Docker 核心概念筆記

這一節記錄學習過程中對 Docker 各項概念的理解。

### 映像檔（Image） vs 容器（Container）

| | 映像檔 Image | 容器 Container |
| --- | --- | --- |
| 比喻 | 類別 / 說明書 / 光碟 | 實例 / 執行中的程式 |
| 狀態 | 唯讀、靜態 | 可執行、可寫入 |
| 產生方式 | `docker build` 或 `docker pull` | `docker run` / `docker compose up` |

映像檔是由一層一層（layer）堆疊而成的；`Dockerfile` 每一道指令就是一層。Docker 會快取沒變動的層，所以把「不常變動的指令」放前面（例如先 `COPY package.json` 再 `npm install`）可以大幅加速重複建置。

### 資料卷（Volume）

容器被刪除後，裡面的資料也會消失。要保存資料（例如資料庫）就要用 **Volume**：

```yaml
volumes:
  - pgdata:/var/lib/postgresql/data   # 具名資料卷，由 Docker 管理
```

- **具名卷（named volume）**：`pgdata:/path` → 適合資料庫，由 Docker 管理，可跨容器重複使用
- **綁定掛載（bind mount）**：`./db/init.sql:/path` → 直接把主機檔案掛進容器，適合開發時同步程式碼

### 網路（Network）

Docker Compose 會自動建立網路，**同一個網路內的容器可以用「服務名稱」當作主機名稱互相連線**。例如 Node 服務連資料庫只要寫 `host: db`，不需要知道 IP。

本專案刻意分成兩個網路：

- `frontend`：`nginx` 與 `api`、`analyzer`（提供對外）
- `backend`：`api`、`analyzer`、`db`（資料層）

Nginx 同時連接兩個網路，資料庫只存在於 `backend`，更符合分層隔離的觀念。

### 健康檢查（Healthcheck）

`docker compose ps` 顯示的 `(healthy)` 就是健康檢查的結果。它會定期在容器內執行一個指令，回傳成功（exit 0）才算健康：

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U admin -d homework_db"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s
```

搭配 `depends_on` 的 `condition: service_healthy`，可以做到「**等資料庫真正準備好，才啟動 API**」，避免經典的「後端比資料庫早啟動而連線失敗」問題。

### Dockerfile 常見指令

| 指令 | 用途 |
| --- | --- |
| `FROM` | 指定基底映像檔 |
| `WORKDIR` | 設定容器內的工作目錄 |
| `COPY` | 複製檔案進映像檔 |
| `RUN` | 建置時執行指令（如安裝套件） |
| `ENV` | 設定環境變數 |
| `EXPOSE` | 標示此容器打算監聽的埠號（僅文件用途） |
| `USER` | 切換執行身分（安全用） |
| `HEALTHCHECK` | 定義健康檢查 |
| `CMD` | 容器啟動時執行的預設指令 |

---

## 7. 關鍵設計與最佳實踐

這一節整理本專案採用的實務做法，也是相對於「能跑就好」的版本最重要的進步。

### 7.1 多階段建置（Multi-stage build）

以 `api/Dockerfile` 為例：

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./
USER node
CMD ["node", "server.js"]
```

- 只把執行需要的 `node_modules` 帶進最終映像檔，不含建置工具
- 用 `npm ci`（依據 `package-lock.json`）而非 `npm install`，確保每次建置的依賴版本一致（可重現性）

### 7.2 `.dockerignore`

避免把不該進映像檔的東西（`node_modules`、`.git`、快取）複製進去，可縮小映像檔並加快建置。

```
node_modules
.git
Dockerfile
```

### 7.3 使用 `.env` 管理設定

不要在 `docker-compose.yml` 裡寫死密碼。改用 `.env`：

```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password123}
```

`${VAR:-default}` 代表「若 `.env` 沒定義就用預設值」。`.env` 已加入 `.gitignore`，避免機密外洩。

### 7.4 非 root 使用者

Node 映像檔使用內建的 `node` 使用者，Python 映像檔則自行 `useradd`。容器預設以 root 執行，一旦被攻破影響很大，這是基本的安全強化。

### 7.5 健康檢查 + 啟動順序

四個服務都定義了 `healthcheck`，`nginx` 更是等到 `api` 與 `analyzer` 都 `healthy` 才啟動。啟動順序完全由健康狀態驅動，而不是用 `sleep` 猜時間。

### 7.6 前端不用假資料

儀表板的所有數字都是**即時**從各服務的 API 取得（見 `nginx/html/app.js`），每 5 秒更新一次。這讓「系統真的有在運作」變成看得見的事實。

### 7.7 `restart: unless-stopped`

容器若意外結束，Docker 會自動重啟（除非是你手動停止），提升系統穩定性。

---

## 8. API 一覽

所有 API 都經由 Nginx（port 80）對外提供。

### Node.js API（`/api/*`）

| 方法 | 路徑 | 說明 | 範例 |
| --- | --- | --- | --- |
| GET | `/api/health` | 健康檢查（會實際連資料庫） | `curl http://localhost/api/health` |
| GET | `/api/status` | 服務資訊 + 資料庫狀態 | `curl http://localhost/api/status` |
| GET | `/api/notes` | 取得所有留言 | `curl http://localhost/api/notes` |
| POST | `/api/notes` | 新增留言 | 見下方 |
| DELETE | `/api/notes/:id` | 刪除留言 | `curl -X DELETE http://localhost/api/notes/3` |

```bash
# 新增留言
curl -X POST http://localhost/api/notes \
     -H "Content-Type: application/json" \
     -d '{"author":"Yan","content":"Hello Docker!"}'
```

### Python API（`/py/*`）

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/py/health` | 健康檢查 |
| GET | `/py/info` | 服務資訊（Python 版本等） |
| POST | `/py/analyze` | 文字分析 |

```bash
curl -X POST http://localhost/py/analyze \
     -H "Content-Type: application/json" \
     -d '{"text":"Docker makes it easy to build microservices."}'
```

---

## 9. 常用指令備忘錄

```bash
# ── 檢視狀態 ───────────────────────────────
docker compose ps                 # 目前服務與健康狀態
docker compose top                # 各容器內執行的程序
docker stats                      # 即時 CPU / 記憶體使用量

# ── 建置與啟動 ─────────────────────────────
docker compose build              # 建置映像檔
docker compose build --no-cache   # 不使用快取，強制重新建置
docker compose up -d              # 背景啟動全部
docker compose up -d --build      # 重新建置後啟動
docker compose restart api        # 只重啟某個服務

# ── 記錄與除錯 ─────────────────────────────
docker compose logs -f            # 追蹤所有服務日誌
docker compose logs -f api        # 追蹤單一服務
docker compose exec api sh        # 進入容器開 shell（Node）
docker compose exec db psql -U admin -d homework_db   # 進入資料庫

# ── 停止與清除 ─────────────────────────────
docker compose stop               # 停止
docker compose down               # 移除容器與網路
docker compose down -v            # 連資料卷一起移除
docker image prune                # 清除無用映像檔
docker system prune -a            # 大掃除（小心使用）
```

### 驗證系統是否正常

```bash
curl http://localhost/healthz            # 應回 "ok"
curl http://localhost/api/status         # 應回 JSON，database.status 為 up
curl http://localhost/py/info            # 應回 Python 資訊
```

---

## 10. 與原始版本的改進對照

初始版本（`web/` 單一資料夾）已經能運作，但偏向「能跑就好」。以下是我做的改良：

| 項目 | 原始版本 | 改良後 |
| --- | --- | --- |
| 服務數量 | Nginx + Node + Postgres | 額外增加 **Python 服務**，展示跨語言微服務 |
| 專案結構 | 全部塞在 `web/` | 依服務分目錄（`nginx/`、`api/`、`analyzer/`、`db/`） |
| Nginx 網頁 | 用 volume 掛載單一 `index.html` | 自訂 Nginx 映像檔，把設定與完整前端一起建置進去 |
| 前端介面 | 只有一行文字顯示狀態 | 完整儀表板：架構圖、四服務即時狀態、留言 CRUD、文字分析 |
| API | 只有 `/api/status` | 完整 REST API（健康檢查、狀態、留言 CRUD） |
| 資料庫 | 無初始化腳本，無資料表 | `init.sql` 自動建表並寫入種子資料 |
| 啟動順序 | `depends_on` 不保證資料庫已就緒 | 加上 **healthcheck + `condition: service_healthy`** |
| Dockerfile | 單階段、`npm install`、以 root 執行 | **多階段建置、`npm ci`、非 root 使用者** |
| `.dockerignore` | 無 | 三個服務都有，縮小映像檔 |
| 設定管理 | 密碼寫死在 compose 裡 | 改用 `.env` + `.env.example` |
| 網路 | 單一預設網路 | **frontend / backend 分段隔離** |
| 安全 | 資料庫 port 暴露到主機 | 資料庫僅存在內部網路，不對外開放 |
| 錯誤處理 | JSON 格式錯誤會回傳 HTML stack trace | 統一回傳乾淨的 JSON 錯誤訊息 |
| 文件 | 空白 | 這份完整 README |

改進後映像檔大小（`docker images`）：

```
week6-nginx:latest      73.7 MB
week6-api:latest         200 MB
week6-analyzer:latest    199 MB
```

---

## 11. 疑難排解

**Q：`docker compose up` 時 `api` 一直重啟？**
A：多半是連不到資料庫。先看日誌 `docker compose logs api`，並確認 `db` 已變為 `healthy`。若剛改過資料庫版本或設定，試試 `docker compose down -v` 重設資料卷。

**Q：改了 `db/init.sql` 卻沒生效？**
A：初始化腳本只在**全新的資料卷**上執行。請執行 `docker compose down -v` 後再 `up`。

**Q：port 80 被佔用（`bind: address already in use`）？**
A：修改 `.env` 中的 `NGINX_PORT`（例如改成 `8080`），再 `docker compose up -d`，改用 `http://localhost:8080`。

**Q：資料庫版本錯誤（`database files are incompatible`）？**
A：換過 PostgreSQL 主版本時，舊資料卷不相容。開發環境可 `docker compose down -v` 重建。

**Q：瀏覽器顯示 `連線後端失敗`？**
A：確認 `api` 狀態為 healthy，並查看 `docker compose logs nginx api`。

**Q：想重新開始，全部砍掉重練？**
A：
```bash
docker compose down -v --rmi local
docker compose up -d --build
```

---

## 12. 心得與結論

透過這個作業，我從「會下 `docker run`」進步到能規劃、建置一個完整的多容器系統，主要有幾點收穫：

1. **微服務的價值在於職責分離**：每個服務只做好一件事，用標準介面（HTTP）溝通。好處是可以獨立開發、獨立部署，也能混用不同語言（Node.js + Python）。
2. **Nginx 反向代理是整合的關鍵**：前端不需要知道後端有幾個服務、各自在哪個 port，只要統一打同一個入口，由 Nginx 分流即可。
3. **「能跑」和「好用」差距很大**：健康檢查、資料初始化、環境變數、非 root、多階段建置……這些細節不會讓程式「動起來」，卻是讓系統穩定、安全、可維護的關鍵。
4. **Docker Compose 大幅簡化多容器管理**：一個 `docker compose up` 就能把四個服務的網路、順序、設定全部搞定，這是單獨用 `docker run` 很難優雅做到的。

最終成果是一個由 Nginx 統一入口、Node.js 與 Python 兩個後端微服務、PostgreSQL 資料庫組成的系統，並附上一個能實際操作的即時儀表板，完整展示了 Docker 微服務的建置與運作。
