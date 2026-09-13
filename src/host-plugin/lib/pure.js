// lib/pure.js — 可單獨測試的純函式（不碰網路、不碰檔案、不依賴 DSH runtime）
// 這些是「錯了會靜默出包」的地方，所以刻意抽出來用 tests/pure.test.mjs 釘住。

/** 把長文切成 Telegram 上限內的多段（優先在換行處切；超長單行才硬切）。 */
export function chunkText(text, max = 4000) {
  const s = String(text ?? '');
  const out = [];
  let cur = '';
  const push = () => { if (cur) { out.push(cur); cur = ''; } };
  for (const line of s.split('\n')) {
    if (line.length > max) {
      push();
      let rest = line;
      while (rest.length > max) { out.push(rest.slice(0, max)); rest = rest.slice(max); }
      cur = rest;
      continue;
    }
    if (cur.length + line.length + 1 > max) push();
    cur = cur ? cur + '\n' + line : line;
  }
  push();
  return out.length ? out : [''];
}

/** 只認 allowlist 的 chat（字串比較，避免 number/string 混用bug）。 */
export function isAllowedChat(fromChatId, allowed) {
  const a = String(allowed ?? '').trim();
  if (!a) return false;
  return String(fromChatId ?? '').trim() === a;
}

/**
 * 從 session 事件區間折出「最後一則非空 assistant 文字」與「turn/end 原因」。
 * 契約來源：dsh-headless/lib/index.js 的 summarize()（同版本實讀）。
 * @param getEvent (seq:number) => ({type, data}) | undefined
 */
export function summarizeEvents(getEvent, firstSeq, seqEnd) {
  let started = false;
  let text = '';
  let reason;
  for (let seq = firstSeq; seq < seqEnd; seq++) {
    const event = getEvent(seq);
    if (event === void 0) continue; // 讀不到就跳過（不讓摘要本身丟例外）
    if (event.type === 'turn/start') { started = true; continue; }
    if (!started) continue;
    if (event.type === 'assistant/message') {
      const joined = (event.data?.message?.content ?? [])
        .filter((b) => b.type === 'text').map((b) => b.text).join('');
      if (joined !== '') text = joined;
    }
    if (event.type === 'turn/end') reason = event.data?.reason;
  }
  return { text, reason };
}

/** 由事件的 usage 區間加總 token（有就回，沒有回 null）。 */
export function sumUsage(getEvent, firstSeq, seqEnd) {
  const acc = { input: 0, cacheRead: 0, output: 0, seen: false };
  for (let seq = firstSeq; seq < seqEnd; seq++) {
    const event = getEvent(seq);
    const u = event?.type === 'assistant/message' ? event.data?.usage : undefined;
    if (!u) continue;
    acc.seen = true;
    acc.input += u.inputTokens ?? u.uncachedInputTokens ?? 0;
    acc.cacheRead += u.cacheReadTokens ?? 0;
    acc.output += u.outputTokens ?? 0;
  }
  return acc.seen ? acc : null;
}

/** ¥ 估算（與 profiles\web\tools\op-attribution.mjs 相同的回退權重，¥/百萬 token）。 */
export const RATE = { inMiss: 10, cache: 1, out: 30 };
export function estimateCost(tokens) {
  if (!tokens) return null;
  return (RATE.inMiss * (tokens.input || 0) + RATE.cache * (tokens.cacheRead || 0) + RATE.out * (tokens.output || 0)) / 1e6;
}

/** 每日上限判斷（只累計本插件派工的支出）。 */
export function withinCap(spent, cap) {
  const s = Number(spent) || 0;
  const c = Number(cap) || 0;
  return s < c;
}

/** 對話標題：取訊息前幾個字（給 GUI 清單看得懂）。 */
export function titleFor(text, max = 24) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return 'Telegram 任務';
  return t.length > max ? t.slice(0, max) + '…' : t;
}

/** 回覆頁腳：耗時／結果／token／成本／session（讓你在 GUI 找得到那一則）。 */
export function formatFooter({ durationSec, reason, tokens, cost, sessionId }) {
  const parts = [`⏱ ${durationSec}s`];
  const kind = reason?.kind ?? 'unknown';
  parts.push(kind === 'completed' ? '✅ 完成' : `⚠️ ${kind}${reason?.error?.message ? '：' + reason.error.message : ''}`);
  if (tokens) parts.push(`in ${((tokens.input || 0) + (tokens.cacheRead || 0)).toLocaleString()}＋out ${(tokens.output || 0).toLocaleString()} tok`);
  parts.push(cost != null ? `≈¥${cost.toFixed(4)}` : '¥ 待結算');
  if (sessionId) parts.push(`session ${String(sessionId).replace(/^tg-/, '').slice(0, 8)}`);
  return parts.join('｜');
}
