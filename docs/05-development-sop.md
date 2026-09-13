# 05 · 開發 SOP：從零到上線（本次實際走過的流程）

> 這份不是理想流程，是**這次真的照著做的流程**（含踩到的坑）。
> 目標：讓別人（或半年後的你）能在**不重踩**的前提下，做出一個掛進 DSH 的插件。
> 適用範圍：任何「外部事件 → 在 DSH 裡做事」的插件（Telegram／Line／Webhook／排程都同一套）。

---

## 0. 三條原則（比步驟重要）

1. **合約先行**：不要憑記憶寫 DSH API。**先讀官方原始碼**，把用到的每個服務、每個方法、每個事件型別找出來，釘住版本。
2. **先量測再上線**：任何「判斷規則」（正則、門檻、白名單）都要先對**真實資料**跑一次，量出假陽性／假陰性。本次一條規則第一版誤報 17 個檔，收窄後才 0。
3. **機制化收尾**：功能做完不算完。要①接進自動驗證鏈 ②寫進規則文件 ③進備份。否則下一個視窗會重踩（§8）。

---

## 1. 步驟 0：先把「問題」與「界線」寫下來

- 問題一句話：**「在手機上就能派工給 DSH，而且答案回到手機。」**
- 界線（先決定，後面才不會走冤枉路）：
  - 只在**本機**跑（不開對外連接埠）
  - 只認**一個** Telegram chat
  - 只能**改工作區**，其他要核准
  - 有**每日成本上限**
- 驗收條件（可檢查）：① Telegram 收到答案 ② GUI 看得到同一段對話 ③ 超額會拒收 ④ 非本人無回應

> **教訓**：這次一開始就有做界線，所以後面沒有「越做越大」的失控。

---

## 2. 步驟 1：合約探索（最省時間的一步）

**要讀的不是文件，是原始碼**（版本：`@deepseek-ai/dsh 0.1.5-rc.1`）。這次實際讀了：

| 目的 | 檔案 | 學到什麼 |
|---|---|---|
| CLI 有哪些能力 | `@deepseek-ai/dsh/lib/bin.js` | `dsh --profile <name> [args…]`、`dsh plugin --profile <p> add <pkg>`、`--dump-config`（會寫 `cordis.yml`） |
| 什麼都不用改就能跑一次性任務 | `dsh-headless/README.md`＋`lib/index.js` | `dsh --profile headless "<task>"`；答案在 stdout；`whenIdle()`＋掃 `session.eventAt()` 取最終文字 |
| 怎麼建立「進得了 GUI」的 session | `dsh-webhook/lib/index.js` | 六個服務＋`createSession` 的完整序列（見 06 文件） |
| 插件長什麼樣 | `dsh-headless/lib/index.js` | named `apply`＋`inject`＋`Config`；**沒有 default export** |
| patch 檔怎麼寫 | `dsh-headless/cordis.patch.yml`、`dsh-web-app/cordis.patch.yml` | `insert:` 清單可以掛新列；**patch 會整段取代 config** |
| 權限怎麼分 | `dsh-permission-presets/lib/index.js` | `read-only`／`workspace-write`／`danger-full-access` |
| Web 服務怎麼註冊路由 | `dsh-host-webserver/README.md` | `/api` 是給**瀏覽器**的（有 browser authentication）→ 不要拿來當外部 API |

**產出**：一頁「契約清單」（就是 `06-contracts.md`）。之後寫程式只照那頁。

> **教訓**：一開始我想走「直接打本機 API」這條路——讀了 `dsh-client-connection` 才知道那條有 `browser authentication`／`Host/Origin` 檢查，是給瀏覽器的。**少走兩天冤枉路。**

---

## 3. 步驟 2：選載體（最小形狀）

| 需求 | 選什麼 |
|---|---|
| 只要「跑一個任務拿答案」 | **機制 A**：不改 DSH，直接叫 `dsh --profile headless` |
| 要**進 GUI**、要**多輪**、要**核准** | **機制 B**：寫 host 插件，用 `ctx.agents` 建真 session |

> **不要**為了「看起來完整」而加 Worker／資料庫／UI。這次 B 只用了 2 個檔案（`lib/index.js`＋`lib/pure.js`）＋1 個 patch 檔。

---

## 4. 步驟 3：最小可跑（先讓它活著）

順序（每一步都要看到證據才往下）：

1. 建插件資料夾：`package.json`（含 `dsh.bundle.patch`）＋`cordis.patch.yml`（`insert:` 一列）
2. **先讓一行 log 出現**（證明列被掛上、`apply()` 被呼叫）
3. 再接「取得服務」→「建立 session」→「送出 prompt」→「取答案」
4. 最後才接外部 I/O（Telegram）

> **教訓**：本次的 `ctx.logger` 不會印到主控台，害我一度以為插件沒掛上。**診斷要靠「檔案副作用」**（心跳檔／鎖檔／日誌檔），不是靠 log。

---

## 5. 步驟 4：測試（分兩層，先便宜後貴）

| 層 | 測什麼 | 怎麼跑 | 成本 |
|---|---|---|---|
| **純函式層** | 分段／allowlist／答案折疊／token 加總／成本／上限／標題／頁腳 | `node tests/pure.test.mjs`（零依賴、零網路） | 0 |
| **真實層** | 真 host、真 session、真 GUI、真 Telegram | 隔離 profile（步驟 5） | 每則 ≈¥0.03 起 |

**測試樣本要「忠於真實形狀」**——本次純函式測試一開始錯了 3 條，全是**樣本寫錯**（`turn/start` 放錯位置、字數算錯），不是程式錯。寫樣本時回去看真實資料。

---

## 6. 步驟 5：裝到**隔離 profile**（不要碰生產）

```powershell
# 1) 從官方模板建一個練習場
dsh --profile <練習場> --from-default-profile web --dump-config   # 只組態、不啟動
# 2) 裝插件（會自動加進 dsh.profile.bundles）
dsh plugin --profile <練習場> add file:../web/packages/<你的插件>
# 3) 用另一個 port 啟動，確認不撞生產
dsh --profile <練習場> --port 3081 --no-open
```

> **教訓**：`--dump-config` 會**寫** `cordis.yml` → 在受限沙箱會被拒；要提權。
> `--no-open` 可避免練習場彈瀏覽器。**練習場的 token 每次啟動都不同**，要留下含 token 的 URL。

---

## 7. 步驟 6：端到端驗證（證據要大於直覺）

**必須同時從三邊確認**（只信一邊就會誤判）：

| 邊 | 看什麼 |
|---|---|
| 使用者端 | Telegram 真的收到答案（含耗時／token／≈¥／session 短碼） |
| 檔案端 | `tg-session.jsonl` 有 `turn` 列（raw／sessionId／tokens／cost／answerHead） |
| 註冊端 | `~/.dsh/storages/workspace.json` 該 Workspace 的 `sessionIds` 有它 |

> **教訓（最重要的一條）**：GUI「看不到」時，我先以為插件壞了。真因是**側邊欄一次只顯示一個 Workspace**，
> 而 `workspace.json` 裡明明掛對了。**先看資料，再看畫面。**

---

## 8. 步驟 7：落地到生產（四個前置）

1. **備份**要改的檔（`package.json`、`cordis.patch.yml`）
2. **改 `package.json`＋`cordis.patch.yml`**（`workspacePath`／`permissionPreset`／`dailyCapCny`…）
3. **組態驗證**：`dsh --profile web --dump-config | Select-String tg-session` → 必須出現那一列
4. **才重啟**（插件只在開機時載入）；重啟前先確認**舊機制已停**（兩個輪詢者會互搶）

> **教訓**：改 `package.json` 時**不要順手跑 `pnpm install`**（會動到正在跑的 host 的 node_modules）。
> 用 `node_modules\<pkg>` → `packages\<pkg>` 的 **junction** 就好，零風險。

---

## 9. 步驟 8：機制化收尾（做完才算完）

| 收尾 | 做什麼 | 這次的成果 |
|---|---|---|
| ① 自動驗證 | 把測試接進「一鍵驗證」鏈 | R9（A 橋接器 9 案例）、R10（B 插件 25 案例） |
| ② 寫進規則 | `AGENTS.md` 寫明「用哪個、不要開哪個」 | §11b：B 現行／A 備援／**不可同時開** |
| ③ 進備份 | 讓同步腳本認得插件原始碼 | `sync-tooling-to-vault` 加 `packages` 來源 |
| ④ 文件化 | 這套 docs | 01–10 |

---

## 10. 本次實際踩到的坑（照這個順序避開）

| # | 症狀 | 真因 | 怎麼避免 |
|---|---|---|---|
| 1 | 補丁「看起來成功」但檔案沒變 | 錨點字串跟檔案不完全一致（少一個 `#`） | **補丁一律先 `--dry` 乾跑**；錨點用「不含換行的短片段」 |
| 2 | 插件沒反應、沒有 log | `ctx.logger` 不進主控台 | 用**檔案副作用**當證據（心跳／鎖／jsonl） |
| 3 | 成本一直顯示 0 | 用量帳本是**另一個行程** flush，讀太快讀不到 | 改讀**該 session 自己的 token 用量**；帳本只當備援 |
| 4 | token 讀不到（永遠 null） | 投影快取每列包在 `{ver,seq,val}` 裡，我讀錯層 | 讀 `record.rows.tokenUsage.val.totals` |
| 5 | 任務被帶去翻一堆檔 | 我下的前置指示太強（「先讀 AGENTS.md」） | 改成**條件式**：「要動手才讀，單純問答直接答」 |
| 6 | 自我測試刪掉了**正式鎖** | 鎖路徑是載入時算好的常數，測試覆蓋沒生效 | 測試一律用**測試專用目錄**；斷言「正式檔未被動到」 |
| 7 | GUI 看不到新對話 | 側邊欄只顯示**一個** Workspace | 先確認 `workspace.json` 掛對，再切 Workspace 看 |
| 8 | 兩個機制搶訊息 | 同一支 bot 只能有**一個** `getUpdates` 輪詢者 | 文件與啟動器都要寫「不可同時開」 |
| 9 | 測試紅了、以為程式錯 | 3 條是**測試樣本**寫錯 | 樣本回去對真實資料形狀 |
| 10 | 改了 3 個地方、跑了驗證才發現語法錯 | 改名只改一半（`text` → `promptText`） | **改完 .ps1 立刻跑 `Parser::ParseFile`**；本專案有 `41` 一鍵驗證 |

---

## 11. 完成定義（DoD）檢查清單

```
[ ] 契約清單已寫下、版本已釘（06-contracts.md）
[ ] 純函式測試全綠（可離線跑）
[ ] 隔離 profile 端到端驗證過（Telegram＋日誌＋workspace.json 三邊一致）
[ ] 危險／跨區動作的界線文件化，且與實測一致
[ ] 每日成本上限有效（拒收訊息看過一次）
[ ] 只有 allowlist 的 chat 有效（別帳號測過）
[ ] 接進一鍵驗證鏈（有編號的案例）
[ ] 寫進 AGENTS.md（含「不要同時開」這類互斥規則）
[ ] 原始碼進備份（同名同 SHA256 驗過）
[ ] 教學文件齊（README＋01–10）
```
