/**
 * 模拟面试的 LLM 评审器
 *
 * 两件事：逐题「点评 + 追问」，交卷后「六维复盘报告」。
 * 与问答链路的区别是这里**不做检索** —— 面试官考的是候选人说没说清，
 * 不需要再给他一段资料；参考要点直接来自系统题库的解析文本。
 *
 * 没配 LLM 时这里返回 null 而不是抛错，让上层能给出"评审不可用"的诚实状态：
 * 客观题对错是服务端按题库算的，那部分本来就是真的，不该被生成能力拖累。
 */

const { loadConfig } = require('../rag/langchain/config');
const { createLLM } = require('../rag/langchain/chains');

const DIMENSIONS = [
  { key: 'concept', name: '概念准确性', hint: '术语用对没有，原理有没有说反' },
  { key: 'structure', name: '结构完整度', hint: '有没有先给结论再展开，听者能不能跟上' },
  { key: 'practice', name: '实操经验关联', hint: '有没有落到真实做过的事、踩过的坑' },
  { key: 'depth', name: '深度与取舍', hint: '讲没讲 trade-off、边界条件、失败模式' },
  { key: 'evidence', name: '论据一致性', hint: '前后说法是否自洽，有没有自相矛盾或硬凑' },
  { key: 'communication', name: '表达效率', hint: '同样的信息用了几句话说完，有没有绕' },
];

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const MAX_FEEDBACK_TOKENS = 400;
const MAX_REPORT_TOKENS = 1400;

let models = null;
let llmReady = null;

/**
 * 两个实例分开建：ChatOpenAI 的 maxTokens/temperature 是构造期参数，
 * 1.x 的 runnable 上没有 bind(...) 可以按次覆盖（真调用会 model.bind is not a function）。
 * 点评只要两句话，给 1400 的额度纯属浪费；报告正相反。
 */
function getModels() {
  if (llmReady) return models;
  const cfg = loadConfig();
  llmReady = Boolean(cfg.llm.enabled && cfg.llm.apiKey);
  if (!llmReady) return null;
  models = {
    review: createLLM({ ...cfg.llm, temperature: 0.5, maxTokens: MAX_FEEDBACK_TOKENS, timeoutMs: 20000 }),
    report: createLLM({ ...cfg.llm, temperature: 0.4, maxTokens: MAX_REPORT_TOKENS, timeoutMs: 30000 }),
  };
  return models;
}

function getLlm() {
  return getModels()?.report || null;
}

const jsonOnly = '只输出一个 JSON 对象，不要 markdown 代码围栏，不要任何解释性文字。';

/** 从模型输出里抠出第一个 JSON 对象（容忍偶尔的前后缀噪声） */
function parseJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const direct = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(direct);
  } catch {
    const start = direct.indexOf('{');
    const end = direct.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(direct.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * 逐题点评 + 追问一层。
 * @returns {Promise<{feedback:string, follow_up:string}|null>} null = 生成能力不可用
 */
async function reviewAnswer({ question, reference, answer, kind }) {
  const model = getModels()?.review;
  if (!model) return null;

  const openTask = kind === 'open'
    ? '这道题要求展开讲，所以追问要往"具体怎么落地、出过什么问题"的方向逼一层。'
    : '这是选择题，重点看他有没有讲清为什么，追问可以围绕同一知识点往深一层问。';

  const prompt = `你是一位 AI 应用开发方向的面试官，正在和候选人模拟面试。

${openTask}

本考点的参考要点（只用来判断他说得到不到位，不要照抄进反馈）：
${reference || '（无）'}

候选人这一题的回答：
${answer}

请输出：
- feedback：2~4 句口语化的点评。先明确说出他说对了哪一点，再指出最大的那一个缺口。不要罗列他没提到的知识点。
- follow_up：顺着他这段话追问的一个具体问题，面试官口吻，不超过 60 字，必须是一个能直接回答的问题。

${jsonOnly} 形如 {"feedback":"...","follow_up":"..."}`;

  try {
    const res = await model.invoke(prompt);
    const parsed = parseJson(typeof res.content === 'string' ? res.content : '');
    if (!parsed || typeof parsed.feedback !== 'string' || typeof parsed.follow_up !== 'string') return null;
    return {
      feedback: parsed.feedback.trim().slice(0, 600),
      follow_up: parsed.follow_up.trim().slice(0, 200),
    };
  } catch (error) {
    console.error('[interview] 逐题评审失败:', error.message);
    return null;
  }
}

/** 把六维分数收成合法结构；缺项按未评（null）处理，绝不补默认分 */
function normalizeDimensions(raw) {
  if (!Array.isArray(raw)) return null;
  const byKey = new Map(raw.map((d) => [String(d?.key || ''), d]));
  const out = [];
  for (const dim of DIMENSIONS) {
    const hit = byKey.get(dim.key);
    const num = Number(hit?.score);
    out.push({
      key: dim.key,
      name: dim.name,
      score: Number.isFinite(num) ? Math.max(0, Math.min(5, Math.round(num * 2) / 2)) : null,
      reason: typeof hit?.reason === 'string' ? hit.reason.trim().slice(0, 300) : null,
    });
  }
  return out.every((d) => d.score === null) ? null : out;
}

/**
 * 交卷后的复盘报告。
 * transcript 里的客观题对错已由服务端算好，这里只让它评「说得怎么样」。
 * @returns {Promise<{dimensions, strengths, improvements, summary}|{error}>}
 */
async function buildReport({ direction, transcript }) {
  const model = getModels()?.report;
  if (!model) return { error: '生成能力不可用（检查 LLM_API_KEY / LLM_ENABLED）' };

  const lines = transcript.map((item, i) => {
    const facts = [
      `${i + 1}. [${item.category || '未分类'}] ${item.question}`,
      item.kind === 'mcq' ? `   他选：${item.chosen || '未作答'}｜正确：${item.correct_answer || '?'}｜${item.correct ? '答对' : '答错'}` : null,
      `   他的回答：${truncate(item.answer, 700) || '（空）'}`,
      item.follow_up ? `   追问：${item.follow_up}\n   他的补充：${truncate(item.follow_up_answer, 500) || '（未回答）'}` : null,
      `   参考要点：${truncate(item.reference, 400) || '（无）'}`,
    ].filter(Boolean);
    return facts.join('\n');
  });

  const rubric = DIMENSIONS.map((d) => `  - ${d.key}（${d.name}）：${d.hint}`).join('\n');

  const prompt = `你是一位严格的 AI 应用开发工程师面试官，下面是候选人一轮模拟面试的完整记录。
方向：${direction}

面试记录：
${lines.join('\n\n')}

请按下面六个维度给他打分（0~5，允许 0.5 步长），每个维度必须给一句**引用他原话或具体行为**的理由，
不许写"基本正确""有一定了解"这类放到谁身上都成立的空话；说不出依据就给低分。
打分标准：5 = 能讲清原理并主动给出取舍与失败模式；3 = 概念对但只停留在背题；1 = 有明显错误或全程答非所问。

维度：
${rubric}

再给出：
- strengths：最多 3 条，写他这轮里真实做对了什么
- improvements：3~5 条改进清单，每条含 priority(1 最重要)、what(问题)、how(具体怎么补，能照着做)
- summary：3 句话以内的总体判断，直说现在能不能过 AI 应用开发岗的技术面

${jsonOnly} 形如
{"dimensions":[{"key":"concept","score":3.5,"reason":"..."}],"strengths":["..."],"improvements":[{"priority":1,"what":"...","how":"..."}],"summary":"..."}`;

  try {
    const res = await model.invoke(prompt);
    const parsed = parseJson(typeof res.content === 'string' ? res.content : '');
    if (!parsed) return { error: '评审结果无法解析成 JSON，已保留客观题成绩' };

    const dimensions = normalizeDimensions(parsed.dimensions);
    if (!dimensions) return { error: '评审缺少六维打分，已保留客观题成绩' };

    const scored = dimensions.filter((d) => d.score !== null);
    return {
      dimensions,
      score_total: Number((scored.reduce((a, d) => a + d.score, 0) / scored.length).toFixed(2)),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3).map((s) => String(s).slice(0, 200)) : [],
      improvements: Array.isArray(parsed.improvements)
        ? parsed.improvements.slice(0, 5).map((row, i) => ({
            priority: Number(row?.priority) || i + 1,
            what: String(row?.what || '').slice(0, 200),
            how: String(row?.how || '').slice(0, 300),
          })).filter((row) => row.what)
        : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 600) : null,
    };
  } catch (error) {
    console.error('[interview] 报告生成失败:', error.message);
    return { error: `评审调用失败：${String(error.message).split('\n')[0].slice(0, 120)}` };
  }
}

function truncate(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

module.exports = { DIMENSIONS, LETTERS, reviewAnswer, buildReport, getLlm };
