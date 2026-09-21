#!/usr/bin/env node
/**
 * 题库修复脚本（P0-4）
 *
 * 为什么需要它：诊断发现 255 题里 165 题的干扰项是占位文本（"参考答案内容"/"请查看详细解析"/"以上都不对"），
 * 相当于 65% 的题白送分；另有 182 题正确答案落在 A 位（71%），可以靠"不会就选 A"蒙对。
 *
 * 两步顺序不能反：先把假干扰项换成真的，再重排选项位置 —— 否则打散的是三行垃圾。
 *
 * 用法：
 *   node scripts/repair-questions.js --dry-run        只诊断并预览，不写盘
 *   node scripts/repair-questions.js --limit=10       只处理前 10 道待修题（调提示词用）
 *   node scripts/repair-questions.js                  全量修复，写回前先备份 questions.json
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DATA_FILE = path.join(__dirname, '..', 'data', 'questions.json');

const PLACEHOLDER = /(参考答案内容|请查看详细解析|详见解析|以上都不对|以上说法均|其他选项均正确|都不正确|无法确定|见解析)/;
const OPT_MIN = 8;
const OPT_MAX = 60;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || 0;
// 上游有分钟级配额，并发 3 直接吃 429；默认压到 1，靠退避重试推进
const CONCURRENCY = Number((args.find((a) => a.startsWith('--concurrency=')) || '').split('=')[1]) || 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const strip = (text) => String(text || '').replace(/^[A-D]\.\s*/, '').trim();

/** 可复现随机：同一个种子永远得到同一套打散结果，方便比对与回滚 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 只处理"确定是垃圾"的题：占位文案或选项重复。
 * 故意不看长度 —— "向量检索"这类 4 字选项是正常表述，按长度误伤会毁掉好数据。
 */
function needsRegen(question) {
  const opts = (question.options || []).map(strip);
  if (opts.some((o) => PLACEHOLDER.test(o))) return true;
  return new Set(opts).size !== opts.length;
}

function llmConfig() {
  const apiKey = process.env.LLM_API_KEY || process.env.MIMO_API_KEY || '';
  const apiBase = process.env.LLM_API_BASE || 'https://api.mimo.com/v1';
  const model = process.env.LLM_MODEL || 'mimo-v2.5';
  if (!apiKey) throw new Error('未配置 LLM_API_KEY，无法生成干扰项');
  return { apiKey, apiBase, model };
}

/** 429/5xx 按指数退避重试；上游配额是分钟级的，等得起比丢题好 */
async function requestCompletion(cfg, prompt, attempt = 0) {
  const MAX_ATTEMPTS = 5;
  const response = await fetch(`${cfg.apiBase.replace(/\/?$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 400,
    }),
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= MAX_ATTEMPTS - 1) throw new Error(`LLM HTTP ${response.status}（重试 ${MAX_ATTEMPTS} 次仍失败）`);
    const hint = Number(response.headers.get('retry-after'));
    const wait = Number.isFinite(hint) && hint > 0 ? hint * 1000 : 2000 * 2 ** attempt;
    await sleep(Math.min(wait, 30_000));
    return requestCompletion(cfg, prompt, attempt + 1);
  }
  if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
  return response;
}

async function generateDistractors(cfg, question, retry = 0) {
  const opts = (question.options || []).map(strip);
  const correct = opts[String(question.answer).charCodeAt(0) - 65] || '';
  const prompt = `你是 AI 应用开发岗的面试出题人。下面是一道四选一的正确选项与解析，请为它补 3 个干扰项。

题干：${question.title}
正确选项：${correct}
解析：${String(question.content || '').slice(0, 600)}

要求：
1. 每条 12~40 字，语气与正确选项一致（专业、具体），不要写成一句空话
2. 必须确实错误：不能与正确选项部分同义，不能用"以上都不对""无法确定"这类兜底表述
3. 三条分别踩不同的常见误区（例如把相近概念混为一谈、因果或时机说反、把工程手段说成唯一解）
4. 只输出 JSON 数组，形如 ["...","...","..."]，不要额外文字`;

  const response = await requestCompletion(cfg, prompt);
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || '';
  const match = text.match(/\[[\s\S]*\]/);
  let items = [];
  try {
    items = match ? JSON.parse(match[0]) : [];
  } catch {
    items = [];
  }

  const cleaned = items
    .map((s) => strip(s))
    .filter((s) => s.length >= OPT_MIN && s.length <= OPT_MAX && !PLACEHOLDER.test(s) && s !== correct);
  const unique = [...new Set(cleaned)];

  if (unique.length < 3 && retry < 2) {
    return generateDistractors(cfg, question, retry + 1);
  }
  if (unique.length < 3) throw new Error(`只拿到 ${unique.length} 个合格干扰项`);
  return unique.slice(0, 3);
}

/** 把正确项放到"当前题数最少"的位置，四等分整体分布 */
function balancePositions(questions, seed = 20260921) {
  const rand = mulberry32(seed);
  const slots = { A: 0, B: 0, C: 0, D: 0 };

  for (const q of questions) {
    const texts = (q.options || []).map(strip);
    const correctText = texts[String(q.answer).charCodeAt(0) - 65];
    if (!correctText) continue;

    const distractors = texts.filter((_, i) => String.fromCharCode(65 + i) !== q.answer);
    // 打散干扰项自身顺序，避免"最长的那个是答案"这类位置线索
    for (let i = distractors.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
    }

    // 四个位置都参与比较（含 A）：只看当前最少的那个，
    // 若把题原答案所在位排除在外，会把所有题都推离原位、分布反而更偏
    const position = ['A', 'B', 'C', 'D'].sort((a, b) => slots[a] - slots[b])[0];
    const index = position.charCodeAt(0) - 65;

    const ordered = [...distractors];
    ordered.splice(index, 0, correctText);

    q.options = ordered.map((t, i) => `${String.fromCharCode(65 + i)}. ${t}`);
    q.answer = position;
    slots[position] += 1;
  }
  return slots;
}

async function main() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const questions = JSON.parse(raw);
  const cfg = llmConfig();

  const before = questions.reduce((acc, q) => ((acc[q.answer] = (acc[q.answer] || 0) + 1), acc), {});
  const todo = questions.filter(needsRegen);
  console.log(`题目 ${questions.length} 道；答案分布(前) ${JSON.stringify(before)}；需重生成干扰项 ${todo.length} 道`);
  console.log(`模式：${DRY_RUN ? 'dry-run（不写盘）' : '写回'}；并发 ${CONCURRENCY}${LIMIT ? `；本次上限 ${LIMIT} 道` : ''}\n`);

  const targets = LIMIT > 0 ? todo.slice(0, LIMIT) : todo;
  const failed = [];
  let done = 0;

  const worker = async (queue) => {
    for (;;) {
      const q = queue.shift();
      if (!q) return;
      try {
        const fresh = await generateDistractors(cfg, q);
        const texts = (q.options || []).map(strip);
        const correctText = texts[String(q.answer).charCodeAt(0) - 65];
        q.options = [correctText, ...fresh].map((t, i) => `${String.fromCharCode(65 + i)}. ${t}`);
        q.answer = 'A';
        q._regenerated = true;
      } catch (e) {
        failed.push({ id: q.id, error: e.message });
      } finally {
        done += 1;
        if (done % 20 === 0 || done === targets.length) console.log(`  已处理 ${done}/${targets.length}`);
      }
    }
  };

  const queue = [...targets];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  console.log(`\n干扰项生成完成：成功 ${targets.length - failed.length}，失败 ${failed.length}`);
  for (const f of failed.slice(0, 10)) console.log(`  ${f.id}: ${f.error}`);

  const slots = balancePositions(questions);
  console.log('答案分布(后):', JSON.stringify(slots));

  const stillBad = questions.filter(needsRegen);
  console.log(`修复后仍有可疑选项的题数: ${stillBad.length}${stillBad.length ? ` → ${stillBad.slice(0, 5).map((q) => q.id).join(', ')}` : ''}`);

  if (DRY_RUN) {
    const sample = questions.find((q) => q._regenerated);
    if (sample) {
      console.log('\n[dry-run] 重生成样例:', sample.id, sample.title);
      sample.options.forEach((o) => console.log('   ', o));
      console.log('    答案:', sample.answer);
    }
    console.log('\n[dry-run] 未写盘。去掉 --dry-run 才会真正修改 data/questions.json');
    return;
  }

  const backup = `${DATA_FILE}.bak-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)}`;
  fs.writeFileSync(backup, raw);
  // 内部标记不落库
  const output = questions.map(({ _regenerated, ...rest }) => rest);
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\n已写回 data/questions.json（备份：${path.basename(backup)}）`);
  console.log('建议抽查：git diff --stat data/questions.json');
}

main().catch((e) => {
  console.error('修复失败:', e.message);
  process.exitCode = 1;
});
