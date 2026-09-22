// backend/package.json 未声明 type:module，这里统一用 CJS 写法（node --test 直接可跑）
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const { createSplitter, splitDocuments } = require('../rag/langchain/splitters.js');
const { loadSources, sanitizeMetadata } = require('../rag/langchain/loaders.js');
const { Document } = require('@langchain/core/documents');

const longText = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 句：向量检索把文本变成坐标，坐标相近不代表事实相关。`).join('\n');

test('分块：短文档原样通过（知识库 JSON 已是切片，不该被二次切碎）', async () => {
  const docs = [new Document({ pageContent: 'Token 是大模型处理文本的基本单位。', metadata: { doc_id: 'q1', title: '标题' } })];
  const chunks = await splitDocuments(createSplitter({ chunkSize: 800, chunkOverlap: 120 }), docs);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].metadata.chunk_total, 1);
  assert.equal(chunks[0].id, 'q1::0', 'chunk id 必须由 doc_id 推导，Chroma upsert 才幂等');
});

test('分块：长文档切成多块，id 连续且保留来源 metadata', async () => {
  const docs = [new Document({ pageContent: longText, metadata: { doc_id: 'a9', title: '长文', category: 'RAG' } })];
  const chunks = await splitDocuments(createSplitter({ chunkSize: 300, chunkOverlap: 40 }), docs);

  assert.ok(chunks.length > 3, `长文应当切出多块，实际 ${chunks.length}`);
  assert.deepEqual(chunks.map((c) => c.metadata.chunk_index), chunks.map((_, i) => i), 'chunk_index 必须连续');
  chunks.forEach((c, i) => assert.equal(c.id, `a9::${i}`));
  assert.ok(chunks.every((c) => c.metadata.title === '长文' && c.metadata.category === 'RAG'), '每块都要带上来源信息');
  assert.ok(chunks.every((c) => c.pageContent.length <= 320), '块长不应明显超过 chunkSize');
});

test('分块：多份文档互不串号', async () => {
  const docs = [
    new Document({ pageContent: longText, metadata: { doc_id: 'a1' } }),
    new Document({ pageContent: longText, metadata: { doc_id: 'a2' } }),
  ];
  const chunks = await splitDocuments(createSplitter({ chunkSize: 300, chunkOverlap: 40 }), docs);
  const ids = chunks.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'chunk id 不能重复');
  assert.ok(ids.some((id) => id.startsWith('a1::')) && ids.some((id) => id.startsWith('a2::')));
});

test('元数据清洗：交给 Chroma 的每个值都必须是标量', () => {
  const clean = sanitizeMetadata({
    doc_id: 'q1', title: '标题', category: null, url: undefined, nested: { a: 1 }, list: [1, 2], score: 0.42, flag: true, num: 0,
  });
  assert.equal(clean.doc_id, 'q1');
  assert.equal(clean.score, 0.42);
  assert.equal(clean.flag, true, '布尔是合法标量');
  assert.equal(clean.num, 0, '数字 0 不该被当成空值丢掉');
  assert.equal('category' in clean, false, 'null 值 Chroma 不收');
  assert.equal('url' in clean, false, 'undefined 同理');
  // 对象/数组不是丢掉而是序列化：信息保留，类型仍然合法，检索回来还能读
  assert.equal(typeof clean.nested, 'string');
  assert.deepEqual(JSON.parse(clean.nested), { a: 1 });
  assert.deepEqual(JSON.parse(clean.list), [1, 2]);
  Object.values(clean).forEach((value) => {
    assert.ok(['string', 'number', 'boolean'].includes(typeof value), `清洗后残留了非标量值：${JSON.stringify(value)}`);
  });
});

test('加载器：markdown 文件变成带来源的文档', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rag-load-'));
  try {
    writeFileSync(join(dir, 'note.md'), '# 一、向量库\n\n内容一。\n\n## 二、切块\n\n内容二。', 'utf-8');
    const { documents } = loadSources([dir], dir);
    assert.ok(documents.length >= 1, '目录应当被递归扫描');
    const doc = documents.find((d) => /向量库|内容一/.test(d.pageContent));
    assert.ok(doc, 'markdown 内容应当被读进来');
    assert.ok(doc.pageContent.length > 0);
    assert.equal(doc.metadata.source, 'file');
    assert.match(doc.metadata.title, /note\.md/, '标题要能认出是哪个文件');
    // 文件来源没有语料 id，chunk id 会退化成按顺序生成的 doc-N —— 全量重建没问题，
    // 但增量导入时它会随顺序漂移，这条断言把这个已知边界钉在这里而不是假装看不见
    assert.equal(doc.metadata.doc_id, undefined);
    Object.entries(doc.metadata).forEach(([key, value]) => {
      assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value), `${key} 必须是可以直接入库的标量`);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
