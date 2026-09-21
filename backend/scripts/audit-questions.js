/**
 * 题库质量审计（P0-4 的度量依据，只读不改文件）
 *   node scripts/audit-questions.js
 * 输出：答案位置分布、占位干扰项、选项重复/过短、分类×难度塌陷。
 */
const fs = require('fs');
const path = require('path');

const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf-8'));

const PLACEHOLDER = /(参考答案内容|请查看详细解析|详见解析|以上都不对|其他选项均正确|都不正确|无法确定|以上说法均|见解析)/;

const answerDist = {};
const issues = [];
let hasAnswerInContent = 0;
let duplicateOptions = 0;
let shortOptions = 0;
let placeholderCount = 0;
const catDiff = {};

for (const q of list) {
  answerDist[q.answer] = (answerDist[q.answer] || 0) + 1;

  const stripped = (q.options || []).map((o) => String(o).replace(/^[A-D]\.\s*/, '').trim());
  const text = `${q.title || ''} ${q.content || ''}`;

  const problems = [];
  if (stripped.some((o) => PLACEHOLDER.test(o))) {
    problems.push('占位干扰项');
    placeholderCount += 1;
  }
  if (new Set(stripped).size !== stripped.length) {
    problems.push('选项重复');
    duplicateOptions += 1;
  }
  if (stripped.some((o) => o.length < 6)) {
    problems.push('选项过短(<6字)');
    shortOptions += 1;
  }
  if (/答案\s*[:：]/.test(q.content || '')) hasAnswerInContent += 1;
  if (!/^["A-D]/.test(String(q.options?.[0] || '')) && !/^[A-D]\./.test(String(q.options?.[0] || ''))) {
    // 选项没有字母前缀也可以（前端按索引编号），只记录一次不告警
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) problems.push(`选项数=${q.options?.length}`);

  const key = `${q.category}|${q.difficulty}`;
  catDiff[key] = (catDiff[key] || 0) + 1;

  if (problems.length) issues.push({ id: q.id, title: String(q.title).slice(0, 34), problems });
}

console.log('题目总数:', list.length);
console.log('答案位置分布:', JSON.stringify(answerDist));
console.log('content 含"答案:"残渣的题数:', hasAnswerInContent);
console.log('含占位干扰项的题数:', placeholderCount);
console.log('选项重复:', duplicateOptions, '| 选项过短:', shortOptions);
console.log('有问题的题目条数:', issues.length, `(${Math.round((issues.length / list.length) * 100)}%)`);
console.log('\n分类×难度:');
const byCat = {};
for (const [k, v] of Object.entries(catDiff)) {
  const [c, d] = k.split('|');
  byCat[c] = byCat[c] || {};
  byCat[c][d] = v;
}
for (const [c, ds] of Object.entries(byCat)) {
  console.log(`  ${c.padEnd(18)} easy=${ds.easy || 0} medium=${ds.medium || 0} hard=${ds.hard || 0}`);
}
console.log('\n问题样例（前 12 条）:');
for (const i of issues.slice(0, 12)) console.log(`  ${i.id} [${i.problems.join(', ')}] ${i.title}`);

const sample = list.find((q) => issues.some((i) => i.id === q.id && i.problems.includes('占位干扰项')));
if (sample) {
  console.log('\n占位干扰项完整样例:', sample.id);
  console.log('  题干:', sample.title);
  sample.options.forEach((o) => console.log('   -', o));
  console.log('  答案:', sample.answer, '| 分类:', sample.category, '| 难度:', sample.difficulty);
}
console.log('\ncontent 字段样例（看是否含"答案:"）:');
console.log(' ', JSON.stringify(list.find((q) => /答案\s*[:：]/.test(q.content || ''))?.content || '').slice(0, 300));
