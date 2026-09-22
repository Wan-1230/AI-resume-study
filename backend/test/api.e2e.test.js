const { test } = require('node:test');
const assert = require('node:assert/strict');

// 端到端：需要后端在跑。CI 里没有 Postgres 与向量索引，所以探测不到就跳过，
// 而不是在 CI 里塞一个假成功 —— 跳过的测试不比失败的测试值钱。
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3001';

let probe;
function health() {
  if (!probe) {
    probe = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(`${BASE}/api/health`, { signal: controller.signal });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
  }
  return probe;
}

async function skipIfDown(t) {
  const data = await health();
  if (!data) t.skip('后端未启动，跳过端到端');
  return data;
}

test('端到端：/api/health 报告 RAG 与依赖状态', async (t) => {
  const data = await skipIfDown(t);
  if (t.diagnostic) { /* 已 skip */ }
  if (!data) return;

  assert.equal(data.status, 'ok');
  assert.ok(data.documents_count > 0, '索引不该是空的');
  assert.ok(['ready', 'initializing', 'empty', 'failed'].includes(data.rag_state), `rag_state 取值异常：${data.rag_state}`);
  assert.ok(['memory', 'chromadb'].includes(data.vector_backend));
  assert.match(data.embedding, /^local:|^openai:/, 'embedding 版本标识要写清楚，换模型时才知道要不要重建索引');
  // db_ok 与 has_llm 是两个独立维度：任一为 false 都不该把另一个也标成坏
  assert.equal(typeof data.db_ok, 'boolean');
  assert.equal(typeof data.has_llm, 'boolean');
});

test('端到端：问一个知识库里没有的问题，得到拒答而不是编造', async (t) => {
  if (await skipIfDown(t)) { /* 后端在线 */ } else return;

  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '帮我推荐上海好吃的本帮菜馆，人均预算 200' }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.abstained, true, '过不了阈值就该明说，而不是硬塞弱相关内容');
  assert.deepEqual(json.sources, [], '拒答时不该还挂着来源卡片');
  assert.match(json.answer, /没找到|没有相关/, `拒答文案要能看懂：${json.answer}`);
});

test('端到端：真实问答带来源与相似度分数', async (t) => {
  const data = await skipIfDown(t);
  if (!data || !process.env.E2E_LLM) {
    t.skip('需要 E2E_LLM=1 显式开启（会真花一次上游额度）');
    return;
  }

  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'RAG 召回率低应该怎么排查？' }),
  });
  const json = await res.json();
  assert.ok(json.sources.length > 0, '正常提问应当有来源');
  json.sources.forEach((source) => {
    assert.equal(typeof source.title, 'string');
    assert.equal(typeof source.score, 'number');
    assert.ok(source.score >= 0 && source.score <= 1, `相似度应在 0~1：${source.score}`);
  });
  // 答案里的 [n] 必须能在来源里找到，否则前端的角标点开会指向不存在的东西
  const marks = [...new Set((json.answer.match(/\[(\d{1,2})\]/g) || []).map((m) => Number(m.slice(1, -1))))];
  marks.forEach((n) => assert.ok(json.sources[n - 1], `角标 [${n}] 越界，来源只有 ${json.sources.length} 条`));
});

test('端到端：/api/stats 的计数与真实语料一致（首页文案的唯一来源）', async (t) => {
  if (!(await skipIfDown(t))) return;

  const stats = await (await fetch(`${BASE}/api/stats`)).json();
  const articles = await (await fetch(`${BASE}/api/articles`)).json();
  const questions = await (await fetch(`${BASE}/api/questions`)).json();

  const articleCount = (Array.isArray(articles) ? articles : articles.data || []).length;
  const questionCount = (Array.isArray(questions) ? questions : questions.data || []).length;

  assert.ok(stats.questions > 0 && stats.articles > 0, '计数不该是 0');
  assert.equal(stats.articles, articleCount, '文章数与 /api/articles 不一致');
  assert.equal(stats.questions, questionCount, '题目数与 /api/questions 不一致');
});
