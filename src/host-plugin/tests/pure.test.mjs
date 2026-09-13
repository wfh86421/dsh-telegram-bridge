// tests/pure.test.mjs — 純函式回歸測試（零依賴、零網路；node tests/pure.test.mjs）
import {
  chunkText, isAllowedChat, summarizeEvents, sumUsage, estimateCost, withinCap, titleFor, formatFooter, RATE
} from '../lib/pure.js';

let pass = 0;
const fails = [];
function t(id, cond, detail = '') {
  if (cond) { pass++; console.log(`   OK   ${id}${detail ? ' — ' + detail : ''}`); }
  else { fails.push(id); console.log(`   FAIL ${id}${detail ? ' — ' + detail : ''}`); }
}

// 1) 長文分段
{
  const src = Array.from({ length: 900 }, (_, i) => `line-${i}-` + 'x'.repeat(20)).join('\n');
  const ch = chunkText(src);
  const maxLen = Math.max(...ch.map((c) => c.length));
  t('chunkText：每段 ≤4000', ch.every((c) => c.length <= 4000), `${src.length} 字 → ${ch.length} 段，最大 ${maxLen}`);
  t('chunkText：內容不遺失', ch.join('\n').replace(/\n/g, '') === src.replace(/\n/g, ''), '逐段接回後與原文相同');
  t('chunkText：空字串', chunkText('').length === 1 && chunkText('').length === 1 && chunkText('')[0] === '', '回 [""]');
  const one = chunkText('x'.repeat(9000));
  t('chunkText：超長單行硬切', one.length === 3 && one.every((c) => c.length <= 4000), `${one.length} 段`);
}

// 2) allowlist
t('isAllowedChat：相同', isAllowedChat('555000111', '555000111') === true);
t('isAllowedChat：數字/字串等價', isAllowedChat(555000111, '555000111') === true);
t('isAllowedChat：不同 → false', isAllowedChat('123', '555000111') === false);
t('isAllowedChat：未設定 → false（不可全放行）', isAllowedChat('555000111', '') === false);

// 3) 答案折疊（契約：dsh-headless 的 summarize）
//    真實情況：firstSeq 是「送出 prompt 前」抓的 → 區間內一定含本次的 turn/start（實測 dsh-headless 亦同）
{
  const ev = {
    1: { type: 'turn/start' },
    2: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '中間的' }] } } },
    3: { type: 'assistant/message', data: { message: { content: [{ type: 'tool_use', id: 'x' }] } } },
    4: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '最終答案' }] } } },
    5: { type: 'turn/end', data: { reason: { kind: 'completed' } } }
  };
  const r = summarizeEvents((i) => ev[i], 1, 6);
  t('summarizeEvents：取最後一則非空文字', r.text === '最終答案', JSON.stringify(r.text));
  t('summarizeEvents：讀出 turn/end 原因', r.reason?.kind === 'completed');
  // turn/start 之前的事件不算（firstSeq 抓到前一個回合時，不可以把舊答案當新答案）
  const ev2 = {
    0: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '舊的' }] } } },
    1: { type: 'turn/start' }
  };
  t('summarizeEvents：turn/start 之前不採計', summarizeEvents((i) => ev2[i], 0, 2).text === '');
  t('summarizeEvents：讀不到事件不丟例外', summarizeEvents(() => undefined, 0, 3).text === '');
}

// 4) token 加總
{
  const ev = {
    0: { type: 'turn/start' },
    1: { type: 'assistant/message', data: { usage: { inputTokens: 100, cacheReadTokens: 900, outputTokens: 10 } } },
    2: { type: 'assistant/message', data: { usage: { inputTokens: 50, cacheReadTokens: 0, outputTokens: 5 } } }
  };
  const u = sumUsage((i) => ev[i], 0, 3);
  t('sumUsage：加總正確', u && u.input === 150 && u.cacheRead === 900 && u.output === 15, JSON.stringify(u));
  t('sumUsage：沒有 usage → null', sumUsage(() => ({ type: 'turn/start' }), 0, 2) === null);
}

// 5) 成本
t('estimateCost：100 萬未命中 = ¥10', estimateCost({ input: 1000000, cacheRead: 0, output: 0 }) === RATE.inMiss);
t('estimateCost：100 萬輸出 = ¥30', estimateCost({ input: 0, cacheRead: 0, output: 1000000 }) === RATE.out);
t('estimateCost：null 進 null 出', estimateCost(null) === null);

// 6) 上限（邊界：等於上限就不放行）
t('withinCap：未達上限', withinCap(9.99, 10) === true);
t('withinCap：剛好等於上限 → 不放行', withinCap(10, 10) === false);
t('withinCap：超過 → 不放行', withinCap(10.01, 10) === false);

// 7) 標題（max=24：25 個字以上才截斷）
t('titleFor：短標題不截斷', titleFor('  幫我   檢查備份  ') === '幫我 檢查備份', titleFor('  幫我   檢查備份  '));
{
  const collapsed = '幫我 檢查備份 今天有沒有跑完並且把三層的細節全部告訴我';
  const out = titleFor('  幫我   檢查備份   今天有沒有跑完並且把三層的細節全部告訴我  ');
  t('titleFor：長標題截斷（前 24 字＋…）',
    collapsed.length > 24 && out === collapsed.slice(0, 24) + '…' && out.endsWith('…'),
    `collapsed=${collapsed.length} 字 → ${out}`);
}
t('titleFor：空字串有預設', titleFor('') === 'Telegram 任務');

// 8) 頁腳
{
  const f = formatFooter({ durationSec: 12.3, reason: { kind: 'completed' }, tokens: { input: 1000, cacheRead: 500, output: 42 }, cost: 0.0123, sessionId: 'tg-abcdef12-3456' });
  t('formatFooter：含耗時／完成／token／成本／session', f.includes('12.3s') && f.includes('✅ 完成') && f.includes('1,500') && f.includes('¥0.0123') && f.includes('tg-abc') === false && f.includes('abcdef12'), f);
  const f2 = formatFooter({ durationSec: 5, reason: { kind: 'error', error: { message: 'boom' } }, tokens: null, cost: null, sessionId: null });
  t('formatFooter：失敗與未知成本要說出來', f2.includes('error') && f2.includes('boom') && f2.includes('待結算'), f2);
}

console.log(`\n   ${fails.length === 0 ? '✅' : '❌'} dsh-tg-session 純函式測試 ${pass}/${pass + fails.length}`);
if (fails.length > 0) { console.log('   失效：' + fails.join(', ')); process.exit(2); }
process.exit(0);
