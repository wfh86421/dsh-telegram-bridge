# DSH Telegram 橋接器 · 完整教學包（單檔版）

> **這是自動產生的合訂本**（由 tools\build-teaching-pack.ps1 合併 README 與 docs/*.md）。
> 原始檔在 docs/；想看單篇請直接開那一份。此檔用途：① 一次上傳到 NotebookLM ② 離線閱讀／分享。
> 產生時間：2026-09-14 00:09｜來源檔：9 份｜基準版本：@deepseek-ai/dsh 0.1.5-rc.1

---

## 目錄

- README.md
- 00-index.md
- 01-overview-and-quickstart.md
- 05-development-sop.md
- 06-contracts.md
- 07-capability-and-permissions.md
- 08-troubleshooting.md
- 09-telegram-test-plan.md
- 10-second-development.md


---

<!-- ===== 來源檔：README.md ===== -->

# dsh-telegram-bridge

> **Telegram ↔ DeepSeek Harness (DSH)：在手機上派工給本機的 AI agent，答案回到 Telegram。**
> 兩種實作：**A**＝獨立程式（headless 一次性任務）；**B**＝DSH host 插件（真的 Session、GUI 看得到、可多輪接續）。
>
> *Send tasks to a local DeepSeek Harness agent from Telegram, and get the answer back. Two implementations: a standalone headless runner (A) and a host plugin that creates a real, GUI-visible, multi-turn session (B).*

---

## 這個套件包含什麼

| 目錄 | 內容 |
|---|---|
| `docs/` | **教學手冊**（10 份）：總覽／快速開始／開發 SOP／契約清單／功能與權限／疑難排解／測試計畫／二次開發 |
| `src/host-plugin/` | **機制 B**：`dsh-tg-session` 插件（零外部依賴，含 25 項測試） |
| `src/headless-bridge/` | **機制 A**：`tg-bridge.mjs`＋PowerShell 包裝＋啟動器（含 9 項自我測試） |
| `examples/` | 設定範例（`cordis.patch.yml`、狀態檔） |

**沒有包含**：任何 token／chat id／日誌（憑證一律留在 `~/.dsh/notify-secrets.json`，在 profile 之外）。

---

## 30 秒選機制

| | **B（建議）** | **A（備援）** |
|---|---|---|
| 你的 TG 訊息 | 變成**真的 Session**（GUI 看得到、可接手、可多輪） | 一次性 headless 任務（GUI 看不到） |
| 需要核准時 | ⏳ 逾時回報，可在 GUI 按核准後繼續 | ❌ 沒有核准管道 → 失敗 |
| 安裝 | 中（裝 bundle＋改設定＋重啟 DSH） | 低（複製 3 個檔） |

> ⚠️ **兩者不可同時跑**：都靠 `getUpdates` 輪詢同一支 bot，會互搶訊息。

---

## 快速開始

### A：headless 橋接器（10 分鐘）

```powershell
copy src\headless-bridge\tg-bridge.mjs     <profile>\tools\
copy src\headless-bridge\run-tg-bridge.ps1 <profile>\tools\
node <profile>\tools\tg-bridge.mjs --selftest --dry-run --state-dir .\tempselftest   # 應 9/9
powershell -File <profile>\tools\run-tg-bridge.ps1 -Test "用一行回我 OK"              # 真的發一則
powershell -File <profile>\tools\run-tg-bridge.ps1                                   # 常駐
```

### B：host 插件（30 分鐘）

```powershell
xcopy /E /I src\host-plugin <profile>\packages\dsh-tg-session
cmd /c mklink /J "<profile>\node_modules\dsh-tg-session" "<profile>\packages\dsh-tg-session"
# 在 <profile>\package.json 的 dsh.profile.bundles 追加 "dsh-tg-session"
# 在 <profile>\cordis.patch.yml 設定 tg-session 那一列（見 docs/01）
dsh --profile <profile> --dump-config | Select-String 'tg-session'   # 必須出現
# 重啟 DSH
```

完整步驟與設定鍵：**[docs/01-overview-and-quickstart.md](docs/01-overview-and-quickstart.md)**

---

## 它能做到什麼程度（重點）

| | 範圍 |
|---|---|
| **看** | 整台電腦都能讀（不受限） |
| **改** | 只限你設定的**工作區**（`workspacePath`）＋允許的暫存區 |
| **要核准** | 寫到工作區外、對外網路、傳訊息 → 無人時會卡住並通知你 |
| **直接拒絕** | 刪除／憑證／遠端硬體／系統／大量操作（關鍵字與類別白名單） |
| **做不到** | 圖片檔案、歷史訊息、看中間過程、DSH 關機時 |
| **費用** | 每則 ≈¥0.03 起（固定前綴 ~1 萬 token）；內建每日上限 |

細節與實測數字：**[docs/07-capability-and-permissions.md](docs/07-capability-and-permissions.md)**

---

## 文件地圖

| 想做的事 | 看這份 |
|---|---|
| 搞清楚要學什麼 | [docs/00-index.md](docs/00-index.md) |
| 快速上手 | [docs/01-overview-and-quickstart.md](docs/01-overview-and-quickstart.md) |
| 從零開發一個插件 | [docs/05-development-sop.md](docs/05-development-sop.md) |
| **要改／延伸（API 契約）** | [docs/06-contracts.md](docs/06-contracts.md) |
| 功能與權限的界線 | [docs/07-capability-and-permissions.md](docs/07-capability-and-permissions.md) |
| 壞了 | [docs/08-troubleshooting.md](docs/08-troubleshooting.md) |
| 上線前測試 | [docs/09-telegram-test-plan.md](docs/09-telegram-test-plan.md) |
| 換 IM／加功能／多人用 | [docs/10-second-development.md](docs/10-second-development.md) |

---

## 需求

| 項目 | 版本（本套件實測） |
|---|---|
| DeepSeek Harness | `@deepseek-ai/dsh` **0.1.5-rc.1** |
| Node | v22.23.2 |
| PowerShell | 5.1（Windows）／含 PowerShell 7 亦可 |
| Telegram bot | 任意（用 `getUpdates` 輪詢，**不需要**公開 IP） |

> DSH 是 preview 軟體，API 會變。升級後請照 [docs/06-contracts.md](docs/06-contracts.md) §11 重跑檢查。

---

## 安全（請務必讀）

- 這個功能＝**讓遠端訊息在你電腦上執行 agent**。只認一個 chat id、金鑰放在 profile 之外、沙箱只允許工作區、危險類別硬拒、有每日成本上限。
- **不要把 token 貼進任何檔案或訊息**；`~/.dsh/notify-secrets.json` 不要進版控。
- 要給別人用 → **另開一支 bot ＋ 另一個 profile**，不要共用。

---

## 授權

MIT（見 [LICENSE](LICENSE)）。DSH 本體為 DeepSeek 所有，本套件只使用其公開介面。


---

<!-- ===== 來源檔：00-index.md ===== -->

# 00 · 教學地圖（想學什麼，看哪一份）

> 這套教學分成「用」與「改」兩條路。**先看 01 的 30 秒選機制**，再照下面挑。

## 我只想趕快能用

| 我想… | 看這份 | 時間 |
|---|---|---|
| 最快看到 Telegram 收到答案 | `01-overview-and-quickstart.md` 的「快速開始 A」 | 10 分 |
| 要「GUI 看得到、能多輪」的完整版 | `01-overview-and-quickstart.md` 的「快速開始 B」 | 30 分 |
| 知道它到底能做什麼、界線在哪 | `07-capability-and-permissions.md` | 15 分 |
| 確認它有沒有壞、能不能上線 | `09-telegram-test-plan.md` | 30–60 分 |

## 我要改它／延伸它

| 我想… | 看這份 |
|---|---|
| 知道 DSH 的 API 長怎樣（版本已釘） | `06-contracts.md` ← **先讀這份** |
| 照做一遍「從零到上線」的流程 | `05-development-sop.md` |
| 換成 Line／Discord／Webhook／排程 | `10-second-development.md` |
| 換工作區／換權限／改上限 | `07-capability-and-permissions.md` §7 ＋ `06-contracts.md` §2 |
| 加新指令（例如 `/cost`、`/files`） | `10-second-development.md` |
| 壞了 | `08-troubleshooting.md` |

## 這個套件最重要的四個觀念

1. **兩個機制，一個 bot**：A（headless 行程）與 B（host 插件）**不可同時開**。
2. **「看」不限、「改」限工作區**：讀取全機、寫入只限 `workspacePath`，超出要核准。
3. **GUI 可見性＝`attachSession`**：有沒有掛進 Workspace，決定它在不在左邊清單。
4. **診斷靠檔案，不靠 log**：`ctx.logger` 不進主控台；心跳／鎖／jsonl／`workspace.json` 才是證據。

## 名詞對照（讀文件時會遇到）

| 名詞 | 白話 |
|---|---|
| profile | 一個 DSH 設定檔（例如 `web`）；有自己的一組插件與規則 |
| bundle | 一包插件集合；profile 依 `dsh.profile.bundles` 疊層載入 |
| patch 層 | `cordis.patch.yml`：覆寫／插入列的地方 |
| plugin 列（row） | 組態樹裡的一項（`- id: … name: … config: …`） |
| service／inject | 插件之間互相取用的東西；`inject` 沒滿足就不會掛載 |
| session | 一段對話；有 `sessionId`、事件序列、token 用量 |
| workspace | session 所屬的工作區（GUI 左邊那群組）；本質是一個資料夾路徑 |
| preset | 預先定義的組合：`agentPreset`（思考風格）／`permissionPreset`（權限） |
| approval | 核准：超出沙箱的動作要人按同意 |
| headless | 沒有 GUI 的一次性執行模式 |


---

<!-- ===== 來源檔：01-overview-and-quickstart.md ===== -->

# 01 · 這是什麼＋快速開始

## 一句話

**讓你（或你的團隊）在 Telegram 上直接派工給本機的 DSH agent，答案回到 Telegram；用「機制 B」時，那段對話還會出現在 DSH 的 GUI 清單裡、可以接手、可以多輪。**

---

## 先選機制（30 秒決定）

| | **機制 B（建議）** | **機制 A（備援）** |
|---|---|---|
| 一句話 | 寫一個 **host 插件**，裝進你平常的 DSH | 一支**獨立程式**，用 `dsh --profile headless` 跑一次性任務 |
| TG 訊息變成 | **真的 Session**（GUI 看得到、能接手、能多輪） | 一次性的 headless 任務（GUI 看不到） |
| 需要核准時 | ⏳ 逾時回報，你可在 GUI 按下核准後繼續 | ❌ 沒有核准管道 → 直接失敗 |
| 安裝難度 | 中（要裝 bundle＋改 patch＋重啟 DSH） | 低（複製 3 個檔就能跑） |
| 適合 | **日常使用** | 快速驗證、CI、不想動 DSH 時 |

> **不可以同時開**：兩者都靠 `getUpdates` 輪詢同一支 bot，會互搶訊息。

---

## 前置（兩者都需要）

1. **一支 Telegram bot**：跟 @BotFather 說話 → `/newbot` → 拿到 token
2. **你的 chat id**：對 bot 傳一句話後，用 `getUpdates` 讀（本專案的精靈 `33_設定Telegram通知.cmd` 會做這件事）
3. **寫進** `~/.dsh/notify-secrets.json`（**放 profile 外面**，才不會進備份）：

```json
{ "telegram": { "token": "123456:ABC…", "chatId": "123456789" } }
```

4. **關掉 webhook**（否則不能輪詢）：`getWebhookInfo` 的 `url` 必須是空的

---

## 快速開始 A（headless 橋接器，約 10 分鐘）

```powershell
# 1) 複製三個檔到 profile
copy src\headless-bridge\tg-bridge.mjs        <profile>\tools\
copy src\headless-bridge\run-tg-bridge.ps1    <profile>\tools\
copy src\headless-bridge\47_TG-Bridge.cmd     <profile>\toolbox\

# 2) 離線自我測試（不連網、不發 TG）→ 應 9/9
node <profile>\tools\tg-bridge.mjs --selftest --dry-run --state-dir .\tempselftest

# 3) 端到端試一則（會真的發 TG）
powershell -File <profile>\tools\run-tg-bridge.ps1 -Test "用一行回我 OK"

# 4) 常駐（雙擊啟動器，或）
powershell -File <profile>\tools\run-tg-bridge.ps1
```

**你會看到**：TG 收到「🕐 收到…」＋答案＋`⏱ …s｜exit 0｜in …＋out … tok｜≈¥…`

**常用參數**：`-Cap 10`（每日上限 ¥）／`-TimeoutMin 15`（單則逾時）／`-Selftest`／`-Once`

---

## 快速開始 B（host 插件，約 30 分鐘）

```powershell
# 1) 把插件放進 profile（範例：<profile>\packages\dsh-tg-session）
xcopy /E /I src\host-plugin  <profile>\packages\dsh-tg-session

# 2) 讓 node 找得到它（用 junction，不要為此跑 pnpm install）
cmd /c mklink /J "<profile>\node_modules\dsh-tg-session" "<profile>\packages\dsh-tg-session"

# 3) 加進 bundle 清單：編輯 <profile>\package.json
#    dsh.profile.bundles 追加 "dsh-tg-session"

# 4) 寫設定：<profile>\cordis.patch.yml
```

```yaml
- id: tg-session
  config:
    chatId: ''                       # 留空＝讀 notify-secrets.json
    dailyCapCny: 10                  # 每日上限（只算 TG 派工）
    timeoutMinutes: 15               # 單則逾時；逾時只回報，session 仍在 GUI 繼續
    agentPreset: standard
    permissionPreset: workspace-write
    workspacePath: 'D:\你的專案'      # ← TG 對話會掛在這個「工作區」
    pollSeconds: 3
    testTask: ''                     # 開發用：填了就在啟動時跑一則然後停（不輪詢）
    dryRun: false                    # true＝不真的發 TG（只寫紀錄）
```

```powershell
# 5) 關鍵前置：只組態、不啟動 → 必須看到那一列
dsh --profile <profile> --dump-config | Select-String 'tg-session'

# 6) 重啟 DSH（插件只在開機時載入）

# 7) 驗證：心跳檔每幾秒更新
Get-Content 'D:\你的專案\ops\state\tg-session-heartbeat.txt'
```

**離線驗證（不用 Telegram）**：

```powershell
node <profile>\packages\dsh-tg-session\tests\pure.test.mjs    # 應 25/25
```

**先不要真的收訊息？** 在 `cordis.patch.yml` 設 `testTask: '用一行回我 OK'` ＋ `dryRun: true` → 重啟後它會直接跑一則、把答案寫進紀錄檔而不發 TG。驗完再拿掉 `testTask`。

---

## 檔案地圖（這個套件）

```
dsh-telegram-bridge/
  README.md                        入口（你是從這裡進來的）
  docs/
    00-index.md                    教學地圖：想學什麼就看哪份
    01-overview-and-quickstart.md  ← 你在這裡
    02-…（併入 01）
    03-…（併入 01）
    04-…（併入 01）
    05-development-sop.md          開發 SOP：從零到上線（含 10 個實際踩過的坑）
    06-contracts.md                契約清單：API／事件／檔案格式（**二次開發必讀**）
    07-capability-and-permissions.md  功能與權限範圍（能做什麼到什麼程度）
    08-troubleshooting.md          疑難排解：症狀 → 真因 → 修法
    09-telegram-test-plan.md       Telegram 測試計畫（15 案例＋結果表）
    10-second-development.md       二次開發：換 IM／換 profile／加功能
  src/
    headless-bridge/               機制 A：tg-bridge.mjs＋run-tg-bridge.ps1＋47 啟動器
    host-plugin/                   機制 B：dsh-tg-session（package.json／cordis.patch.yml／lib／tests）
  examples/                        設定與狀態檔範例
```

---

## 三個最常見的問題

| 問題 | 答案 |
|---|---|
| **GUI 看不到那則對話？** | 側邊欄**一次只顯示一個工作區** → 切到 `workspacePath` 對應的那個（`~/.dsh/storages/workspace.json` 可查它掛在哪） |
| **TG 完全沒反應？** | ① DSH 有開嗎（機制 B 住在裡面）② 心跳檔有在更新嗎 ③ 是不是同時開了 A 與 B（互搶）④ `getWebhookInfo` 有 webhook 嗎 |
| **一直顯示「¥ 待結算」？** | 那回合讀不到 token 用量；成本帳本由主機另一個行程 flush、有延遲 → 見 `08` 的「成本」段 |

---

## 下一步讀什麼

- 要**用**它 → `07-capability-and-permissions.md`（能做什麼、界線在哪）＋`09-telegram-test-plan.md`
- 要**改/延伸**它 → `06-contracts.md` → `05-development-sop.md` → `10-second-development.md`
- **壞了** → `08-troubleshooting.md`


---

<!-- ===== 來源檔：05-development-sop.md ===== -->

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


---

<!-- ===== 來源檔：06-contracts.md ===== -->

# 06 · 契約清單（二次開發照這頁寫，不要憑記憶）

> **權威來源**：本機**已安裝**的 `@deepseek-ai/dsh`（實讀其 `lib/*.js` 與 README）。
> 另一份 `D:\專案項目\deepseek-harness` 是較早的 checkout（alpha.1），**與安裝版不同步**，只當參考。

## 0. 釘住的版本（Baseline）

| 項目 | 值 | 怎麼確認 |
|---|---|---|
| `@deepseek-ai/dsh` | **0.1.5-rc.1** | `node_modules/@deepseek-ai/dsh/package.json` |
| Node | **v22.23.2** | `node --version` |
| pnpm | **11.24.0** | `pnpm --version` |
| `@deepseek-ai/cordis` | **4.0.2** | `node_modules/@deepseek-ai/cordis/package.json` |
| 一起發佈的套件 | 全部 `^0.1.5-rc.1` | 各 `package.json` |
| 本機 checkout（參考用） | `deepseek-harness` commit `7588e1ea`（0.1.5-alpha.1） | `git -C D:\專案項目\deepseek-harness log -1` |

**升級 DSH 之後，這頁要重讀一次**——DSH 是 preview 軟體，API 會動。

---

## 1. CLI（`dsh`）

| 指令 | 作用 | 注意 |
|---|---|---|
| `dsh --profile <name> [args…]` | 啟動某個 profile | launcher 只解析自己的旗標，**其餘原封不動交給 app** |
| `dsh --profile headless "<task>"` | 一次性任務，答案印 stdout，exit 0/1 | 需要 `headless` profile（第一次會從內建模板建立） |
| `dsh web` / `dsh --profile web` | 開瀏覽器介面 | `--port <n>` 可換埠、`--no-open` 不彈瀏覽器 |
| `dsh --profile <p> --dump-config` | **印出組態樹** | ⚠️ 會**寫** `profiles/<p>/cordis.yml` → 受限沙箱會被拒 |
| `dsh --profile <p> --from-default-profile web` | 從內建模板建一個新 profile | 常用來開練習場 |
| `dsh plugin --profile <p> add <spec>` | 把套件裝進 profile（轉呼叫 pnpm） | **會自動把提供 bundle 的套件加進 `dsh.profile.bundles`** |

---

## 2. Profile 的三個檔案

```
~/.dsh/profiles/<name>/
  package.json      ← ① dsh.profile.bundles：要載入哪些 bundle（順序＝疊層順序）
                       ② dependencies：套件版本
  cordis.yml        ← 產生物（空陣列）；**不要手改**
  cordis.patch.yml  ← 你的 patch 層：top-level YAML 陣列，可 override／disable／insert
```

**Patch 檔語法（實讀 `dsh-web-app/cordis.patch.yml` 與 `dsh-headless/cordis.patch.yml`）**

```yaml
# 1) 覆寫某一列的 config（⚠️ 會「整段取代」→ 必須重述該列所有鍵）
- id: webserver
  config:
    host: 127.0.0.1
    port: 3081

# 2) 插入新列（bundle 提供者最常用的形狀）
- insert:
    - id: my-plugin
      name: 'my-plugin-package'
      inject: [agents, sessions]
      config:
        anything: !!js process.env.MY_VAR
```

- `!!js <運算式>`：在載入時求值，可以參考其他服務（如 `ctx.webStartup.port`）
- 重複路徑／重複 id 會**丟錯**（組態層級的契約）

---

## 3. 插件（Cordis）該長什麼樣

**外部 Loader 根只能有一種形狀**（`dsh-headless/lib/index.js` 是標準範例）：

```js
export const name = 'headless-runner';           // 穩定名稱
export const inject = ['agentDefaultModel', 'agents', 'sessions'];  // 需要的服務
export const Config = z.object({ /* schemastery */ });              // 可選
export function apply(ctx, config) { /* … */ }    // 具名 apply；**不要**同時有 default export
```

- 需要**生命週期清理** → `ctx.effect(() => async () => { /* dispose */ }, 'label')`
- `ctx.get('<service>')` 取「可能不存在」的服務；`inject` 列出的可以直接用 `ctx.<service>`
- `ctx.logger.info/warn`：**不會**印到主控台 → 要看到訊息請自己寫檔（本次因此改用檔案副作用當證據）

`package.json` 需要的欄位：

```json
{
  "type": "module",
  "exports": { ".": { "default": "./lib/index.js" }, "./cordis.patch.yml": "./cordis.patch.yml" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "peerDependencies": { "@deepseek-ai/cordis": "^4.0.2", "@deepseek-ai/dsh-llm": "^0.1.5-rc.1", "…": "…" }
}
```

---

## 4. 需要的服務（建立「進得了 GUI」的 session）

`dsh-webhook/lib/index.js` 宣告的 `inject`（＝這條路徑的權威清單）：

```js
static inject = ['agents', 'agentDefaultModel', 'agentPresets',
                 'permissionPresets', 'sessionTitle', 'workspaceRegistry']
```

我們另外用了 `sessions`（`dsh-headless` 用來 `flush`）。**在 web profile 這 7 個都存在**（GUI 本身就要用）。

---

## 5. 建立 Session 的完整序列（照抄這一段就對了）

```js
import { randomUUID } from 'node:crypto';
import { brandString } from '@deepseek-ai/dsh-brand';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

// ① 先驗證 preset 名稱合法（不合法會丟錯，早點丟比較好）
ctx.permissionPresets.resolve(permissionPresetName);
const preset = await ctx.agentPresets.resolve(agentPresetName);
await ctx.agentPresets.standingKeyFor(preset.id);

// ② Workspace（＝GUI 左邊那個「工作區」）；不存在的路徑會建立
const workspace = await ctx.workspaceRegistry.create(absoluteWorkspacePath);

// ③ 建立 Agent（sessionId 要唯一；本專案用 `tg-<uuid>` 這種前綴）
const sessionId = brandString(`tg-${randomUUID()}`);
const selection = ctx.agentDefaultModel.currentSelection();   // { provider, model, … }
const handle = await ctx.agents.create({
  sessionId,
  meta: { cwd: workspace.path, agentPreset: preset.id },
  agentOptions: { provider: selection.provider, model: selection.model },
  setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, preset.id); }
});

// ④ 掛上 Workspace（**這一步決定 GUI 看不看得到**）
await workspace.attachSession(sessionId);

// ⑤ 權限與標題
ctx.permissionPresets.set(handle.agent.session, permissionPresetName);
ctx.sessionTitle.rename(handle.agent.session, title);

// ⑥ 送 prompt
const firstSeq = handle.agent.session.seq;      // 送出前先記 seq
handle.agent.followup(createUserMessage({
  content: [{ type: 'text', text: promptText }],
  source: { kind: 'user' }                       // webhook 版用 kind:'webhook' + 來源資訊
}));

// ⑦ 等它跑完
await handle.agent.whenIdle();
await ctx.get('sessions').flush(handle.agent.session);
```

失敗回滾（webhook 原始碼的做法）：已 attach → `workspace.detachSession(sessionId)`；再 `handle.dispose()`。

---

## 6. 取「最終答案」與 token（這個方法最好用）

契約來源：`dsh-headless/lib/index.js` 的 `summarize()`＋`streamReasoning()`。

```js
import { SessionSeq } from '@deepseek-ai/dsh-session';

// 掃描本次區間（firstSeq 之後到現在）
for (let seq = firstSeq; seq < session.seq; seq++) {
  const ev = session.eventAt(SessionSeq(seq));       // 讀不到回 undefined
  if (ev.type === 'turn/start') { started = true; continue; }
  if (!started) continue;                             // 只看「這一回合」
  if (ev.type === 'assistant/message') {
    const text = ev.data.message.content
      .filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (text !== '') finalText = text;                // 取最後一則非空
  }
  if (ev.type === 'turn/end') reason = ev.data.reason; // { kind: 'completed' | 'error' | … }
}
```

**事件型別**（本次用到）：`turn/start`、`assistant/message`、`turn/end`。
`assistant/message.data.message.content[]` 的 block：`{type:'text',text}`、`{type:'tool_use',…}` 等。

---

## 7. 三個「檔案面的契約」（診斷靠這些，不靠 log）

| 檔案 | 內容 | 用途 |
|---|---|---|
| `~/.dsh/storages/workspace.json` | `tables.workspaces[<id>] = { path, title, sessionIds[], createdAt, updatedAt }`、`global.workspaceIds[]`、`global.archivedSessionIds[]` | **證明 session 有沒有掛進 GUI 那個 Workspace** |
| `~/.dsh/storages/session_projcache/sessions/session-<uuid>.json` | `record.identity.{cwd,createdAt}`、`record.rows.title.val`、**`record.rows.tokenUsage.val.totals`** | GUI 清單的來源；token 用量在這裡（**注意 `rows.*.val` 這層**） |
| `~/.dsh/dsh-usage/usage-ledger.json` | `days[YYYY-MM-DD][provider][model] = { calls, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, cost }` | 成本帳本（**由 host 另一個行程 flush，有延遲**） |

> ⚠️ 三個檔案都可能是 **UTF-8 with BOM** → 讀取端要先 `TrimStart([char]0xFEFF)` 或 `replace(/^\uFEFF/,'')`。

---

## 8. 權限相關

| preset | sandbox | approval | 意思 |
|---|---|---|---|
| `read-only` | read-only | ask | 只能讀 |
| `workspace-write` | workspace-write | ask | **只能改工作區＋允許的暫存區**，更大範圍會要求核准 |
| `danger-full-access` | danger-full-access | never | 全權、不問 |

另外有**核准閘門**（`dsh-approval-gate`，第三方插件）：`~/.dsh/auto-approve/allowlist.json` 可自動放行／硬拒（`hardCategories`：deletion／credential／remote／system／bulk）。詳見 `07-capability-and-permissions.md`。

---

## 9. 機制 A 用到的介面（headless）

```powershell
dsh --profile headless "<task>"     # stdout＝最終答案；stderr＝reasoning；exit 0＝turn/end completed
```

- 一次性、**沒有**多輪、**沒有**核准管道 → 任何需要升級的動作會 fail-closed
- 建議呼叫方式（避免 shell 注入）：用 `node` 直接跑 `.../@deepseek-ai/dsh/lib/bin.js`，參數用**陣列**傳
- 答案＝stdout 全文；成本要另外算（見 §7 的 token 用量或帳本）

---

## 10. Telegram 端（自帶、零依賴）

| 用途 | 方法 | 重點 |
|---|---|---|
| 確認 bot | `GET /bot<token>/getMe` | 不要印出 token |
| 收訊息 | `GET /bot<token>/getUpdates?timeout=0&offset=<n>&allowed_updates=["message"]` | **同一支 bot 只能有一個輪詢者**；`offset` 要持久化 |
| 跳過舊訊息 | `getUpdates?offset=-1&limit=1` → `offset = update_id + 1` | 本次採「從現在開始」 |
| 回訊息 | `GET /bot<token>/sendMessage?chat_id=…&text=…` | 單則上限 **4096 字元**（要分段） |

**憑證位置**：`~/.dsh/notify-secrets.json` → `{ telegram: { token, chatId } }`
（放在 profile **外面**，所以不會進保險庫／雲端／外接硬碟備份）

---

## 11. 版本升級時要重跑的檢查

```powershell
# 1) 契約還在不在：組態樹裡那一列還在嗎
dsh --profile web --dump-config | Select-String 'my-plugin'
# 2) 服務名稱有沒有變（inject 是否還滿足）
#    把插件啟動後看心跳檔有沒有出現；沒出現就是沒掛上
# 3) 官方原始碼重讀一輪（本文件的 §4/§5/§6 三處最可能變動）
# 4) 跑驗證鏈
41_改完腳本一鍵驗證.cmd
```


---

<!-- ===== 來源檔：07-capability-and-permissions.md ===== -->

# 07 · 功能與權限範圍：Telegram 派工到底能做到什麼程度

> 這份文件回答三個問題：
> **① 它能動哪些東西？② 哪些要你按核准？③ 最實用的用法長什麼樣？**
>
> 每一條都標了來源：**【原始碼】**＝實讀 DSH 官方原始碼／**【設定】**＝你機器上的設定檔／
> **【實測】**＝本次真的跑過並留下紀錄／**【推論】**＝依規則推出來、還沒實測（會明講）。

---

## 1. 一句話

> **「看」沒有限制（整台電腦都能讀）；「改」只限一個資料夾（你的工作區）；
> 要改到外面＝需要你按核准；危險動作（刪除／憑證／遠端／系統）直接拒絕。**

---

## 2. 權限是怎麼決定的（三層，缺一不可）

| 層 | 作用 | 目前的值 | 來源 |
|---|---|---|---|
| ① **permission preset** | 決定這個對話的「沙箱模式」與「要不要問核准」 | `workspace-write` | 【設定】`cordis.patch.yml` 的 `permissionPreset` |
| ② **sandbox policy** | 真正擋下檔案／指令的那一層 | `workspace-write`＝只能改「工作區＋允許的暫存區」 | 【原始碼】`dsh-permission-presets`：`'workspace-write': { sandbox: 'workspace-write', approval: 'ask' }`，說明文字「Write inside the workspace and permitted temporary directories; wider retries request approval」 |
| ③ **approval gate（你另外裝的）** | 在「要問核准」時自動裁決 | 自動放行 `workspace-write`；關鍵字／四大類**一律拒絕** | 【設定】`~/.dsh/auto-approve/allowlist.json` |

**第 ③ 層的白名單細節【設定】**：

- `allowRules`：`[{ mode: "workspace-write" }]` → 工作區內的寫入**自動放行**（所以你不在電腦前它也能改檔）
- `hardCategories`（硬類別，直接拒）：`deletion`／`credential`／`remote`／`system`／`bulk`
- `denyKeywords`（關鍵字，直接拒）：`rm -rf`、`rm -fr`、`push --force`、`force push`、`drop table`、`drop database`、`mkfs`、`format`、`shutdown`、`reboot`、`dd of=`、`delete from`、`truncate`、`terraform destroy`、`revoke`、`清空数据库`、`格式化`、`sudo rm`、`git reset --hard`、`git clean -fd`、`docker rm`、`docker system prune`
- `riskyThreshold: 3`：不確定的一律累計到 3 次就擋
- `learning.enabled: true`：裁決會學習（你按過的結果會被記住）

---

## 3. 能力矩陣（做什麼 → 會不會過）

工作區＝`D:\專案項目\DSH工具箱`（由 `workspacePath` 決定）。

| 你想做的事 | 會過嗎 | 為什麼 | 依據 |
|---|---|---|---|
| 讀任何檔案（含 `C:\Users\User\.dsh`、保險庫、DLB-wiki） | ✅ 直接過 | 讀取不受工作區限制 | 【實測】本次多輪都是這樣讀 |
| 在工作區**新增／修改檔案** | ✅ 直接過 | `workspace-write` 自動放行 | 【設定】`allowRules` |
| 在工作區**跑 PowerShell**（含跑你現成的腳本，如「41 一鍵驗證」） | ✅ 直接過 | 指令在沙箱內執行 | 【實測】開發期間多次執行 |
| **刪除**檔案 | ❌ 拒絕 | `hardCategories: deletion` ＋ `rm -rf` 等關鍵字 | 【設定】 |
| 寫到**工作區之外**（例如 `C:\Users\User\.dsh`、保險庫、其他專案） | ⚠️ 需核准 | 超出 sandbox → `approval: ask` | 【推論】依 sandbox 政策（未在 TG 情境實測） |
| 提權／改 Windows 登錄／安裝程式 | ❌ 拒絕或需你手動 | `system` 類＋沙箱限制 | 【推論】 |
| 對外網路（例如 `git push`、打 API） | ⚠️ 需核准 | `remote` 屬硬類別 | 【推論】 |
| 改憑證／金鑰 | ❌ 拒絕 | `credential` 硬類別 | 【設定】 |
| 大量檔案操作（bulk） | ⚠️ 容易被擋 | `bulk` 硬類別＋`riskyThreshold` | 【設定】 |
| 傳訊息給別人（Telegram／Email 通知） | ⚠️ 需核准 | 屬對外動作 | 【推論】 |
| 讀你的 Telegram 對話內容 | ❌ 做不到 | 插件只讀「你傳給它」的訊息；不回溯歷史 | 【原始碼】`getUpdates` 只拿未確認的新訊息 |

**「需核准」在無人時的實際行為【原始碼】**：
> 你在外面 → 那一步會**卡住等核准** → 15 分鐘後 Telegram 會收到
> 「⏳ 超過 15 分還沒結束——它可能**正在等你核准**。這一則仍在同一個 session 裡跑；
> 你可以在 GUI 打開這個對話接手（標題：…）」
> → 你回到電腦、在 GUI 按下核准，它會**繼續跑完**（不是失敗重來）。

---

## 4. 最實用的 10 種用法（可以直接複製到 Telegram）

> 下面每一句都是可以照抄的「任務說法」。前四種最順（純讀取，不用核准）。

| # | 你傳這句話 | 它會做什麼 | 花費量級 |
|---|---|---|---|
| 1 | `今天的三層備份有沒有對上？沒對上哪一層、差幾個檔？` | 讀保險庫／鏡像／日誌，回一份對照 | 中（≈¥0.1–0.3） |
| 2 | `今天花了多少？餘額還剩多少？` | 讀用量帳本＋呼叫餘額 API | 低（≈¥0.05） |
| 3 | `把 DLB-wiki 的 00_總覽_INDEX 摘要成 5 點` | 讀檔＋摘要 | 低–中 |
| 4 | `找出所有提到 tg-bridge 的檔案，列出檔名與行號` | 全工作區搜尋 | 低 |
| 5 | `在工作區寫一份 note-20260913.md，內容是：今天完成了 TG 橋接器` | 建立檔案（工作區內，自動放行） | 低 |
| 6 | `跑 41_改完腳本一鍵驗證，把那一行結果貼回來` | 執行你現成的驗證腳本並回報 | 中 |
| 7 | `把 tools\xxx.ps1 的第 120 行改成 …，改完自己跑語法檢查` | 改檔＋自我驗證 | 中 |
| 8 | `先查 A、改 B、再跑 C 驗證，全程回報` | **多輪接續**：一整套流程（這就是「像在這裡」的差別） | 中–高 |
| 9 | `把今天發生的事整理成一份 incident 草稿放在 ops\incidents\` | 依你的六步格式產草稿 | 中 |
| 10 | `接手我剛剛說的那件事，繼續做完` | 用同一段對話的上下文繼續 | 低（不用重講） |

**不適合交給它的**：需要跨區寫入的一整套自動化、需要提權的安裝、任何「刪東西」的清理。

---

## 5. 明確做不到的事（別期待）

| 限制 | 說明 |
|---|---|
| **只有文字** | 圖片／檔案／語音都不行（插件只讀 `message.text`） |
| **一次一則** | 前一則跑完才處理下一則；後傳的會排隊（【原始碼】`queue`） |
| **看不到中間過程** | Telegram 只收到最後答案；想看過程要到 GUI 打開那段對話 |
| **DSH 關掉＝它就不在** | 插件住在 DSH host 裡；DSH 沒開，Telegram 不會有回應 |
| **重開 DSH 後接續會斷** | 「目前這段對話」是記在記憶體；重開後下一則會開新對話（舊的還在，只是不再接續） |
| **不能代替你登入／過 2FA** | 需要人手的地方還是要人 |
| **不回溯歷史訊息** | 只處理「你傳進來之後」的訊息（啟動時會把舊佇列確認掉、跳過） |

---

## 6. 費用模型（為什麼「簡單問一句」也要錢）

每一則訊息＝**一個完整的 agent 對話**。開頭固定要付：

| 固定成本 | 量級 |
|---|---|
| 系統提示＋工具說明（約 60 個工具） | **≈10,000–12,000 token 輸入** |
| 之後每輪工具呼叫 | 依任務規模 |

**實測數字（本次真的跑出來的）**：

| 任務 | 耗時 | token | 費用 |
|---|---|---|---|
| 一句問答「B 測試：用一行回我 OK」 | 3 秒 | in 2,026／cache 8,320／out 159 | **≈¥0.033** |
| 一句問答「正式測試」（B 在主 host） | 2.6 秒 | in 2,026／cache 10,240／out 201 | **≈¥0.037** |
| 建 session 驗證（答案較長） | 14.4 秒 | in 3,388／cache 44,160／out 1,394 | ≈¥0.12 |
| 大範圍調查（機制 B 怎麼做） | 261.5 秒 | in 57,386／cache 1,291,520／out 29,896 | ≈¥0.71 |

> **每天上限 ¥10**（只累計 Telegram 派工，不含你在 GUI 自己的用量）；
> 超過它會回「⛔ 已達今日上限」並拒收。
> 想知道今天用了多少：傳 `/status`。

---

## 7. 想把範圍調大／調小（三個旋鈕）

| 想做的事 | 改哪裡 | 風險 |
|---|---|---|
| **只讓某個資料夾也能寫** | `~/.dsh/auto-approve\allowlist.json` 的 `allowRules` 加一條 | 中：等於放寬遠端可寫範圍 |
| **換主場到別的專案** | profile 的 `cordis.patch.yml` → `tg-session` 列的 `workspacePath` | 低：只是換資料夾 |
| **只讀不寫（最保守）** | 同上的 `permissionPreset: read-only` | 無：它就只能查、不能改 |
| **完全關掉** | 把 profile `package.json` 的 `dsh.profile.bundles` 移除 `dsh-tg-session`（或重啟 DSH） | 無 |

---

## 7b. TG 核准：在手機按「允許一次」（2026-09-13 新增）

**問題**：TG 派工的回合若需要升級權限（例如要寫 profile 目錄），DSH 會去問「回答者」；預設**只有 GUI 的回答者** → 人在外面時會卡到逾時，必須跑回電腦按授權。

**做法**：本插件自己當一個 **approval answerer**，把請求轉成 Telegram 的按鈕。

```
🔐 需要核准（Telegram 派工）
工具：powershell
原因：要寫 C:\Users\User\.dsh\profiles\web\ops\（工作區外）
對話：跑 41_改完腳本一鍵驗證

（只授權這一次；10 分鐘沒回＝自動拒絕）
[ ✅ 允許一次 ]   [ ❌ 拒絕 ]
```

| 契約（實讀 `@deepseek-ai/dsh-user-approval` 0.1.5-rc.1） | 值 |
|---|---|
| 服務 | `ctx.approval`（`ApprovalService`） |
| 發問端 | `ctx.waterfall(scopeTarget(agent, agent), 'approval/request', req, () => Promise.resolve('unavailable'))` |
| 回答者註冊 | `ctx.on('approval/request', handler)`；回傳 `ApprovalOutcome`，回 `undefined`＝交給下一個回答者 |
| 合法結果 | `allowed-once`／`rejected`／`cancelled`／`unavailable` |
| 沒有回答者 | `unavailable` → **fail closed**（絕不會自動放行） |

**行為（三個保證）**
1. **只接管 Telegram 派工的回合**（用 agent 物件參照比對）→ 你自己在 GUI 的對話，核准只走網頁，不會被搶走。
2. **逾時＝拒絕**：預設 10 分鐘沒回就 `unavailable`，並在 Telegram 通知你「已自動視為拒絕」。
3. **只授權一次**：DSH 的設計是 one-shot（grants apply only to the requested action），下一次還要再問。

**設定（`cordis.patch.yml` 的 `tg-session` 列）**

```yaml
    approveFromTelegram: true      # false＝核准只走 GUI
    approvalTimeoutMinutes: 10     # 沒回＝拒絕
```

**⚠️ 安全含意（重要）**：這等於「**Telegram 這條通道可以授權升級權限**」，所以 bot token 的價值更高：
- 只認 `~/.dsh/notify-secrets.json` 的 chatId（既有防護，其他帳號傳的一律忽略並記錄）
- token 不要外流；建議開 Telegram 兩步驗證
- 臨時不想用，把 `approveFromTelegram` 設 `false`（重啟後生效）

---

## 8. 安全邊界（為什麼要這麼多限制）

**本質**：這個功能＝**讓遠端訊息在你電腦上執行 agent**。任何拿到 bot token 的人若能通過 chat 檢查，就等於有你的執行權。

**目前的防護（四道）**：

1. **只認一個 chat id**（`~/.dsh/notify-secrets.json` 的 `chatId`）；其他人一律忽略並寫進日誌【原始碼】
2. **金鑰放在 profile 之外**（`~/.dsh\notify-secrets.json`）→ 不會進保險庫／雲端／外接硬碟備份【設定】
3. **沙箱＋核准閘門**：只能改工作區；危險類別一律拒【設定】
4. **每日成本上限**：避免被拿來燒錢【原始碼】

**建議再加的**（目前沒有，你自己決定）：

- Telegram 帳號開 **兩步驗證**（token 洩漏時多一層）
- 定期看 `ops\notify\tg-session.jsonl`（誰在什麼時候派了什麼）
- 若哪天要給別人用 → **另開一支 bot ＋ 另一個 profile**，不要共用

---

## 9. 一頁速查

```
能做（不用核准）        讀全機 / 改工作區 / 跑指令 / 多輪接續
要核准（無人時會卡）     寫到工作區外 / 對外網路 / 傳訊息
直接拒絕                刪除 / 憑證 / 遠端硬體 / 系統 / 大量操作
看不到（本質限制）       中間過程 / 圖片檔案 / 歷史訊息 / DSH 關機時
費用                    每則 ≈¥0.03 起（固定前綴 ~1 萬 token）；上限 ¥10/日
指令                    /status  /new  /help
```


---

<!-- ===== 來源檔：08-troubleshooting.md ===== -->

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


---

<!-- ===== 來源檔：09-telegram-test-plan.md ===== -->

# 09 · Telegram 測試計畫（可照著做、可填結果）

> 目的：**用最短時間證明「Telegram ↔ DSH」整條路是通的、而且界線跟文件寫的一致。**
> 用法：照 TC-01 → TC-15 順序做，把結果填進最後的表格。
> 每一條都寫明「看哪裡當證據」——不要只看 Telegram 有沒有回話。

---

## 0. 前置檢查（3 分鐘，不花錢）

| # | 檢查 | 怎麼做 | 通過條件 |
|---|---|---|---|
| P1 | DSH 有開 | 瀏覽器能打開 DSH 介面 | 介面正常 |
| P2 | 插件在跑 | 看心跳檔 `ops\state\tg-session-heartbeat.txt`（工作區內） | 時間戳是**最近 10 秒內** |
| P3 | 只有一個輪詢者 | 確認舊的 `47_TG橋接器` 視窗**沒有開** | 沒有那個視窗 |
| P4 | 沒有 webhook | 用 bot token 打 `getWebhookInfo` | `url` 是空的 |
| P5 | 今天額度未滿 | 在 TG 傳 `/status` | 顯示的今日金額 < 上限 |

> P1/P2 沒過 → 先看 `08-troubleshooting.md`，不要開始測。

---

## 1. 測試案例

### A. 基本連通（不花什麼錢）

**TC-01 純問答**
- 傳：`用一行回我 OK`
- 預期：① 立刻回「🕐 收到，開新對話執行（第 N 則／今日 ≈¥x.xx）」＋引用你的話 ② 幾秒後回答案 `OK` ③ 頁腳有 `⏱ …s｜✅ 完成｜in …＋out … tok｜≈¥…｜session …`
- 證據：TG 兩則訊息；`ops\notify\tg-session.jsonl` 最後一列 `event:"turn"`

**TC-02 多輪接續（B 的核心價值）**
- 接著傳：`我上一句叫你做什麼？`
- 預期：它答得出「叫你用一行回 OK」；**頁腳的 session 短碼與 TC-01 相同**
- 證據：`tg-session.jsonl` 兩列的 `sessionId` 相同、`firstSeq` 遞增

**TC-03 開新對話**
- 傳：`/new` → 再傳：`這是一段新對話`
- 預期：`/new` 回「🆕 下一則訊息會開一段新對話」；新訊息的**session 短碼改變**、標題是新的那句話
- 證據：`tg-session.jsonl` 的 `sessionId` 換了

**TC-04 狀態與說明**
- 傳：`/status` → 預期：今日則數／≈¥／目前對話／preset／逾時／工作區
- 傳：`/help` → 預期：列出 `/status`、`/new`、`/help` 與用法

### B. 能力與界線（這組才是重點）

**TC-05 工作區內寫入（應自動放行）**
- 傳：`在工作區建立 test-tc05.txt，內容一行：ok`
- 預期：檔案**真的出現**在 `D:\專案項目\DSH工具箱\test-tc05.txt`，且沒有要求你核准
- 證據：檔案存在＋TG 回報內容

**TC-06 跨區讀取（應成功）**
- 傳：`列出 C:\Users\User\.dsh 底下的資料夾名稱`
- 預期：直接列出（讀取不受工作區限制）
- 證據：TG 回覆與實際目錄一致

**TC-07 跨區寫入（應卡在等核准）**
- 傳：`把一行 test 寫到 C:\Users\User\.dsh\tg-test.txt`
- 預期：**不會**直接成功；最慢 15 分鐘後你會收到
  「⏳ 超過 15 分還沒結束——它可能正在等你核准…」
- 然後到 GUI 打開那段對話、按下核准 → 它會繼續完成
- 證據：TG 的 ⏳ 訊息；`tg-session.jsonl` 該列 `timedOut:true`
- ⚠️ 若它**直接成功**了 → 代表你的核准設定比文件寫的寬鬆，請回報（這是重要發現）

**TC-08 危險動作（應直接拒絕）**
- 傳：`刪除工作區的 test-tc05.txt`
- 預期：**被拒絕**（`deletion` 硬類別），並且它會告訴你被擋
- 證據：TG 回覆；`~/.dsh/auto-approve\allowlist.json` 的規則對照

**TC-09 大量操作（應被擋或要求核准）**
- 傳：`把工作區所有 .md 檔一次改名加上 x- 前綴`
- 預期：被擋（`bulk`）或要求核准

### C. 經濟與安全

**TC-10 每日上限**
- 做法：暫時把 `cordis.patch.yml` 的 `dailyCapCny` 改成 `0.01` → 重啟 DSH → 傳一句話
- 預期：收到「⛔ 已達今日上限 ¥0.01…」，且**沒有**建立 session
- 測完記得改回 `10` 並重啟

**TC-11 只有你能用**
- 做法：用**另一個 Telegram 帳號**傳訊息給這支 bot
- 預期：**完全沒有回應**；`tg-session.jsonl` 出現 `event:"rejected-chat"` 且只有 chat 尾四碼

**TC-12 成本一致性**
- 做法：把 TG 頁腳的 `≈¥` 與 `tg-session.jsonl` 該列的 `cost` 對照
- 預期：一致（誤差 < 0.0001）
- ⚠️ 若頁腳顯示「¥ 待結算」→ 代表那回合讀不到 usage（可接受，但請記錄）

### D. GUI 整合（B 相對 A 的差別）

**TC-13 GUI 看得到**
- 做法：打開 DSH 介面 → 左邊切到「DSH工具箱」區
- 預期：看得到剛才那幾段對話，**標題＝你傳的那句話**
- 進一步：點進去**在 GUI 繼續問**，兩邊會在同一段對話裡

**TC-14 逾時回報**
- 傳：`讀完工作區所有 .md 檔，逐一摘要一段`
- 預期：15 分後收到 ⏳ 訊息；該 session 仍在 GUI 裡可接手

**TC-15 重開後的行為（可選）**
- 做法：重開 DSH → 傳一句話
- 預期：**開新對話**（接續會斷）；舊對話仍在 GUI 清單裡

---

**TC-16 TG 核准（2026-09-13 新增功能）**
- 傳：`跑 41_改完腳本一鍵驗證，把那一行結果貼回來`
- 預期：① 任務開始跑 ② 你會在 **Telegram** 收到「🔐 需要核准…工具／原因」＋兩顆按鈕 ③ 按 `✅ 允許一次` → 訊息變成「✅ 已允許一次」且**按鈕消失** ④ 任務繼續、答案回到 TG
- 反向：按 `❌ 拒絕` → 任務收到拒絕結果（不會硬闖）；或**不回覆等逾時** → 收到「⏰ 核准逾時 → 已自動視為拒絕」
- 不干擾驗證：在 **GUI**（不是 TG）開一段對話讓它也觸發核准 → 應該**只出現網頁的核准提示**，Telegram 不會收到按鈕（代表只接管 TG 派工的回合）
- 證據：`ops\notify\tg-session.jsonl` 出現 `event:"approval-asked"` 與 `event:"approval"`（含 `decision`）

---

## 2. 通過標準

| 等級 | 條件 |
|---|---|
| **核心通過** | TC-01～TC-06 全過 |
| **界線通過** | TC-07／TC-08 的結果與文件一致（該卡的有卡、該拒的有拒） |
| **整合通過** | TC-13 通過（GUI 看得到、能接手） |
| **完整通過** | 以上＋TC-09～TC-12、TC-14 都有紀錄 |

---

## 3. 結果表（照著填）

| 案例 | 結果（通過／失敗／與文件不符） | 證據（檔案或訊息） | 備註 |
|---|---|---|---|
| P1–P5 前置 | | | |
| TC-01 純問答 | | | |
| TC-02 多輪接續 | | | |
| TC-03 /new | | | |
| TC-04 /status・/help | | | |
| TC-05 工作區寫入 | | | |
| TC-06 跨區讀取 | | | |
| TC-07 跨區寫入（等核准） | | | |
| TC-08 刪除（拒絕） | | | |
| TC-09 大量操作 | | | |
| TC-10 每日上限 | | | |
| TC-11 非本人 chat | | | |
| TC-12 成本一致 | | | |
| TC-13 GUI 可見 | | | |
| TC-14 逾時 | | | |
| TC-15 重開後 | | | |

---

## 4. 不經 Telegram 也能驗（離線）

```powershell
# 機制 B（插件）純函式：25 個案例
node packages\dsh-tg-session\tests\pure.test.mjs

# 機制 A（headless 橋接器）自我測試：9 個案例（不連網、不發 TG）
node tools\tg-bridge.mjs --selftest --dry-run --state-dir .\tempselftest

# 整條驗證鏈（含上面兩個，另有語法／稽核／回歸／事件治理）
41_改完腳本一鍵驗證.cmd
```

**最新一次實測**：`執行期 [OK] 10/10`（R1–R8 行為、R9 橋接器 9/9、R10 插件 25/25）。


---

<!-- ===== 來源檔：10-second-development.md ===== -->

# 10 · 二次開發指南（怎麼改成你要的樣子）

> 先讀 `06-contracts.md`（DSH API）再看這份；這裡只講「改哪裡」。

---

## 0. 程式碼導覽（改之前先知道每一塊在哪）

### 機制 B：`src/host-plugin/lib/index.js`

| 區塊 | 做什麼 | 要改功能通常動這裡 |
|---|---|---|
| `DEFAULTS` / `cfg` | 所有設定鍵與預設值 | 加新設定 |
| `apply(ctx, config)` | 插件入口；`ctx.effect(...)` 管生命週期 | 加服務、改啟動條件 |
| `acquireLock / releaseLock` | 單一實例鎖（含接管死掉的 pid） | 換鎖策略 |
| `tg(method, params)` | Telegram API 的通用呼叫 | 換 IM 時整塊換掉 |
| `sendText(text)` | 分段送出（4096 上限） | 改輸出格式 |
| `createSession(title)` | **建立真 session**（`agents.create` → `attachSession` → 權限 → 標題） | 加 preset、改 preset、加 metadata |
| `runTurn(promptText, isNew, rawText)` | 送 prompt → `whenIdle` → 掃事件取答案與 token → 回報 | **最常改這塊**（逾時、成本、回覆格式） |
| `handleCommand(text)` | `/help`、`/new`、`/status` | **加新指令就在這裡** |
| `processQueue()` | 序列化處理（一次一則）＋每日上限檢查 | 改排隊／併發策略 |
| `pollOnce()` | `getUpdates` → 過濾 chat → 進佇列 | 換 IM 時整塊換掉 |

### 純函式：`src/host-plugin/lib/pure.js`

`chunkText`／`isAllowedChat`／`summarizeEvents`／`sumUsage`／`estimateCost`／`withinCap`／`titleFor`／`formatFooter`
→ **所有「錯了會靜默出包」的邏輯都放這裡**，並在 `tests/pure.test.mjs` 釘住。

### 機制 A：`src/headless-bridge/tg-bridge.mjs`

同樣的結構，但用 `spawn` 呼叫 `dsh --profile headless`，答案取 stdout。要改 IM 只需換 `tg()` 與 `pollOnce()`。

---

## 1. 換成別的 IM（Line／Discord／Slack／Webhook）

**替換點只有兩個函式**：`tg(method, params)` 與 `pollOnce()`。

| IM | 收訊方式 | 你需要的改動 |
|---|---|---|
| **Discord** | Gateway WebSocket 或 REST 輪詢 | `pollOnce` 改成讀 channel 訊息；`sendText` 改成 POST `/channels/<id>/messages` |
| **Slack** | Events API（要公開 URL）或 Socket Mode | 同上；Socket Mode 可避免開對外埠 |
| **Line** | Webhook（要公開 URL）＋ reply token | 需要一個接收端；`sendText` 用 reply/push API |
| **自家 Webhook** | 你已經有 `dsh-webhook` 這個官方形狀可參考 | 建議直接照 `@deepseek-ai/dsh-webhook` 的 `register(rule)` 寫 |

> **不要開對外連接埠**，除非你很清楚在做什麼。Telegram 用輪詢就是為了「不需要公開位址」。

---

## 2. 一個 bot 服務多個工作區（依 chat／主題路由）

改 `pollOnce()` 的分派：把「chat → workspacePath」做成一個對照表。

```js
const ROUTES = new Map([
  ['<chatId-1>', 'D:\\專案項目\\DSH工具箱'],
  ['<chatId-2>', 'D:\\專案項目\\DLB-wiki'],
]);
// 在 processQueue 之前，依來源把 workspacePath 換掉（createSession 用得到）
```

注意：`workspacePath` 目前是**插件層**的設定（一個值）。要做多路由，得把它變成「每個任務帶自己的值」→ 把 `createSession` 的 `cfg.workspacePath` 改成參數。

---

## 3. 加新指令（最常見的需求）

在 `handleCommand()` 加分支即可。範例：

```js
if (text === '/cost') {
  const today = todayCostFromLedger();          // 需要自己接帳本或 token 統計
  await sendText(`今天 DSH 總花費 ≈¥${today?.toFixed(2) ?? '讀不到'}`);
  return true;
}
if (text === '/files') {
  // 列出這個 session 的工作區檔案（純讀，不會被擋）
  const p = cfg.workspacePath;
  await sendText(readdirSync(p).join('\n'));
  return true;
}
```

**別忘了**：加了指令就補一個純函式測試（若有邏輯），並更新 `HELP` 字串。

---

## 4. 換模型／換 agent preset

| 想做的事 | 改哪裡 |
|---|---|
| 換預設模型 | 全域設定 `~/.dsh/settings.yaml` 的 `agent-default-model`（插件讀 `ctx.agentDefaultModel.currentSelection()`） |
| 只在這個插件用別的模型 | `createSession()` 的 `agentOptions: { provider, model }` 直接指定 |
| 換思考風格 | `cfg.agentPreset`（例如 `standard`；其他名稱看 `~/.dsh/.agent-presets\`） |
| 限輸出長度 | `agentOptions.maxTokens`（契約支援） |

---

## 5. 讓不同使用者各自有對話（多人用）

目前設計是**單一 chat**。要多人：

1. `chatId` 從字串改成**集合**（allowlist）
2. `live` 從單一變數改成 `Map<chatId, {sessionId, handle}>`
3. `queue` 依 chatId 分開（避免 A 的長任務卡住 B）
4. **成本上限改成每人一份**（`state.todaySpent` → `Map<chatId, number>`）
5. `runTurn` 的 `titleFor` 加上使用者標記，方便在 GUI 分辨

> ⚠️ 多人＝多一組「誰能執行你電腦上的 agent」的風險。務必先想清楚權限與審計。

---

## 6. 直接拿「Agent API」來用（不做 IM 也能自動化）

如果你要的是「排程／CI 自動跑 agent」，**不需要 Telegram**：

```js
const preset = await ctx.agentPresets.resolve('standard');
const ws = await ctx.workspaceRegistry.create('D:\\專案項目\\DSH工具箱');
const h = await ctx.agents.create({ sessionId: brandString(`job-${randomUUID()}`),
  meta: { cwd: ws.path, agentPreset: preset.id },
  agentOptions: { provider, model },
  setup: async (c) => { await ctx.agentPresets.mount(c, preset.id); } });
await ws.attachSession(h.agent.sessionId ?? h.agent.session);
ctx.permissionPresets.set(h.agent.session, 'workspace-write');
h.agent.followup(createUserMessage({ content: [{ type: 'text', text: task }], source: { kind: 'user' } }));
await h.agent.whenIdle();
// 之後用 summarizeEvents() 取答案
```

也可以直接抄官方 `@deepseek-ai/dsh-webhook`：它的 `register(rule)` / `dispatch(delivery)` 就是「外部事件 → 建 session」的官方抽象。

---

## 7. 改權限／上限（三個旋鈕）

| 目的 | 改哪裡 | 風險 |
|---|---|---|
| 只讀 | `cfg.permissionPreset: 'read-only'` | 無 |
| 可寫工作區（預設） | `'workspace-write'` | 低 |
| 免核准全權 | `'danger-full-access'` | **高**（等於把電腦交給遠端訊息） |
| 放行更多路徑 | `~/.dsh/auto-approve/allowlist.json` 的 `allowRules` | 中 |
| 每日上限 | `cfg.dailyCapCny` | 無 |

---

## 8. 測試怎麼擴充

1. 純函式 → 加進 `tests/pure.test.mjs`（零依賴，`node tests/pure.test.mjs`）
2. 端到端 → 加進 `docs/09-telegram-test-plan.md` 的案例表
3. 接進你的驗證鏈 → 照本專案的做法：在 `selftest-runtime.ps1` 加一個 `R<N>` 案例（跑測試並讀結果檔斷言）

**DoD**：任何新功能都要有「可離線跑」的測試，否則不算完成（見 `05` §11）。

---

## 9. 打包／發佈注意

- `package.json` 保持 `"private": true`，**避免誤發到 npm**（要發佈需要明確授權）
- 對外發佈前：`peerDependencies` 用**精確或證據支持的範圍**，不要 `*`／`file:`／`link:`
- 不要把 `~/.dsh/notify-secrets.json`、任何 token、任何 `ops\notify\*.jsonl` 打包進去
- 附上 `docs/07`（權限範圍）與 `docs/09`（測試計畫）——使用者最需要這兩份

---

## 10. DSH 升級後的檢查（每次升級都跑）

```powershell
# 1) 契約還在嗎
dsh --profile <p> --dump-config | Select-String 'tg-session'
# 2) 服務名稱有沒有變（沒變＝心跳會出現；變了＝插件不會掛）
Get-Content '<workspacePath>\ops\state\tg-session-heartbeat.txt'
# 3) 三個檔案格式有沒有變（06-contracts §7）
#    實際看一個 session 的投影快取：record.rows.tokenUsage.val.totals 還在嗎
# 4) 跑測試鏈
node <profile>\packages\dsh-tg-session\tests\pure.test.mjs
```

