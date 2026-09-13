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
