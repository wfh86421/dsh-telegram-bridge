// lib/index.js — dsh-tg-session：Telegram ↔ DSH 的 Host 插件（機制 B）
//
// 為什麼要有它（對比機制 A 的 tools\tg-bridge.mjs）：
//   機制 A 每次派工＝一個新的 headless 行程：沒有多輪記憶、看不到過程、GUI 找不到那則對話。
//   機制 B 直接在 **web host 裡**建立一個**真的 Workspace-backed Session**：
//     ・它會出現在 GUI 的對話清單（同一個 Workspace）
//     ・後續的 Telegram 訊息可以**接續同一段對話**（真的多輪）
//     ・需要核准時，你可以在 GUI 回答（人在外面時則逾時回報，不假裝成功）
//
// 契約來源（全部是實讀 0.1.5-rc.1 的官方原始碼，不是憑記憶）：
//   建立 session：node_modules\@deepseek-ai\dsh-webhook\lib\index.js（createWebhookSession）
//   取最終答案：node_modules\@deepseek-ai\dsh-headless\lib\index.js（summarize + whenIdle + flush）
//   插件形狀：named `apply` + `inject`（同 dsh-headless），由 cordis.patch.yml 掛一列
import https from 'node:https';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { brandString } from '@deepseek-ai/dsh-brand';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionSeq } from '@deepseek-ai/dsh-session';
import {
  chunkText, isAllowedChat, summarizeEvents, sumUsage, estimateCost, withinCap, titleFor, formatFooter
} from './pure.js';

export const name = 'tg-session';
export const inject = [
  'agents', 'agentDefaultModel', 'agentPresets', 'permissionPresets',
  'sessionTitle', 'workspaceRegistry', 'sessions'
];

const DEFAULTS = {
  chatId: '',
  dailyCapCny: 10,
  timeoutMinutes: 15,
  agentPreset: 'standard',
  permissionPreset: 'workspace-write',
  workspacePath: '',
  pollSeconds: 3,
  secretsFile: join(homedir(), '.dsh', 'notify-secrets.json'),
  stateDir: '',           // 預設 <workspacePath>\ops\notify
  prefix: true,           // 派工時加上「先讀 AGENTS.md」的前置指示
  // 開發／驗證用：啟動後直接跑一個任務就停（不輪詢 Telegram）。
  // 為什麼需要：A 橋接器與 B 插件用同一支 bot，兩個 getUpdates 會互搶；
  // 這個入口讓「建立真 session → 取答案 → 回報」可以在不碰 Telegram 的情況下驗證。
  testTask: '',
  dryRun: false           // true = 不真的發 TG，只寫進紀錄檔
};

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
});

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  if (!cfg.workspacePath) { ctx.logger?.warn?.('tg-session: 沒有設定 workspacePath → 不啟動'); return; }
  const stateDir = cfg.stateDir || join(cfg.workspacePath, 'ops', 'notify');
  const STATE = join(stateDir, 'tg-session-state.json');
  const LOG = join(stateDir, 'tg-session.jsonl');
  const LOCK = join(stateDir, 'tg-session.lock');
  const HEARTBEAT = join(cfg.workspacePath, 'ops', 'state', 'tg-session-heartbeat.txt');
  const log = (m) => ctx.logger?.info?.(`tg-session: ${m}`);
  const warn = (m) => ctx.logger?.warn?.(`tg-session: ${m}`);
  const now8 = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  const today8 = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

  // ── 設定／金鑰（永不印出 token）───────────────────────────────────────
  let token = '';
  let chatId = String(cfg.chatId || '');
  try {
    const j = JSON.parse(readFileSync(cfg.secretsFile, 'utf8').replace(/^\uFEFF/, ''));
    token = j?.telegram?.token || '';
    if (!chatId) chatId = String(j?.telegram?.chatId || '');
  } catch (e) { warn(`讀不到金鑰檔 ${cfg.secretsFile}：${e.message}`); }

  // ── 狀態／鎖／心跳／日誌 ──────────────────────────────────────────────
  const ensureDir = (d) => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); };
  let state = { offset: 0, todayDate: today8(), todaySpent: 0, todayTasks: 0, lastTask: null };
  try {
    const s = JSON.parse(readFileSync(STATE, 'utf8').replace(/^\uFEFF/, ''));
    state = { ...state, ...s };
  } catch { /* 第一次啟動 */ }
  if (state.todayDate !== today8()) { state.todayDate = today8(); state.todaySpent = 0; state.todayTasks = 0; }
  const saveState = () => { try { ensureDir(stateDir); writeFileSync(STATE, JSON.stringify(state, null, 1), 'utf8'); } catch (e) { warn(`狀態寫入失敗：${e.message}`); } };
  const logRow = (row) => { try { ensureDir(stateDir); appendFileSync(LOG, JSON.stringify(row) + '\n', 'utf8'); } catch { /* 日誌失敗不影響任務 */ } };
  const beat = () => { try { ensureDir(join(cfg.workspacePath, 'ops', 'state')); writeFileSync(HEARTBEAT, now8(), 'utf8'); } catch {} };
  const clearBeat = () => { try { if (existsSync(HEARTBEAT)) unlinkSync(HEARTBEAT); } catch {} };
  const pidAlive = (p) => { try { process.kill(p, 0); return true; } catch { return false; } };

  let haveLock = false;
  const acquireLock = () => {
    ensureDir(stateDir);
    if (existsSync(LOCK)) {
      let old = null;
      try { old = JSON.parse(readFileSync(LOCK, 'utf8')); } catch {}
      if (old?.pid && pidAlive(old.pid)) { warn(`另一個實例在跑（pid ${old.pid}）→ 本實例不啟動`); return false; }
      warn(`接管過期鎖（原 pid ${old?.pid ?? '?'}）`);
    }
    writeFileSync(LOCK, JSON.stringify({ pid: process.pid, startedAt: now8() }), 'utf8');
    haveLock = true;
    return true;
  };
  const releaseLock = () => { try { if (haveLock && existsSync(LOCK)) unlinkSync(LOCK); } catch {} haveLock = false; };

  // ── Telegram ──────────────────────────────────────────────────────────
  const tg = (method, params = {}) => new Promise((resolve) => {
    const qs = new URLSearchParams(params).toString();
    const req = https.request({
      host: 'api.telegram.org',
      path: `/bot${encodeURIComponent(token)}/${method}${qs ? '?' + qs : ''}`,
      method: 'GET'
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({ ok: false, description: 'parse-fail' }); } });
    });
    req.on('error', (e) => resolve({ ok: false, description: 'network: ' + e.message }));
    req.setTimeout(40000, () => { resolve({ ok: false, description: 'timeout' }); req.destroy(); });
    req.end();
  });
  const sendText = async (text) => {
    if (cfg.dryRun) { log(`[dry-run] 不回傳 TG，內容：\n${String(text).slice(0, 800)}`); return { ok: true, dryRun: true }; }
    const chunks = chunkText(text);
    let last = { ok: true };
    for (let i = 0; i < chunks.length; i++) {
      const head = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n` : '';
      last = await tg('sendMessage', { chat_id: chatId, text: head + chunks[i], disable_web_page_preview: 'true' });
      if (!last.ok) { warn(`sendMessage 失敗：${last.description}`); return last; }
    }
    return last;
  };

  // ── 建立／接續真的 Session（契約：dsh-webhook 的 createWebhookSession）──
  let live = null;   // { sessionId, handle, title } — 目前接續中的對話
  const queue = [];
  let busy = false;

  async function createSession(title) {
    const preset = await ctx.agentPresets.resolve(cfg.agentPreset);
    await ctx.agentPresets.standingKeyFor(preset.id);
    ctx.permissionPresets.resolve(cfg.permissionPreset);
    const workspace = await ctx.workspaceRegistry.create(cfg.workspacePath);
    const sessionId = brandString(`tg-${randomUUID()}`);
    const selection = ctx.agentDefaultModel.currentSelection();
    const handle = await ctx.agents.create({
      sessionId,
      meta: { cwd: workspace.path, agentPreset: preset.id },
      agentOptions: { provider: selection.provider, model: selection.model },
      setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, preset.id); }
    });
    await workspace.attachSession(sessionId);
    ctx.permissionPresets.set(handle.agent.session, cfg.permissionPreset);
    try { ctx.sessionTitle.rename(handle.agent.session, title); } catch (e) { warn(`改名失敗：${e.message}`); }
    log(`已建立 session ${sessionId}（preset ${preset.id}／${cfg.permissionPreset}）`);
    return { sessionId, handle, title };
  }

  async function runTurn(promptText, isNew, rawText) {
    const t0 = Date.now();
    if (isNew || !live) {
      // 標題要用**使用者原本那句話**，不是加了我的前置指示的 prompt
      // （否則 GUI 清單會顯示「[來自 Telegram 的派工] 工作區＝…」，看不懂）
      const title = titleFor(rawText ?? promptText);
      live = await createSession(title);
      live.startedAt = now8();
    }
    const session = live.handle.agent.session;
    const firstSeq = session.seq;
    live.handle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: promptText }],
      source: { kind: 'user' }
    }));
    const timeoutMs = Math.max(1, Number(cfg.timeoutMinutes) || 15) * 60000;
    let timedOut = false;
    try {
      await Promise.race([
        live.handle.agent.whenIdle(),
        sleep(timeoutMs).then(() => { timedOut = true; })
      ]);
    } catch (e) { warn(`whenIdle 失敗：${e.message}`); }
    const seqEnd = session.seq;
    const getEvent = (i) => { try { return session.eventAt(SessionSeq(i)); } catch { return undefined; } };
    const { text: answer, reason } = summarizeEvents(getEvent, firstSeq, seqEnd);
    const tokens = sumUsage(getEvent, firstSeq, seqEnd);
    const cost = estimateCost(tokens);
    const durationSec = Math.round((Date.now() - t0) / 100) / 10;
    if (cost != null) state.todaySpent += cost;
    state.todayTasks += 1;
    state.lastTask = { at: now8(), sessionId: live.sessionId, durationSec, reason: reason?.kind ?? null, cost };
    saveState();
    logRow({ at: now8(), event: 'turn', text: promptText.slice(0, 300), raw: String(rawText ?? '').slice(0, 120), sessionId: live.sessionId, firstSeq, seqEnd, durationSec, timedOut, reason: reason?.kind ?? null, tokens, cost, answerLen: answer.length, answerHead: answer.slice(0, 300) });
    if (!answer) warn('這一回合沒有最終文字輸出（可能還在跑、或被核准卡住）');
    if (timedOut) {
      await sendText(`⏳ 超過 ${cfg.timeoutMinutes} 分還沒結束——它可能**正在等你核准**。\n這一則仍在同一個 session 裡跑；你可以在 GUI 打開這個對話接手（標題：${live.title}）。\n部分輸出：\n${(answer || '(還沒有輸出)').slice(0, 1500)}\n\n${formatFooter({ durationSec, reason, tokens, cost, sessionId: live.sessionId })}`);
      return;
    }
    await sendText(`${answer || '(這一回合沒有最終文字輸出)'}\n\n${formatFooter({ durationSec, reason, tokens, cost, sessionId: live.sessionId })}`);
  }

  const HELP = [
    'DSH 橋接器（Host 插件版）：你的訊息會在**本機的真 session**裡執行，答案回到這裡。',
    '/status  狀態（今日則數／成本／目前 session／上限）',
    '/new     開一段新對話（目前這段之後不再接續）',
    '/help    這份說明',
    '',
    '沒有指令的訊息 → 接續目前這段對話執行；第一次會自動建立新對話。'
  ].join('\n');

  async function handleCommand(text) {
    if (text === '/help' || text === '/start') { await sendText(HELP); return true; }
    if (text === '/new') { live = null; await sendText('🆕 下一則訊息會開一段新對話。'); return true; }
    if (text === '/status') {
      await sendText([
        '🟢 DSH 橋接器（plugin）',
        `今日：${state.todayTasks} 則／≈¥${state.todaySpent.toFixed(2)}（上限 ¥${cfg.dailyCapCny}）`,
        `目前對話：${live ? live.title + '（' + String(live.sessionId).slice(0, 11) + '…）' : '（還沒有，下一則會建立）'}`,
        `preset：${cfg.agentPreset}／${cfg.permissionPreset}｜逾時 ${cfg.timeoutMinutes} 分`,
        `工作區：${cfg.workspacePath}`
      ].join('\n'));
      return true;
    }
    return false;
  }

  async function processQueue() {
    if (busy) return;
    busy = true;
    try {
      while (queue.length > 0) {
        const text = queue.shift();
        try {
          if (await handleCommand(text)) continue;
          if (!withinCap(state.todaySpent, cfg.dailyCapCny)) {
            await sendText(`⛔ 已達今日上限 ¥${cfg.dailyCapCny}（今日 ${state.todayTasks} 則／≈¥${state.todaySpent.toFixed(2)}）。`);
            logRow({ at: now8(), event: 'cap-reached', todaySpent: state.todaySpent });
            continue;
          }
          const quoted = text.length > 80 ? `${text.slice(0, 80)}…（共 ${text.length} 字）` : text;
          await sendText(`${live ? '▶️ 接續同一段對話' : '🕐 收到，開新對話執行'}（第 ${state.todayTasks + 1} 則／今日 ≈¥${state.todaySpent.toFixed(2)}）\n> ${quoted.replace(/\n/g, ' ')}`);
          const isNew = !live;
          const body = cfg.prefix && isNew
            ? ['[來自 Telegram 的派工]',
              `工作區＝${cfg.workspacePath}。**需要動到本機檔案、跑指令或做變更時**，先讀同目錄的 AGENTS.md 並遵守其常設規則與安全底線；單純問答直接回答。`,
              '回覆要精簡：先給結論。',
              '<telegram>', text, '</telegram>'].join('\n')
            : text;
          await runTurn(body, isNew, text);
        } catch (e) {
          warn(`任務失敗：${e.message}`);
          logRow({ at: now8(), event: 'error', text: text.slice(0, 200), error: e.message });
          await sendText(`❌ 執行失敗：${e.message}`);
        }
      }
    } finally { busy = false; }
  }

  async function pollOnce() {
    const r = await tg('getUpdates', {
      timeout: 0, limit: 10, offset: state.offset || 0,
      allowed_updates: JSON.stringify(['message'])
    });
    if (!r.ok) { warn(`getUpdates 失敗：${r.description}`); return; }
    for (const u of r.result || []) {
      state.offset = u.update_id + 1;
      const msg = u.message;
      if (!msg) continue;
      const from = String(msg.chat?.id ?? '');
      if (!isAllowedChat(from, chatId)) {
        logRow({ at: now8(), event: 'rejected-chat', chatTail: from.slice(-4), updateId: u.update_id });
        continue;
      }
      const text = String(msg.text || '').trim();
      if (!text) { await sendText('（目前只支援文字訊息）'); continue; }
      queue.push(text);
    }
    saveState();
  }

  // ── 生命週期（Cordis effect：disposer 負責停輪詢、放鎖、清心跳）────────
  const controller = new AbortController();
  let running = null;
  let stopped = false;
  ctx.effect(() => {
    if (!token || !chatId) { warn('沒有 token／chatId → 插件不啟動（請確認 notify-secrets.json）'); return () => {}; }
    if (!acquireLock()) return () => {};
    beat();
    log(`啟動：chat ****${String(chatId).slice(-4)}｜工作區 ${cfg.workspacePath}｜上限 ¥${cfg.dailyCapCny}／日`);
    running = (async () => {
      try {
        // 開發／驗證入口：跑一個任務就停（不輪詢、不跟 A 橋接器搶 bot）
        if (cfg.testTask) {
          queue.push(String(cfg.testTask));
          await processQueue();
          log('[testTask] 完成');
          stopped = true;
          return;
        }
        // 第一次啟動：把佇列裡的舊訊息確認掉（從現在開始）——使用者 2026-09-13 指定
        if (!state.offset) {
          const last = await tg('getUpdates', { offset: -1, limit: 1, timeout: 0 });
          if (Array.isArray(last.result) && last.result.length > 0) {
            state.offset = last.result[0].update_id + 1;
            saveState();
            log(`已跳過佇列中的舊訊息（offset → ${state.offset}）`);
          }
        }
        while (!stopped) {
          beat();
          try { await pollOnce(); } catch (e) { warn(`輪詢錯誤：${e.message}`); }
          try { await processQueue(); } catch (e) { warn(`佇列錯誤：${e.message}`); }
          try { await sleep(Math.max(1, cfg.pollSeconds) * 1000, controller.signal); } catch { break; }
        }
      } catch (e) { warn(`輪詢迴圈結束：${e.message}`); }
    })();
    return async () => {
      stopped = true;
      controller.abort();
      try { await running; } catch {}
      releaseLock();
      clearBeat();
      log('已停止');
    };
  }, 'tg-session.lifecycle()');
}
