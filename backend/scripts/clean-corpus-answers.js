#!/usr/bin/env node
/**
 * 清洗 RAG 语料里的"答案: X"残渣（P0-4）
 *
 * 两个理由必须清：
 *  1) 这些字母对问答是纯噪音，却会跟着检索结果一起进 LLM 上下文（实测已出现）
 *  2) repair-questions.js 重排过选项位置后，语料里写死的 "答案: A" 已然是错的答案
 * 只影响 metadata.source === 'question' 的块（307 块中的 30 块）。
 *
 * 用法：node scripts/clean-corpus-answers.js [--write]
 *      改完记得 `npm run ingest` 重建向量库，否则线上检索到的仍是旧文本。
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'documents.json');
const WRITE = process.argv.includes('--write');
const PATTERN = /\n*\s*答案\s*[:：]\s*[A-D]\s*$/;

const raw = fs.readFileSync(FILE, 'utf-8');
const docs = JSON.parse(raw);
let changed = 0;

for (const doc of docs) {
  const text = typeof doc.text === 'string' ? doc.text : '';
  const cleaned = text.replace(PATTERN, '').trimEnd();
  if (cleaned !== text) {
    doc.text = cleaned;
    changed += 1;
  }
}

const remaining = docs.filter((d) => /答案\s*[:：]\s*[A-D]/.test(d.text || '')).length;
console.log(`语料 ${docs.length} 块；清洗 ${changed} 块；仍残留 ${remaining} 块`);

if (!WRITE) {
  console.log('预览模式，未写盘。加 --write 生效（随后执行 npm run ingest 重建向量库）');
  process.exit(0);
}

const backup = `${FILE}.bak-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)}`;
fs.writeFileSync(backup, raw, 'utf-8');
fs.writeFileSync(FILE, `${JSON.stringify(docs, null, 2)}\n`, 'utf-8');
console.log(`已写回 data/documents.json（备份：${path.basename(backup)}）`);
