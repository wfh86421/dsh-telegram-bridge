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
