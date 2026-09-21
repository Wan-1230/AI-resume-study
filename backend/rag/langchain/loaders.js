/**
 * LangChain RAG 文档加载模块
 * 职责：把各类数据源统一加载为 LangChain Document[]（pageContent + metadata）。
 *   - .json：知识库导出文件（{ id, text, metadata }[]），已有分片，原样映射
 *   - .txt / .md：纯文本文件，每个文件一个 Document，分块交给 splitters 模块
 *   - 目录：递归收集以上三类文件
 * 新增数据源类型（PDF/网页等）时，在 loadSource 的分发处扩展即可。
 */

const fs = require('fs');
const path = require('path');
const { Document } = require('@langchain/core/documents');
const { BACKEND_ROOT } = require('./config');

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);

/**
 * 向量库 metadata 只接受标量值：过滤 null/undefined，非标量序列化为字符串
 */
function sanitizeMetadata(metadata = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value == null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    } else {
      try {
        clean[key] = JSON.stringify(value);
      } catch (e) {
        // 无法序列化的字段直接丢弃
      }
    }
  }
  return clean;
}

/**
 * 知识库 JSON 文件 → Document[]
 * 原始 id 同时写入 metadata.doc_id，文档被分块后仍能追溯到来源
 */
function loadJsonKnowledge(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const records = Array.isArray(raw) ? raw : raw.documents;
  if (!Array.isArray(records)) {
    throw new Error(`知识库文件格式不正确（期望数组或 { documents: [] }）: ${filePath}`);
  }
  return records
    .filter((r) => r && typeof r.text === 'string' && r.text.trim())
    .map((r) => {
      const metadata = sanitizeMetadata(r.metadata);
      const docId = String(r.id ?? metadata.doc_id ?? path.basename(filePath));
      return new Document({
        pageContent: r.text,
        metadata: { ...metadata, doc_id: docId },
        id: docId,
      });
    });
}

/**
 * 纯文本/Markdown 文件 → Document（每文件一个）
 */
function loadTextFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  if (!text.trim()) return null;
  return new Document({
    pageContent: text,
    metadata: sanitizeMetadata({
      source: 'file',
      title: path.basename(filePath),
      path: filePath,
    }),
  });
}

function walkDirectory(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDirectory(fullPath, files);
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function loadSource(sourcePath, rootDir) {
  const resolved = path.isAbsolute(sourcePath) ? sourcePath : path.join(rootDir, sourcePath);
  if (!fs.existsSync(resolved)) {
    console.warn(`  ⚠️ 数据源不存在，已跳过: ${resolved}`);
    return [];
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const documents = [];
    for (const file of walkDirectory(resolved)) {
      documents.push(...loadSource(file, rootDir));
    }
    return documents;
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext === '.json') return loadJsonKnowledge(resolved);
  if (TEXT_EXTENSIONS.has(ext)) {
    const doc = loadTextFile(resolved);
    return doc ? [doc] : [];
  }
  console.warn(`  ⚠️ 不支持的文件类型（.json/.txt/.md），已跳过: ${resolved}`);
  return [];
}

/**
 * 批量加载数据源（相对路径基于 backend 目录解析）
 * @param {string[]} sources 数据源路径列表
 * @param {string} rootDir 相对路径的基准目录
 * @returns {{ documents: Document[], stats: Array<{ source: string, count: number }> }}
 */
function loadSources(sources, rootDir = BACKEND_ROOT) {
  const documents = [];
  const stats = [];
  for (const source of sources) {
    const loaded = loadSource(source, rootDir);
    documents.push(...loaded);
    stats.push({ source, count: loaded.length });
    console.log(`  📄 ${source}: ${loaded.length} 个文档`);
  }
  return { documents, stats };
}

module.exports = { loadSources, loadSource, sanitizeMetadata };
