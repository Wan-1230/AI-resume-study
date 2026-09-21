/**
 * LangChain RAG 文档分块模块
 * 职责：把加载得到的长文档切成适合检索的小块。
 *   - 使用 RecursiveCharacterTextSplitter（优先按段落/句子边界递归切分）
 *   - 已被上游分过片的短文档（如知识库 JSON 的既有片段）会原样通过
 *   - 每个分块携带来源 metadata，并生成确定性 chunk id（doc_id::序号），
 *     作为 Chroma upsert 幂等重建的依据
 */

const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { Document } = require('@langchain/core/documents');

function createSplitter(splitterConfig) {
  return new RecursiveCharacterTextSplitter({
    chunkSize: splitterConfig.chunkSize,
    chunkOverlap: splitterConfig.chunkOverlap,
  });
}

/**
 * 按配置分块所有文档
 * @returns {Promise<Document[]>} 分块结果（metadata 附加 chunk_index / chunk_total）
 */
async function splitDocuments(splitter, documents) {
  const chunks = [];
  for (const doc of documents) {
    const docId = doc.metadata.doc_id || doc.id || `doc-${chunks.length}`;
    const pieces = (await splitter.splitText(doc.pageContent)).map((p) => p.trim()).filter(Boolean);
    pieces.forEach((piece, index) => {
      chunks.push(
        new Document({
          pageContent: piece,
          metadata: { ...doc.metadata, chunk_index: index, chunk_total: pieces.length },
          id: `${docId}::${index}`,
        })
      );
    });
  }
  return chunks;
}

module.exports = { createSplitter, splitDocuments };
