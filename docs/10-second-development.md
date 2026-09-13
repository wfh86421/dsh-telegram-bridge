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
