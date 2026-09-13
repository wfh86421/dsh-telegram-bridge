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
