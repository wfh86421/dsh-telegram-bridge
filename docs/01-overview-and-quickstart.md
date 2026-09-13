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
