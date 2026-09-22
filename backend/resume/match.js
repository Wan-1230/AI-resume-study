/**
 * 简历 ↔ JD 匹配分析
 *
 * 与"一键改写"的区别是这里要的是**可核对**：先把 JD 拆成一条条可判断的要求，
 * 再逐条回到简历里找证据，分数由命中情况算出来，而不是让模型随口报一个"匹配度 85%"。
 *
 * 两次生成调用：
 *   1) JD → 要求清单（类型 + 原文）
 *   2) 简历 + 要求清单 → 逐条判定（命中/部分/缺失 + 简历里的原句）
 * 之后每条缺口用本地 RAG 补一句"这条想补该看什么"（检索是本地嵌入，不额外花钱）。
 */

const { loadConfig } = require('../rag/langchain/config');
const { createLLM } = require('../rag/langchain/chains');

const MAX_JD_CHARS = 6000;
const MAX_RESUME_CHARS = 12000;
const MIN_REQUIREMENTS = 3;
const MAX_REQUIREMENTS = 12;
const KINDS = new Set(['skill', 'experience', 'project']);
const VERDICTS = new Set(['hit', 'partial', 'missing']);
const WEIGHT = { hit: 1, partial: 0.5, missing: 0 };

const jsonOnly = '只输出一个 JSON 对象，不要 markdown 代码围栏，不要任何解释文字。';

let llm = null;

function getLlm() {
  if (llm) return llm;
  const cfg = loadConfig();
  if (!cfg.llm.enabled || !cfg.llm.apiKey) return null;
  llm = createLLM({ ...cfg.llm, temperature: 0.2, maxTokens: 1600, timeoutMs: 45000 });
  return llm;
}

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * 简历按小节切开，只为给证据定位用（〔项目经历〕比"第 3 段"好核对）。
 * 两条规则，不做花哨判断：有 Markdown 标题就按标题切，否则按空行分段 ——
 * 从 PDF/网页复制进文本框的简历通常已经丢掉格式，猜哪一行是标题容易把短句误判。
 */
function splitSections(resume) {
  const lines = resume.split('\n');
  const hasMarkdownHeadings = lines.some((line) => /^#{1,4}\s+\S/.test(line));

  if (hasMarkdownHeadings) {
    const sections = [];
    let current = { heading: '（开头）', body: [] };
    for (const line of lines) {
      const heading = line.match(/^#{1,4}\s+(.+)$/);
      if (heading) {
        if (current.body.join('').trim()) sections.push({ heading: current.heading, text: current.body.join('\n').trim() });
        current = { heading: heading[1].trim().slice(0, 30), body: [] };
        continue;
      }
      current.body.push(line);
    }
    if (current.body.join('').trim()) sections.push({ heading: current.heading, text: current.body.join('\n').trim() });
    if (sections.length >= 2) return sections;
  }

  const blocks = resume.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean);
  return blocks.length >= 2
    ? blocks.map((text, i) => ({ heading: `第 ${i + 1} 段`, text }))
    : [{ heading: '全文', text: resume.trim() }];
}

/** 要求抽取：只要 JD 里明确写了的，禁止模型补"它大概还需要" */
async function extractRequirements(jd) {
  const prompt = `从下面这段职位描述里抽出**招聘方明确写出的**任职要求，最多 ${MAX_REQUIREMENTS} 条。

规则：
- 只抽 JD 里字面存在的要求，不要补充你"觉得这类岗位应该有的"
- kind 只能是 skill（技能/技术栈）、experience（经验年限与业务场景）、project（项目与成果）三者之一
- text 用 JD 里的原话或其极简缩写，不超过 40 字
- 合并同类项：同一件事不要拆成两条

JD 原文：
${jd}

${jsonOnly} 形如 {"requirements":[{"text":"3 年以上后端开发经验","kind":"experience"}]}`;

  const res = await getLlm().invoke(prompt);
  const parsed = parseJson(typeof res.content === 'string' ? res.content : '');
  const list = Array.isArray(parsed?.requirements) ? parsed.requirements : [];

  return list
    .map((row) => ({
      text: String(row?.text || '').trim().slice(0, 80),
      kind: KINDS.has(String(row?.kind)) ? String(row.kind) : 'skill',
    }))
    .filter((row) => row.text)
    .slice(0, MAX_REQUIREMENTS)
    .map((row, i) => ({ id: `r${i + 1}`, ...row }));
}

/** 逐条判定。evidence 必须是简历里能找到的原句片段，找不到的按缺失处理 */
async function judgeRequirements(requirements, sections) {
  const prompt = `你在做一次真实的简历-JD 匹配核对。下面给出简历（按小节切开）和 JD 的任职要求清单，
请逐条判断简历里有没有支撑。

判定标准：
- hit：简历里有明确写出的对应事实（技术栈、年限、项目成果都能对上）
- partial：沾边但不够（比如 JD 要 RAG 上线经验，简历只写了"了解 RAG 原理"）
- missing：简历里找不到任何支撑

硬性要求：
- evidence 必须是简历原文里出现过的连续片段（最多 60 字），找不到就填 null，**不要用你自己的话概括**
- 每条都要给一句 note，说明差在哪或为什么算命中，不超过 50 字，别写套话
- 只能使用清单里给到的 id，不要新增条目

任职要求：
${requirements.map((r) => `- ${r.id}【${r.kind}】${r.text}`).join('\n')}

简历：
${sections.map((s) => `〔${s.heading}〕\n${s.text}`).join('\n\n')}

${jsonOnly} 形如
{"assessments":[{"id":"r1","verdict":"hit","evidence":"负责 RAG 问答服务上线，日均 2 万次调用","note":"有明确上线数据"}]}`;

  const res = await getLlm().invoke(prompt);
  const parsed = parseJson(typeof res.content === 'string' ? res.content : '');
  const rows = Array.isArray(parsed?.assessments) ? parsed.assessments : [];
  const byId = new Map(rows.map((row) => [String(row?.id || ''), row]));

  return requirements.map((req) => {
    const row = byId.get(req.id) || {};
    const verdict = VERDICTS.has(String(row.verdict)) ? String(row.verdict) : 'missing';
    const evidence = typeof row.evidence === 'string' && row.evidence.trim() ? row.evidence.trim().slice(0, 120) : null;
    // 声称命中却给不出原文证据 → 降级为 partial，避免"模型说有就有"
    const demoted = verdict === 'hit' && !evidence;
    return {
      ...req,
      verdict: demoted ? 'partial' : verdict,
      evidence,
      note: typeof row.note === 'string' ? row.note.trim().slice(0, 100) : null,
      demoted,
    };
  });
}

/** 分数是算出来的：命中 1 / 部分 0.5 / 缺失 0，按类型分别汇总 */
function scoreOf(items) {
  const bucket = (kind) => {
    const rows = items.filter((it) => it.kind === kind);
    if (!rows.length) return null;
    return Math.round((rows.reduce((sum, it) => sum + WEIGHT[it.verdict], 0) / rows.length) * 100);
  };
  const groups = { skill: bucket('skill'), experience: bucket('experience'), project: bucket('project') };
  const present = Object.values(groups).filter((v) => v !== null);
  return {
    overall: present.length ? Math.round(items.reduce((sum, it) => sum + WEIGHT[it.verdict], 0) / items.length * 100) : 0,
    groups,
    counts: {
      hit: items.filter((it) => it.verdict === 'hit').length,
      partial: items.filter((it) => it.verdict === 'partial').length,
      missing: items.filter((it) => it.verdict === 'missing').length,
    },
  };
}

/**
 * 站内条目与这条要求相不相干，用一个很笨但不会说谎的判断：
 * 中文按二元组、英文数字按整词取 token，两边有交集才算相关。
 *
 * 为什么要卡：知识库只覆盖 AI 应用开发岗，JD 里"精通 MySQL 分库分表"照样能检索出
 * "RAG 检索优化"（cosine 分还不低，见 P1-1 的阈值扫描），挂着就是误导 —— 分数不可信时宁可不给。
 */
function tokensOf(text) {
  const s = String(text || '').toLowerCase();
  const latin = new Set(s.match(/[a-z][a-z0-9+#.-]{1,}/g) || []);
  const han = (s.match(/[一-龥]/g) || []).join('');
  const bigrams = new Set();
  for (let i = 0; i + 1 < han.length; i += 1) bigrams.add(han.slice(i, i + 2));
  return { latin, bigrams };
}

function related(requirement, title) {
  const a = tokensOf(requirement);
  const b = tokensOf(title);
  for (const word of b.latin) if (a.latin.has(word)) return true;
  for (const pair of b.bigrams) if (a.bigrams.has(pair)) return true;
  return false;
}

/**
 * 缺口旁挂一条"想补该看什么"。用的是站内知识库的检索结果（本地嵌入，不花钱），
 * 没有相干条目就不硬凑一句"建议学习相关知识"。
 */
async function attachStudyHints(items, retrieve) {
  if (typeof retrieve !== 'function') return items;
  const need = items.filter((it) => it.verdict !== 'hit').slice(0, 6);

  for (const item of need) {
    try {
      const docs = await retrieve(item.text);
      const titles = [...new Set((docs || []).map((d) => d.metadata?.title).filter(Boolean))]
        .filter((title) => related(item.text, title))
        .slice(0, 3);
      if (titles.length) item.study = titles;
    } catch {
      // 检索失败不影响报告主体，少一条提示而已
    }
  }
  return items;
}

/**
 * @param {string} jd 职位描述原文
 * @param {string} resume 简历纯文本
 * @param {(query:string)=>Promise<any[]>} retrieve 知识库检索（返回 LangChain Document[]）
 * @returns {Promise<{ok:true, scores, items, gaps, strengths, sections:number}|{ok:false,error:string}>}
 */
async function analyzeMatch({ jd, resume, retrieve }) {
  const model = getLlm();
  if (!model) return { ok: false, error: '生成能力不可用（检查 LLM_API_KEY / LLM_ENABLED）' };

  const cleanJd = String(jd || '').trim().slice(0, MAX_JD_CHARS);
  const cleanResume = String(resume || '').trim().slice(0, MAX_RESUME_CHARS);
  if (cleanJd.length < 30) return { ok: false, error: 'JD 太短了，至少贴岗位描述的主体部分' };
  if (cleanResume.length < 50) return { ok: false, error: '简历内容太少，先上传文件或粘贴正文' };

  const sections = splitSections(cleanResume);

  let requirements;
  try {
    requirements = await extractRequirements(cleanJd);
  } catch (error) {
    return { ok: false, error: `JD 拆解失败：${String(error.message).split('\n')[0].slice(0, 120)}` };
  }
  if (requirements.length < MIN_REQUIREMENTS) {
    return { ok: false, error: '这份 JD 里没提取到明确要求，换一段更完整的岗位描述再试' };
  }

  let items;
  try {
    items = await judgeRequirements(requirements, sections);
  } catch (error) {
    return { ok: false, error: `逐条核对失败：${String(error.message).split('\n')[0].slice(0, 120)}` };
  }

  await attachStudyHints(items, retrieve);

  const scores = scoreOf(items);
  return {
    ok: true,
    scores,
    items,
    sections: sections.length,
    jd_chars: cleanJd.length,
    resume_chars: cleanResume.length,
    gaps: items.filter((it) => it.verdict !== 'hit').map((it) => it.id),
    strengths: items.filter((it) => it.verdict === 'hit' && it.evidence).map((it) => it.text),
  };
}

module.exports = { analyzeMatch, splitSections, extractRequirements, judgeRequirements, scoreOf, related };
