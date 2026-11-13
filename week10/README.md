# 將 EdgeMemo 發佈成公開 npm 套件

這份文件記錄把 `week9/` 的 EdgeMemo 專案發佈到 npm 公開 registry 的完整過程，包含套件網址與開啟方式。

## 套件資訊

| 項目 | 內容 |
|---|---|
| 套件名稱 | `@fifi1060411/fidog` |
| 版本 | `1.0.0` |
| npm 套件頁 | <https://www.npmjs.com/package/@fifi1060411/fidog> |
| 安裝指令 | `npm install @fifi1060411/fidog` |
| tarball 下載 | <https://registry.npmjs.org/@fifi1060411/fidog/-/fidog-1.0.0.tgz> |
| 原始碼 | <https://github.com/s111410525-del/_se> |
| 線上網站 | <https://edgememo.edgememo.workers.dev> |
| 授權 | MIT |

## 如何開啟

### 1. 在瀏覽器開啟套件頁

直接打開 <https://www.npmjs.com/package/@fifi1060411/fidog>，可以看到套件說明、README、版本與安裝方式。

### 2. 用 npm 安裝

```bash
npm install @fifi1060411/fidog
```

安裝後檔案會放在 `node_modules/@fifi1060411/fidog/`，內含 `src/`、`public/`、`schema.sql`、`seed.sql`、`wrangler.jsonc`、`README.md`、`LICENSE`。

### 3. 直接下載 tarball

```bash
npm pack @fifi1060411/fidog
```

會下載 `fifi1060411-fidog-1.0.0.tgz`，解壓縮後即可看到套件內容：

```bash
tar -xzf fifi1060411-fidog-1.0.0.tgz
```

### 4. 在本機把專案跑起來

```bash
cd node_modules/@fifi1060411/fidog
npm install
npm run setup:local   # 建立本機 D1 並匯入範例資料
npm run dev           # 開啟 http://localhost:8787
```

### 5. 開啟已部署的線上版本

打開 <https://edgememo.edgememo.workers.dev> 即可使用。

## 發佈過程

### 步驟 1：登入 npm

```bash
npm login
```

確認登入身分：

```bash
npm whoami
# fifi1060411
```

### 步驟 2：把套件改成可公開發佈

原本 `week9/package.json` 是私有專案：

```json
{
  "name": "edgememo",
  "version": "1.0.0",
  "private": true
}
```

改成帶 scope 的公開套件名稱，並移除 `private`：

```json
{
  "name": "@fifi1060411/fidog",
  "version": "1.0.0",
  "description": "EdgeMemo：在 Cloudflare Workers + D1 上運行的備忘錄網站",
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  }
}
```

重點設定：

- `name` 加上 npm 帳號 scope `@fifi1060411`，避免與別人的套件撞名。
- 刪除 `"private": true`，否則 npm 會拒絕發佈。
- `publishConfig.access` 設為 `public`，scoped 套件才會公開。
- 補上 `license`、`keywords`、`engines`，讓套件頁與搜尋結果更完整。

### 步驟 3：限制要打包的檔案

用 `files` 欄位只放入真正需要的內容，避免把 `node_modules`、`.wrangler` 等本機檔案一起上傳：

```json
"files": [
  "src",
  "public",
  "schema.sql",
  "seed.sql",
  "wrangler.jsonc",
  "README.md",
  "LICENSE"
]
```

### 步驟 4：加入 LICENSE

在 `week9/` 新增 MIT `LICENSE`，並在 `package.json` 標明 `"license": "MIT"`，符合公開套件的授權要求。

### 步驟 5：先發佈測試版本

先發一個 staging 版本確認設定正確：

```bash
npm version 0.0.0-stage --no-git-tag-version
npm publish
```

### 步驟 6：發佈正式版本

```bash
npm version 1.0.0 --no-git-tag-version
npm publish
```

也可以直接指定公開權限：

```bash
npm publish --access public
```

### 步驟 7：驗證發佈結果

```bash
npm view @fifi1060411/fidog
```

確認 registry 上的版本與內容：

```bash
npm view @fifi1060411/fidog version
# 1.0.0
```

或直接開啟套件頁 <https://www.npmjs.com/package/@fifi1060411/fidog> 確認。

## 發佈結果

| 項目 | 值 |
|---|---|
| 發佈帳號 | `fifi1060411` |
| 首次發佈 | `2026-11-13 02:17`（`0.0.0-stage`） |
| 正式版本 | `2026-11-13 02:20`（`1.0.0`） |
| 打包檔案數 | 11 |
| 未壓縮大小 | 約 69 KB |
| tarball shasum | `f707585b834ca7ae95d8e2c36b7e49fe26cb4b3c` |

## 後續更新版本

修改程式後，記得同步調整 `week9/` 的內容與版本號，再重新發佈：

```bash
cd week9
npm version patch   # 或 minor / major
npm publish
```

已發佈的版本不可覆蓋，每次更新都必須使用新的版本號。

---

本文件與套件發佈過程使用 [opencode](https://opencode.ai) 完成。
