// lib/answerer.js — 「用 Telegram 核准」的回答者（零注入，必須最早註冊）
//
// ── 為什麼要獨立成一個 row ────────────────────────────────────────────────
// 契約（實讀 @deepseek-ai/dsh-user-approval 0.1.5-rc.1 lib/index.js:179）：
//     ctx.waterfall(scopeTarget(agent, agent), 'approval/request', req, () => 'unavailable')
// waterfall 是**依註冊順序**、遇到第一個有回傳值就停。實際的聽眾順序（實測本機安裝）：
//     ① dsh-acp              ② dsh-api-remotes（轉給瀏覽器並「等人按」）  ③ 本插件
// 也就是說：只要有人在看 GUI，②就會一直等，**③永遠輪不到**。
// 所以回答者必須在 ② 之前註冊 → 它不能有任何 inject（有 inject 就會等到 web-app 的服務
// 才啟動，那時 ② 已經註冊完了）→ 因此拆成這個「零注入」的 row，並在 profile 的
// dsh.profile.bundles 把它排到 dsh-web-app 之前。
//
// 只接管**本插件自己建立的 agent**（shared.js 的 ourAgents），其餘一律 return undefined
// 交還 GUI ⇒ 你在 GUI 的對話核准行為完全不變。
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { ourAgents, pendingApprovals, makeTg, readTelegramSecrets } from './shared.js';
import { formatApprovalMessage, approvalKeyboard } from './pure.js';

export const name = 'tg-approval-answerer';

const DEFAULTS = {
  approveFromTelegram: true,
  approvalTimeoutMinutes: 10,
  chatId: '',
  secretsFile: join(homedir(), '.dsh', 'notify-secrets.json'),
  stateDir: '',
  workspacePath: ''
};

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  if (!cfg.approveFromTelegram) { ctx.logger?.info?.('tg-approval-answerer: 已停用（approveFromTelegram=false）'); return; }
  const { token, chatId } = readTelegramSecrets(cfg.secretsFile, cfg.chatId);
  if (!token || !chatId) { ctx.logger?.warn?.('tg-approval-answerer: 沒有 token／chatId → 不註冊'); return; }

  const tg = makeTg(token);
  const stateDir = cfg.stateDir || (cfg.workspacePath ? join(cfg.workspacePath, 'ops', 'notify') : '');
  const now8 = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  const logRow = (row) => {
    try {
      if (!stateDir) return;
      if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
      appendFileSync(join(stateDir, 'tg-session.jsonl'), JSON.stringify(row) + '\n', 'utf8');
    } catch { /* 日誌失敗不影響核准 */ }
  };
  const timeoutMin = Math.max(1, Number(cfg.approvalTimeoutMinutes) || 10);

  ctx.on('approval/request', async (req) => {
    const ours = !!req?.agent && ourAgents.has(req.agent);
    // 除錯訊號：這一行證明「回答者有沒有被呼叫」——排序問題靠它才驗得出來
    logRow({ at: now8(), event: 'approval-seen', where: 'answerer-row', tool: req?.toolName ?? null, isOurs: ours });
    if (!ours) return;   // 不是 TG 派工的回合 → 交還 GUI（回傳 undefined 讓 waterfall 往下走）

    const id = randomUUID().replace(/-/g, '').slice(0, 8);
    try {
      await tg('sendMessage', {
        chat_id: chatId,
        text: formatApprovalMessage({ toolName: req.toolName, reason: req.reason, title: '', timeoutMinutes: timeoutMin }),
        reply_markup: JSON.stringify(approvalKeyboard(id))
      });
    } catch (e) {
      ctx.logger?.warn?.(`tg-approval-answerer: 送核准訊息失敗 → fail closed：${e.message}`);
      return 'unavailable';
    }
    logRow({ at: now8(), event: 'approval-asked', id, tool: req.toolName, reason: String(req.reason ?? '').slice(0, 200) });

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        pendingApprovals.delete(id);
        logRow({ at: now8(), event: 'approval', id, tool: req.toolName, decision: 'unavailable', why: 'timeout' });
        try { await tg('sendMessage', { chat_id: chatId, text: `⏰ 核准逾時（${timeoutMin} 分鐘沒回覆）→ 已自動視為拒絕：${req.toolName}` }); } catch {}
        resolve('unavailable');
      }, timeoutMin * 60000);
      pendingApprovals.set(id, { resolve, timer, tool: req.toolName, chatId, tg });
    });
  });
  ctx.logger?.info?.('tg-approval-answerer: 已註冊（Telegram 核准）');
}
