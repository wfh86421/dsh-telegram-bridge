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
