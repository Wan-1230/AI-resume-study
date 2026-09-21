/**
 * LangChain RAG 检索模块
 * 职责：
 *   - ScoredRetriever：LangChain BaseRetriever 的标准扩展，相似度检索 + 相似度阈值过滤，
 *     返回的 Document 的 metadata.score 为相似度（0~1，越大越相关），
 *     可直接参与 LCEL 链编排（retriever.invoke(query) / retriever.pipe(...)）
 *   - buildContext：把检索到的 Document 打包成 LLM 提示词上下文（按字符预算截断）
 */

const { BaseRetriever } = require('@langchain/core/retrievers');
const { Document } = require('@langchain/core/documents');

class ScoredRetriever extends BaseRetriever {
  static lc_name() {
    return 'ScoredRetriever';
  }

  constructor({ vectorStore, topK = 5, minScore = 0 }) {
    super();
    this.vectorStore = vectorStore;
    this.topK = topK;
    this.minScore = minScore;
  }

  async _getRelevantDocuments(query) {
    const hits = await this.vectorStore.similaritySearchWithScore(query, this.topK);
    return hits
      .filter((hit) => this.minScore <= 0 || hit.score >= this.minScore)
      .map(
        (hit) =>
          new Document({
            pageContent: hit.document.pageContent,
            metadata: { ...hit.document.metadata, score: Number(hit.score.toFixed(4)) },
            id: hit.document.id,
          })
      );
  }
}

/**
 * 检索结果 → 提示词上下文（按字符预算截断，防止超出模型上下文窗口）
 */
function buildContext(documents, maxChars = 2000) {
  if (!documents.length) return '没有找到相关的知识库内容。';

  let context = '以下是与问题相关的知识库内容：\n\n';
  let used = context.length;

  for (const doc of documents) {
    const meta = doc.metadata || {};
    const block = `【${meta.title || meta.doc_id || '未知来源'}】(${meta.category || '未分类'})\n${doc.pageContent}\n\n`;
    if (used + block.length > maxChars) break;
    context += block;
    used += block.length;
  }

  return context;
}

module.exports = { ScoredRetriever, buildContext };
