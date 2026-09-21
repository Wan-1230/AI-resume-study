/**
 * LangChain RAG 模块统一出口
 * 上层只需要：const { createRagService } = require('./rag/langchain')
 *
 * 目录结构与职责：
 *   config.js     环境变量 → 配置对象（唯一读 env 的地方）
 *   loaders.js    文档加载：JSON 知识库 / txt·md / 目录 → Document[]
 *   splitters.js  文档分块：RecursiveCharacterTextSplitter
 *   embeddings.js 向量嵌入：本地中文嵌入模型 / OpenAI 兼容 API
 *   stores.js     向量存储与相似度检索：memory（默认）/ chroma
 *   retriever.js  检索器（BaseRetriever 扩展）+ 上下文打包
 *   chains.js     LLM 回答生成：ChatOpenAI + LCEL RAG 链
 *   service.js    服务编排：组装管线，暴露 ingest/chat/chatStream/health
 */

module.exports = {
  // 服务编排（推荐入口）
  RagService: require('./service').RagService,
  createRagService: require('./service').createRagService,
  toSource: require('./service').toSource,

  // 各组件（自定义扩展时使用）
  loadConfig: require('./config').loadConfig,
  embeddingId: require('./config').embeddingId,
  loadSources: require('./loaders').loadSources,
  createSplitter: require('./splitters').createSplitter,
  splitDocuments: require('./splitters').splitDocuments,
  createEmbeddings: require('./embeddings').createEmbeddings,
  createVectorStore: require('./stores').createVectorStore,
  ScoredRetriever: require('./retriever').ScoredRetriever,
  buildContext: require('./retriever').buildContext,
  createLLM: require('./chains').createLLM,
  buildRagChain: require('./chains').buildRagChain,
};
