// backend/package.json 未声明 type:module，这里统一用 CJS 写法（node --test 直接可跑）
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ScoredRetriever, buildContext } = require('../rag/langchain/retriever.js');
const { Document } = require('@langchain/core/documents');

const doc = (id, title, text, score) => ({
  document: new Document({ pageContent: text, metadata: { doc_id: id, title, category: 'RAG', score }, id }),
  score,
});

/** 替身向量库：只实现 ScoredRetriever 真正用到的方法 */
function fakeStore(hits) {
  return { similaritySearchWithScore: async () => hits };
}

test('检索：低于阈值的结果被滤掉，保留分数写进 metadata', async () => {
  const hits = [doc('q1', '第一条', '内容一', 0.82), doc('q2', '第二条', '内容二', 0.51), doc('q3', '第三条', '内容三', 0.44)];
  const retriever = new ScoredRetriever({ vectorStore: fakeStore(hits), topK: 3, minScore: 0.5 });

  const out = await retriever.invoke('问题');
  assert.deepEqual(out.map((d) => d.metadata.doc_id), ['q1', 'q2'], '0.44 应当被 0.5 阈值滤掉');
  assert.equal(out[0].metadata.score, 0.82, '分数要带给上层（来源卡片要显示）');
});

test('检索：阈值 0 等于不过滤，且分数保留 4 位', async () => {
  const hits = [doc('q1', 'A', 'x', 0.123456)];
  const out = await new ScoredRetriever({ vectorStore: fakeStore(hits), topK: 1, minScore: 0 }).invoke('问题');
  assert.equal(out.length, 1);
  assert.equal(out[0].metadata.score, 0.1235);
});

test('上下文：每块带 [n] 编号，与 sources 数组下标严格对应', () => {
  const docs = [
    new Document({ pageContent: '第一段正文', metadata: { doc_id: 'q1', title: '标题一', category: 'RAG' } }),
    new Document({ pageContent: '第二段正文', metadata: { doc_id: 'q2', title: '标题二', category: 'RAG' } }),
  ];
  const context = buildContext(docs, 2000);
  assert.match(context, /\[1\]【标题一】/);
  assert.match(context, /\[2\]【标题二】/);
  assert.ok(context.indexOf('[1]') < context.indexOf('[2]'), '编号顺序必须与来源顺序一致');
});

test('上下文：预算不足只砍尾部，编号始终是从 1 开始的连续前缀', () => {
  const block = (n) => new Document({
    pageContent: `正文${n}${'。'.repeat(40)}`,
    metadata: { doc_id: `q${n}`, title: `标题${n}`, category: 'RAG' },
  });
  const docs = [block(1), block(2), block(3), block(4)];

  const numbersOf = (maxChars) => [...buildContext(docs, maxChars).matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));

  const full = numbersOf(4000);
  assert.deepEqual(full, [1, 2, 3, 4], '预算充足时四块都要进上下文');

  const tight = numbersOf(150);
  assert.ok(tight.length > 0 && tight.length < docs.length, '预算收紧后应当少装几块，而不是全丢');
  assert.deepEqual(tight, Array.from({ length: tight.length }, (_, i) => i + 1), '编号必须是 1..k 的连续前缀，答案里的 [n] 才不会指到没送进去的块');
});

test('上下文：空检索给的是"没找到"而不是空串', () => {
  assert.match(buildContext([], 2000), /没有/);
});
