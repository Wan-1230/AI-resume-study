// backend/package.json 未声明 type:module，这里统一用 CJS 写法（node --test 直接可跑）
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { splitSections, scoreOf, related } = require('../resume/match.js');

test('简历切分：有 Markdown 标题时按标题分节，节名可用于证据定位', () => {
  const resume = ['# 基本信息', '张三，3 年经验。', '', '# 技能', 'Python、LangChain、RAG。', '', '# 项目经历', '做过知识库问答。'].join('\n');
  const sections = splitSections(resume);
  assert.deepEqual(sections.map((s) => s.heading), ['基本信息', '技能', '项目经历']);
  assert.match(sections[1].text, /LangChain/);
});

test('简历切分：纯文本没有标题时按空行分段，退化成"第 N 段"', () => {
  const sections = splitSections('第一段内容，讲工作经历。\n\n第二段内容，讲项目成果。\n\n第三段内容，讲技能。');
  assert.equal(sections.length, 3);
  assert.deepEqual(sections.map((s) => s.heading), ['第 1 段', '第 2 段', '第 3 段']);
});

test('简历切分：整段无换行的粘贴文本也不产生空节', () => {
  const sections = splitSections('只有一行简历内容，没有任何分段。');
  assert.equal(sections.length, 1);
  assert.equal(sections[0].heading, '全文');
});

/** 分数必须是判定汇总出来的，而不是模型报的数 —— 这条测试锁住这个设计 */
test('匹配分：命中 1 / 部分 0.5 / 未命中 0，按条目加权而不是分组平均', () => {
  const items = [
    { kind: 'skill', verdict: 'hit' },
    { kind: 'skill', verdict: 'partial' },
    { kind: 'skill', verdict: 'missing' },
    { kind: 'experience', verdict: 'hit' },
    { kind: 'experience', verdict: 'hit' },
  ];
  const scores = scoreOf(items);
  assert.equal(scores.groups.skill, 50, 'skill 三项 (1+0.5+0)/3 = 50%');
  assert.equal(scores.groups.experience, 100);
  assert.equal(scores.groups.project, null, 'JD 里没有项目类要求时不能凭空给 0 分');
  // 总分是逐条加权：(1+0.5+0+1+1)/5 = 70%。
  // 不是"分组百分比再平均"（那样会得到 (50+100)/2 = 75%，让只有一条要求的类别和三条的等权）
  assert.equal(scores.overall, 70);
  assert.notEqual(scores.overall, Math.round((50 + 100) / 2), '总分不能退化成分组平均');
  assert.deepEqual(scores.counts, { hit: 3, partial: 1, missing: 1 });
});

test('匹配分：空清单不炸，总数为 0', () => {
  const scores = scoreOf([]);
  assert.equal(scores.overall, 0);
  assert.deepEqual(scores.counts, { hit: 0, partial: 0, missing: 0 });
});

/** 相干闸门：知识库只覆盖 AI 岗，挂错条目比不挂更糟 */
test('相干闸门：只有真的谈到同一件事才允许挂站内条目', () => {
  const yes = [
    ['有 RAG 系统落地经验，熟悉切块与 rerank', 'RAG 检索优化'],
    ['能建设评测体系（Recall@k、MRR）', 'AI 应用评测体系'],
    ['有向量数据库生产使用经验', 'RAG 向量索引算法和向量数据库'],
  ];
  for (const [req, title] of yes) assert.equal(related(req, title), true, `应当判为相干：${title}`);

  const no = [
    ['精通 MySQL 分库分表与 SQL 调优', 'RAG 检索优化'],
    ['熟悉 Kafka、RocketMQ 等消息中间件', 'AI Agent 核心概念详解'],
    ['有电商交易或库存系统经验', 'GraphRAG 详解'],
  ];
  for (const [req, title] of no) assert.equal(related(req, title), false, `不应当相干：${title}`);
});

test('相干闸门：空文本与纯符号不会误判为相关', () => {
  assert.equal(related('', ''), false);
  assert.equal(related('。。。', '？？？'), false);
  assert.equal(related('熟悉 Python', 'python 环境搭建'), true, '英文词比对要忽略大小写');
});
