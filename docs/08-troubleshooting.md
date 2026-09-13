# 08 · 疑難排解（症狀 → 真因 → 確認方法 → 修法）

> 全部來自**本次開發真的遇到過**的問題（標 ✅ 實測）＋同類延伸（標 ⚠️ 推論）。
> 原則：**先找證據，再改東西。** 每個症狀都寫了「去哪裡看」。

---

## A. Telegram 完全沒反應

| # | 症狀 | 真因 | 怎麼確認 | 修法 |
|---|---|---|---|---|
| A1 | 傳訊息毫無反應 | **DSH 沒開**（機制 B 住在 DSH host 裡） | `netstat -ano \| findstr :3080` 沒有 LISTENING | 啟動 DSH；或改用機制 A |
| A2 | 同上，但 DSH 有開 | **插件沒掛上**（`inject` 沒滿足／bundle 沒加／patch 壞） | 看心跳檔是否在更新：`<workspacePath>\ops\state\tg-session-heartbeat.txt`（**決定性證據**；`ctx.logger` 不會進主控台） | 跑 `dsh --profile <p> --dump-config \| Select-String tg-session` 確認那一列在；再看 `package.json` 的 `dsh.profile.bundles` 有沒有它 |
| A3 | 有時回、有時不回 | **A 與 B 同時在跑**（同一支 bot 只能一個輪詢者） | 兩邊的鎖檔同時存在：`ops\notify\tg-session.lock` 與 `ops\notify\tg-bridge.lock` | 關掉其中一個（平常只用 B） |
| A4 | 啟動時說 `getUpdates 失敗：Conflict` | 同上，或**別的地方也設了 webhook** | `getWebhookInfo` 的 `url` 不是空的 | 刪掉 webhook（`deleteWebhook`）或停掉另一個輪詢者 |
| A5 | 只有你自己的訊息有效、別人傳沒反應 | **這是設計**（只認 allowlist chat） | `<workspacePath>\ops\notify\tg-session.jsonl` 出現 `event:"rejected-chat"` | 正常，不用修 |
| A6 | 啟動就掛掉 | token 錯／沒有 `getMe` | `getMe` 回 `ok:false` | 重新產生 token（@BotFather）並更新 `~/.dsh/notify-secrets.json` |
| A7 | 回「⛔ 已達今日上限」 | 當日 TG 派工累計 ≥ `dailyCapCny` | `ops\notify\tg-session-state.json` 的 `todaySpent` | 改 `cordis.patch.yml` 的 `dailyCapCny`（要重啟）；或等隔天（跨日自動歸零） |

---

## B. 有回應，但內容看起來怪

| # | 症狀 | 真因 | 說明／修法 |
|---|---|---|---|
| B1 ✅ | 「它回我相同的字」 | 那是**確認訊息**引用你的原文（`🕐 收到…` 後面那行 `> …`） | 長訊息現在只引前 80 字＋`（共 N 字）`；真正的答案在**下一則** |
| B2 | 答案空白／只有頁腳 | 該回合沒有最終 `assistant/message`（多半還在跑、或卡在等核准） | 看 `tg-session.jsonl` 的 `timedOut`；到 GUI 打開那段對話接手 |
| B3 ✅ | 成本顯示 0 | 舊版直接讀成本帳本，而帳本是**主機另一個行程**定期 flush、讀太快還沒寫入 | 新版改讀**該 session 自己的 token 用量**（`record.rows.tokenUsage.val.totals`）；帳本只當備援 |
| B4 ✅ | 顯示「¥ 待結算」 | 連 token 用量都還沒落盤（罕見） | 正常，不假裝 0；下一個回合就會有 |
| B5 ✅ | 標題變成 `[來自 Telegram 的派工] 工作區＝…` | 建立 session 時拿**加過前置指示的 prompt** 去取標題 | 已修：標題一律取**使用者原文**（`titleFor(rawText)`） |

---

## C. GUI（瀏覽器介面）相關

| # | 症狀 | 真因 | 怎麼確認 | 修法 |
|---|---|---|---|---|
| C1 ✅ | GUI 裡找不到那段 TG 對話 | 側邊欄**一次只顯示一個 Workspace**，而它掛在別的 Workspace | `~/.dsh/storages/workspace.json` → 找 `path = 你的 workspacePath` 的那個 workspace，看 `sessionIds` 有沒有它 | 在側邊欄**切換 Workspace** 到那一個 |
| C2 ✅ | 對話**根本沒掛上** | 忘記 `await workspace.attachSession(sessionId)` | 同上（`sessionIds` 裡沒有） | 補上那一步（見 `06-contracts.md` §5 第 ④ 步） |
| C3 ✅ | 打 `127.0.0.1:3080` 顯示 **authentication required** | web host 每次啟動的 **token 不同**，舊網址失效 | 啟動視窗會印 `dsh web: http://127.0.0.1:3080/?token=…` | **用那一串完整網址**（含 `?token=`），不要只打 IP:port |
| C4 | 想在 GUI 接手同一段對話 | 這是機制 B 的正常能力 | — | 直接打開那段對話繼續問；TG 與 GUI 共用同一個 session |

---

## D. 權限／被擋

| # | 症狀 | 真因 | 怎麼確認 | 修法 |
|---|---|---|---|---|
| D1 ⚠️ | 寫檔失敗、要求核准 | 目標在工作區外（`workspace-write` 只允許工作區＋暫存） | 看你傳的訊息裡的**路徑** | 改到工作區內；或到 GUI 按核准；或改 `permissionPreset` |
| D2 ✅ | 刪檔被直接拒絕 | `hardCategories: deletion`＋`rm -rf` 等關鍵字 | `~/.dsh/auto-approve/allowlist.json` | 正常（安全設計）。真的要刪，請在 GUI 或自己動手 |
| D3 ⚠️ | 一直卡住、最後收到「⏳ 可能正在等你核准」 | 那一步需要人核准 | `tg-session.jsonl` 的 `timedOut:true` | 打開 GUI 那段對話按核准 → 它會繼續跑完 |
| D4 | 想放寬範圍 | — | — | 加 `allowRules`（風險中）／換 `workspacePath`（風險低）／改 `read-only`（最保守）；見 `07` §7 |

---

## E. 開發時常踩（二次開發必看）

| # | 症狀 | 真因 | 修法 |
|---|---|---|---|
| E1 ✅ | 補丁「成功」但檔案沒變 | 錨點字串與檔案不完全相同（差一個 `#`、差空白） | **一律先 `--dry`**；錨點用單行短片段；補丁後**驗證原行全部保留** |
| E2 ✅ | 改了變數名 → `xxx is not defined` | 只改一半（例如參數改名但日誌那行還指舊名） | 改完**立刻跑語法／執行**；用 `node --check`、`Parser::ParseFile` |
| E3 ✅ | 為了一個插件跑 `pnpm install`，結果正在跑的 host 出事 | pnpm 會動 `node_modules` | 用 **junction**（`mklink /J`）指向 `packages\<pkg>`，不要為此跑 pnpm |
| E4 ✅ | `--dump-config` 被拒（EPERM） | 它會**寫** `cordis.yml`；受限沙箱不給寫 | 提權執行；或只讀已存在的 `cordis.yml` |
| E5 ✅ | `git` 網路操作失敗（`couldn't create signal pipe, Win32 error 5`） | 沙箱擋掉 Git for Windows 的 signal pipe | 提權執行；或請使用者在自己的視窗 `git push` |
| E6 ✅ | `.ps1` 中文變亂碼 / `JSON.parse` 失敗 | 檔案沒有 UTF-8 BOM（PS 5.1 用 Big5 讀）；或讀到 BOM 開頭的 JSON | 補 BOM；讀取端 `TrimStart([char]0xFEFF)` |
| E7 ✅ | 自我測試把**正在跑的正式鎖**刪了 | 鎖路徑是載入時算好的常數，測試覆蓋沒生效 | 測試一律用**測試專用目錄**，並斷言「正式檔未被動到」 |
| E8 ✅ | 測試紅了、但程式沒錯 | **測試樣本**寫錯（把 `turn/start` 放在區間外、字數算錯） | 樣本回去對**真實資料形狀** |
| E9 ✅ | 功能跑起來但「沒有人發現它壞了」 | 沒接進自動驗證 | 接進一鍵驗證鏈（本專案是 `41`），加編號案例 |
| E10 ⚠️ | `ctx.logger` 看不到任何訊息 | 它不寫主控台 | **用檔案副作用當證據**（心跳／鎖／jsonl） |
| E11 ✅ | TG 任務被帶去翻一大票檔案、變很貴 | 前置指示太強（「先讀 AGENTS.md」→ 它真的全讀） | 改成**條件式**：「要動手才讀，單純問答直接答」 |

---

## F. 成本相關

| 問題 | 答案 |
|---|---|
| 為什麼一則「OK」也要 ¥0.03？ | 每個 session 都要付固定前綴（系統提示＋約 60 個工具說明 ≈ 10,000–12,000 token 輸入） |
| 怎麼看今天花了多少？ | TG 傳 `/status`；或看 `ops\notify\tg-session-state.json` 的 `todaySpent` |
| 怎麼限制？ | `cordis.patch.yml` 的 `dailyCapCny`（只算 TG 派工，不含你在 GUI 自己的用量） |
| 為什麼實際扣款比頁腳多？ | 頁腳是**估算**（依該 session 的 token × 權重）；實際以 DeepSeek 帳本為準 |
| 想省錢 | ① 把「查詢類」問答合併成一則 ② 少用「去翻整個專案」這種任務 ③ 尖峰/離峰時段（本專案 `AGENTS.md` §1 有空閒時段半價的規則） |

---

## G. 三行急救（貼上就跑）

```powershell
# 1) 插件到底活著沒（心跳是決定性證據）
Get-Content '<workspacePath>\ops\state\tg-session-heartbeat.txt'

# 2) 最近三筆任務與錯誤
Get-Content '<workspacePath>\ops\notify\tg-session.jsonl' -Tail 3 -Encoding UTF8

# 3) 這段對話有沒有掛進 GUI 那個工作區
(Get-Content "$HOME\.dsh\storages\workspace.json" -Raw | ConvertFrom-Json).tables.workspaces.PSObject.Properties |
  Where-Object { $_.Value.path -eq '<workspacePath>' } | ForEach-Object { $_.Value.sessionIds }
```

---

## H. NotebookLM CLI 取 token 失敗（2026-09-13 實測，`notebooklm-py 0.3.4`）

| 項目 | 內容 |
|---|---|
| **症狀** | `notebooklm list` / `auth check --test` 一律回 `Authentication expired or invalid. Redirected to: https://accounts.google.com/v3/signin/identifier?...WebLiteSignIn...`；`auth check --json` 的 `token_fetch: false`（`storage_exists/sid_cookie` 都是 `true`） |
| **不是什麼** | **不是登入壞掉**。同一份 `storage_state.json` 直連 Google 實測：`accounts.google.com` → `302 myaccount.google.com`（＝session 有效）、`notebook.google.com` → `HTTP 200`。所以 cookie 是好的。 |
| **排除過的修法** | ① 重新 `notebooklm login`（多次，含自動代按 Enter）② 移除 `accounts.google.com` 的 4 個 `__Host-*` cookie ③ 再移除所有非網域型 host-only cookie ④ 用 `NOTEBOOKLM_HOME` 指向乾淨複本。**四種都仍失敗。** |
| **判斷** | **CLI 版本過舊**：`notebooklm-py 0.3.4`（稽核日 2026-04-23）與現行 Google API 不相容 → token 取得流程被導向登入頁。 |
| **不建議直接升級的原因** | 這個 CLI **持有你的 Google SID cookie**（等同帳號存取權）。`notebooklm` 技能有 **UPGRADE GUARDRAIL**：升級前必須做差異比對與安全重掃（見該技能的 `SECURITY_AUDIT.md`）。要升級請當成一件獨立、經同意的安全工作。 |
| **目前的替代路徑（零風險）** | 用**單檔教學包**手動上傳：瀏覽器開 `notebooklm.google.com` → 建立筆記本 → 把 `dist\DSH-Telegram-Bridge-Teaching-Pack.md` 拖進去當來源。`tools\notebooklm-sync.ps1` 留著，等 CLI 修好後可直接用。 |
| **給二次開發者** | 若你要自動化：先確認 `notebooklm auth check --test` 的 `token_fetch: true` 再寫流程；或改用官方 API／瀏覽器自動化（CDP）路線。 |
**後續（2026-09-13 當日，實況）**：NotebookLM 這一格改由**手動上傳**完成——用 `dist\DSH-Telegram-Bridge-Teaching-Pack.md`（單檔，含全部 10 份教學）在瀏覽器建立筆記本「DSH Telegram 橋接器」。CLI 自動化**仍待升級後再啟用**；`tools\notebooklm-sync.ps1` 保持可用，但跑之前先確認 `notebooklm auth check --test` 的 `token_fetch` 是 `true`。

**驗證等級**：此步為**使用者回報**（CLI 失效、瀏覽器外掛未連線，agent 無法獨立查核）。其餘交付項皆有實測證據（見 README 與各文件末的實測數字）。