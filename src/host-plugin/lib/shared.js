// lib/shared.js — 兩個 row（answerer 與 main）共用的記憶體狀態與小工具
//
// 為什麼需要：核准回答者必須**很早註冊**（見 lib/answerer.js 的說明），但主插件要等
// web-app 提供的服務（workspaceRegistry／agentPresets）才能啟動。兩者在同一個行程內、
// 透過 Node 的 module cache 共用同一份狀態，所以拆檔不影響它們互通。
import https from 'node:https';
import { readFileSync } from 'node:fs';

/** 本插件建立的 agent（只有它們的核准請求會走 Telegram；其餘交還 GUI）。 */
export const ourAgents = new WeakSet();

/** 進行中的核准請求：id → { resolve, timer, tool, chatId, tg }。answerer 建立、poller 解析。 */
export const pendingApprovals = new Map();

/** 去重：同一個請求可能同時被多個 listener 看到（root 與 agent 層）。 */
export const approvalInFlight = new Set();

/** Telegram API 呼叫（自帶 token；永不印出）。 */
export function makeTg(token) {
  return (method, params = {}) => new Promise((resolve) => {
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
}

/** 讀 Telegram 金鑰（只回傳給呼叫端；永不印出）。 */
export function readTelegramSecrets(secretsFile, chatIdOverride = '') {
  let token = '';
  let chatId = String(chatIdOverride || '');
  try {
    const j = JSON.parse(readFileSync(secretsFile, 'utf8').replace(/^\uFEFF/, ''));
    token = j?.telegram?.token || '';
    if (!chatId) chatId = String(j?.telegram?.chatId || '');
  } catch { /* 讀不到：回空值，交給呼叫端決定要不要啟動 */ }
  return { token, chatId };
}
