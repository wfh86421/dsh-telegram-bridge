# dsh-tg-session — Telegram ↔ DSH（機制 B：Host 插件版）

一條 Telegram 訊息 → 在**本機的同一個 host** 裡建立或接續一個**真的 Workspace-backed Session** → 答案回到 Telegram。

## 它和機制 A（`tools\tg-bridge.mjs`）差在哪

| | 機制 A（headless 行程） | 機制 B（本插件） |
|---|---|---|
| 每次任務 | 一個**新的** headless 行程 | 在你正在跑的 host 裡開一個真 Session |
| GUI 看得到 | 看不到（不在 Workspace 註冊表） | ✅ 出現在對話清單，可直接接手 |
| 多輪記憶 | ❌（一次性） | ✅ 後續訊息接續同一段對話（`/new` 開新的） |
| 需要核准時 | 直接失敗 | ⏳ 逾時回報，你可在 GUI 回答後讓它跑完 |
| 前置條件 | 只要 CLI | 要掛進 profile（**重啟 host** 生效） |

## 掛法（開發用獨立 profile 為例）

```powershell
# 1) 裝進 profile（pnpm 會連到本機路徑）
dsh plugin --profile tgtg add file:../web/packages/dsh-tg-session
# 2) 把 bundle 加進該 profile 的 package.json：dsh.profile.bundles 追加 "dsh-tg-session"
# 3) 可選：在該 profile 的 cordis.patch.yml 覆寫這一列的設定（patch 會整段取代 config，要重述全部鍵）
```

## 設定鍵（`cordis.patch.yml` 的 `tg-session` 列）

| 鍵 | 預設 | 說明 |
|---|---|---|
| `chatId` | 讀 `notify-secrets.json` | **只認這個 chat**；留空＝讀金鑰檔。未設定就不啟動（不會全放行） |
| `dailyCapCny` | 10 | 每日上限（只累計本插件派工） |
| `timeoutMinutes` | 15 | 單回合逾時；逾時只回報，session 仍在 GUI 裡繼續 |
| `agentPreset` | `standard` | agent preset 名稱 |
| `permissionPreset` | `workspace-write` | `read-only`／`workspace-write`／`danger-full-access` |
| `workspacePath` | （必填） | Session 建在哪個 Workspace（＝GUI 清單的那個工作區） |
| `testTask` | `''` | **開發用**：啟動後直接跑這個任務就停（不輪詢 Telegram） |
| `dryRun` | false | 不真的發 TG，只寫紀錄檔 |
| `approveFromTelegram` | `true` | **TG 核准**：需要升級權限時，直接在 Telegram 按「✅ 允許一次／❌ 拒絕」（只接管 TG 派工的回合；你在 GUI 的對話不受影響） |
| `approvalTimeoutMinutes` | `10` | 核准沒回覆＝視為拒絕（`unavailable`，fail closed；絕不自動放行） |

## 檔案

- `lib/pure.js` — 可單獨測試的純函式（分段／allowlist／答案折疊／token 加總／成本／上限／標題／頁腳）
- `lib/index.js` — 插件本體（輪詢、鎖、心跳、建立 session、取答案、回報）
- `tests/pure.test.mjs` — 零依賴測試（`node tests/pure.test.mjs`）

## 契約來源（0.1.5-rc.1，皆實讀官方原始碼）

- 建立 Workspace-backed Session：`@deepseek-ai/dsh-webhook/lib/index.js`（`createWebhookSession`）
- 取最終答案：`@deepseek-ai/dsh-headless/lib/index.js`（`whenIdle` ＋ `session.eventAt(SessionSeq(i))` 掃描 ＋ `sessions.flush`）
- 插件形狀與 patch 格式：`@deepseek-ai/dsh-headless`（named `apply` ＋ `cordis.patch.yml` 的 `insert:` 清單）
- **TG 核准（answerer）**：`@deepseek-ai/dsh-user-approval/lib/index.js`（`ctx.waterfall(scopeTarget(agent,agent), 'approval/request', req, () => 'unavailable')`；回答者用 `ctx.on('approval/request', handler)` 註冊，回傳 `ApprovalOutcome` 或 `undefined` 交棒）

## 已知限制

- 輪詢用 `getUpdates`：**同一支 bot 只能有一個輪詢者**。本插件與機制 A 的 `tg-bridge.mjs` 同時開會互搶（Telegram 可能回 409）。要用 B 就關掉 A 的視窗。
- 沒有佇列持久化：host 重啟時，記憶體佇列中未處理的訊息會消失（`offset` 已前進，所以不會重播）。日誌仍有紀錄。
- 未接 `ctx.tokenMeter`：成本是「本回合事件的 usage 加總 × 回退權重」估的，不是帳本值；讀不到就顯示「¥ 待結算」，不假裝 0。
