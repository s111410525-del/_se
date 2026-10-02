# Git 基本操作說明：Branch、Merge、Fork 與 Pull Request

本文件說明如何從零到產出以下專案狀態，所需的 Git 指令與 GitHub 操作步驟。

| 名稱 | 專案連結 | 說明 |
|---|---|---|
| 母專案 | [111410525-test/git-examples (main)](https://github.com/111410525-test/git-examples/commits/main) | 原始的遠端倉庫（Remote Repository）。 |
| 分支 | [developGitBranch](https://github.com/111410525-test/git-examples/commits/developGitBranch) | 從 `main` 建立的開發分支。 |
| 子專案（Fork） | [s111410525-del/git-examples (main)](https://github.com/s111410525-del/git-examples/commits/main/) | 從母專案 Fork 至另一個 GitHub 帳號的副本。 |

---

## 目錄

1. [建立分支（Branch）](#1-建立分支branch)
2. [合併分支（Merge）](#2-合併分支merge)
3. [Fork 專案（Fork）](#3-fork-專案fork)
4. [建立 Pull Request（PR）](#4-建立-pull-requestpr)
5. [補充：實際操作順序建議](#5-補充實際操作順序建議)

---

## 1. 建立分支（Branch）

分支（Branch）是用來在不影響主線 `main` 的情況下，獨立開發新功能或修改程式碼。

### 方式 A：透過 GitHub 網頁操作

1. 前往 [母專案](https://github.com/111410525-test/git-examples)
2. 點擊畫面左上方的分支切換按鈕（目前顯示 `main`）
3. 在搜尋欄輸入想要建立的新分支名稱，例如 `developGitBranch`
4. 點擊 `Create branch: developGitBranch from 'main'`
5. 成功後，便會自動切換到該分支，並可在 `commits/developGitBranch` 頁面看到該分支的提交紀錄

### 方式 B：透過 Git CLI 操作

```bash
# 1. 複製母專案到本機（首次才需要）
git clone https://github.com/111410525-test/git-examples.git
cd git-examples

# 2. 切換到 main 並更新到最新版本
git checkout main
git pull origin main

# 3. 建立並切換到新分支 developGitBranch
git checkout -b developGitBranch

# 4. 將新分支推送到遠端倉庫，並設定追蹤
git push -u origin developGitBranch
```

> 執行完以上步驟後，即可在 GitHub 上看到 `developGitBranch` 分支，與你本機的開發分支連動。

---

## 2. 合併分支（Merge）

合併（Merge）是將分支上的修改，整合回主線分支（例如 `main`）。此範例中，`developGitBranch` 的提交最終已合併至 `main`。

合併的方式主要有兩種：**直接在本機合併後推送**，或是 **透過 Pull Request（建議）**。Pull Request 的方式會在下一段說明，這邊先介紹本機合併。

### 方式 A：透過 GitHub 網頁操作（最常見：PR 合併）

GitHub 上最建議的做法是建立 Pull Request 並進行合併（可選擇 `Create a merge commit`、`Squash and merge` 或 `Rebase and merge`），這個流程會在 [第 4 節](#4-建立-pull-requestpr) 詳細說明。

### 方式 B：透過 Git CLI 操作（本機合併）

```bash
# 1. 切換回主線分支 main
git checkout main

# 2. 先拉取最新的 main，避免衝突
git pull origin main

# 3. 將 developGitBranch 的變更合併進 main
git merge developGitBranch

# 4. 將合併結果推送回遠端
git push origin main
```

> 執行後，`main` 分支便會包含 `developGitBranch` 上的所有提交紀錄。這也對應到你母專案 [main 分支的 commit 紀錄](https://github.com/111410525-test/git-examples/commits/main) 中出現了來自該分支的變更。

---

## 3. Fork 專案（Fork）

Fork 指的是在你的個人 GitHub 帳號底下，建立一份原專案的完整副本。這在你沒有原專案的寫入權限（Collaborator 權限）時特別常用，用來進行修改後再回饋給原專案。

你的範例中，[s111410525-del/git-examples](https://github.com/s111410525-del/git-examples/commits/main/) 就是從 [111410525-test/git-examples](https://github.com/111410525-test/git-examples) Fork 而來的子專案。

### 操作步驟（僅限 GitHub 網頁）

1. 前往母專案頁面：[https://github.com/111410525-test/git-examples](https://github.com/111410525-test/git-examples)
2. 點擊右上角的 `Fork` 按鈕
3. 選擇要 Fork 到的帳號（此例為 `s111410525-del`）
4. GitHub 會自動建立 `https://github.com/s111410525-del/git-examples`
5. Fork 完成後，你便擁有該副本的完整讀寫權限，可以在自己的 Fork 上進行 Commit、Push 等操作

### 從本機 Clone 你的 Fork（建議後續開發）

```bash
# 將你 Fork 的倉庫複製到本機
git clone https://github.com/s111410525-del/git-examples.git
cd git-examples

# 設定原始母專案為 upstream（方便後續同步更新）
git remote add upstream https://github.com/111410525-test/git-examples.git

# 確認遠端設定
git remote -v
# origin  -> 你的 Fork
# upstream -> 原始母專案
```

---

## 4. 建立 Pull Request（PR）

Pull Request（PR）是請求原專案的維護者，將你在 Fork（或分支）中所做的修改，**合併回原始專案的 `main` 分支**。這是開源協作與團隊開發中最常用的程式碼審查與合併機制。

在此案例中，最有可能的流程是：在 `s111410525-del/git-examples`（Fork）上建立分支或直接提交變更後，向原始母專案 `111410525-test/git-examples` 發出 Pull Request，待審查後由維護者合併進 `main`。

### 方式 A：從 Fork 發出 PR（無原專案寫入權限時）

1. 前往你的 Fork 專案：[https://github.com/s111410525-del/git-examples](https://github.com/s111410525-del/git-examples)
2. 確認你要提出變更的分支已推送到 Fork（例如 `main` 或你建立的功能分支）
3. 點擊頁面上方的 `Contribute` > `Open pull request`
4. GitHub 會自動比對：將 `s111410525-del/git-examples` 的某分支，合併到 `111410525-test/git-examples` 的 `main`
5. 填寫 PR 標題、說明（說明這次做了什麼、為什麼要做）
6. 點擊 `Create pull request` 即可送出

### 方式 B：從同一個倉庫的分支發出 PR（有寫入權限時）

如果你直接在母專案 `111410525-test/git-examples` 建立了 `developGitBranch`，也可以直接從該分支發 PR：

1. 前往母專案 > 點擊 `Pull requests` > `New pull request`
2. 選擇 `base: main` ← `compare: developGitBranch`
3. 檢視變更內容後，填寫說明並建立 PR
4. 維護者（可為自己）確認無誤後，點擊 `Merge pull request`，選擇合併方式後完成合併

> 這就是對應到 `developGitBranch` 最終被合併回 `main` 的整個流程。

---

## 5. 補充：實際操作順序建議

根據你提供的三個連結，最合理的操作順序如下：

1. **Fork（步驟 3）**：在 GitHub 上將母專案 Fork 到 `s111410525-del` 帳號，取得子專案。
2. **Clone Fork 到本機**：將子專案 `git clone` 下來進行開發。
3. **建立分支（步驟 1）**：在本機（建議在 Fork 或原專案皆可）建立 `developGitBranch`：`git checkout -b developGitBranch`。
4. **開發與提交**：進行修改後 `git add`、`git commit -m "..."`，並 `git push origin developGitBranch` 推送至遠端。
5. **建立 Pull Request（步驟 4）**：從該分支向母專案發出 PR，說明變更內容。
6. **合併分支（步驟 2）**：原專案維護者（或擁有權限者）在 GitHub 上審查並 `Merge pull request`，將 `developGitBranch` 合併至 `main`。

> 完成後，母專案的 `main` 與分支頁面便會呈現你所提供的 commit 紀錄狀態，而 Fork 則會保留該專案的副本。

---

**備註：** 團隊協作時，建議優先使用 Pull Request 來進行合併，而非直接在本機執行 `git merge` 後推送至受保護的 `main` 分支。這樣能確保有程式碼審查、紀錄清楚且更安全。