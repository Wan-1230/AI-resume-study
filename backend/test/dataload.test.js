const { test } = require('node:test');
const assert = require('node:assert/strict');

const { filterList } = require('../dataload');

const rows = [
  { id: 'q1', category: 'RAG', difficulty: 'easy' },
  { id: 'q2', category: 'RAG', difficulty: 'hard' },
  { id: 'q3', category: 'AI Agent', difficulty: 'hard' },
];

test('列表过滤：不传参数就是全量，保持既有前端契约', () => {
  assert.deepEqual(filterList(rows, {}), rows);
  assert.deepEqual(filterList(rows, undefined), rows);
});

test('列表过滤：分类与难度是叠加条件，limit 只截断不改变顺序', () => {
  assert.deepEqual(filterList(rows, { category: 'RAG' }).map((r) => r.id), ['q1', 'q2']);
  assert.deepEqual(filterList(rows, { category: 'RAG', difficulty: 'hard' }).map((r) => r.id), ['q2']);
  assert.deepEqual(filterList(rows, { limit: '2' }).map((r) => r.id), ['q1', 'q2']);
  assert.deepEqual(filterList(rows, { category: '不存在' }), [], '不匹配的筛选该给空数组而不是全量');
});

test('列表过滤：limit 被夹在合理区间，不能被拿来拖库', () => {
  assert.equal(filterList(rows, { limit: '999999' }).length, 3, '数据本身不足时按实际条数返回');
  assert.equal(filterList(new Array(600).fill({ category: 'RAG', difficulty: 'easy' }), { limit: '999999' }).length, 500);
  assert.deepEqual(filterList(rows, { limit: '0' }), rows, 'limit=0 视为未提供，不该返回空');
  assert.deepEqual(filterList(rows, { limit: 'abc' }), rows, '非数字 limit 不应把接口打挂');
});

test('读取缓存：同一份文件重复读取复用同一次解析结果', () => {
  const { getQuestions } = require('../dataload');
  const first = getQuestions();

  assert.ok(Array.isArray(first.data) && first.data.length > 200, `真实题库应当读得到，实际 ${first.data.length} 条`);
  assert.match(first.etag, /^W\/"[0-9A-Za-z+/]{16}"$/, 'ETag 要稳定且由内容哈希得来');
  // bytes 是文件字节数（UTF-8），body.length 是 JS 字符串长度（UTF-16 码元）：
  // 中文一个字 3 字节但对 JS 只有 1，所以前者必然大于后者，两者不能混用
  assert.ok(first.bytes > first.body.length, '中文题库的字节数应明显大于字符串长度');

  const again = getQuestions();
  assert.equal(again.data, first.data, '文件没变时必须返回同一个数组对象，而不是重新 parse 一遍');
  assert.equal(again.etag, first.etag);
});

test('文章库缺失时返回空数组而不是抛错', () => {
  const { readJsonCached } = require('../dataload');
  const missing = readJsonCached('不存在的文件.json');
  assert.deepEqual(missing.data, []);
  assert.equal(missing.body, '[]');
  assert.equal(missing.etag, 'W/"absent"');
});

test('filterWithTotal：total 是截断前的命中数，不是本次返回条数', () => {
  const { filterWithTotal } = require('../dataload');
  const rows = [
    { id: 1, category: 'RAG', difficulty: 'easy' },
    { id: 2, category: 'RAG', difficulty: 'hard' },
    { id: 3, category: 'RAG', difficulty: 'hard' },
    { id: 4, category: 'LLM', difficulty: 'hard' },
  ];

  const limited = filterWithTotal(rows, { category: 'RAG', limit: 2 });
  assert.equal(limited.items.length, 2, 'limit 该截断');
  assert.equal(limited.total, 3, '但 total 要说清"其实命中 3 条"，否则前端以为 RAG 只有 2 题');

  const both = filterWithTotal(rows, { category: 'RAG', difficulty: 'hard' });
  assert.equal(both.total, 2);
  assert.equal(both.items.length, 2);

  assert.equal(filterWithTotal(rows, {}).total, 4, '不过滤时 total 就是全量');
});
