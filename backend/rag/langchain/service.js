/**
 * LangChain RAG 服务编排模块
 * 职责：把 loader → splitter → embeddings → store → retriever → chain 串成完整 RAG 管线，
 *      对上层（server.js / ingest 脚本）暴露少量稳定接口：
 *   initialize / ingest / retrieve / chat / chatStream / count / health
 */

const { loadConfig, embeddingId, BACKEND_ROOT } = require('./config');
const { loadSources } = require('./loaders');
const { createSplitter, splitDocuments } = require('./splitters');
const { createEmbeddings } = require('./embeddings');
const { createVectorStore } = require('./stores');
const { ScoredRetriever, buildContext } = require('./retriever');
const { createLLM, buildRagChain } = require('./chains');

/**
 * Document → 前端来源对象（字段结构与旧版 /api/chat 保持一致，前端无需改动）
 */
function toSource(document, { truncateContent = 0 } = {}) {
  const m = document.metadata || {};
  const rawContent = document.pageContent;
  return {
    id: m.doc_id || document.id || null,
    title: m.title || m.doc_id || '未知来源',
    content: truncateContent > 0 ? rawContent.slice(0, truncateContent) + '...' : rawContent,
    category: m.category || null,
    source: m.source || null,
    url: m.url || null,
    difficulty: m.difficulty || null,
    score: typeof m.score === 'number' ? m.score : null,
  };
}

function fallbackAnswer(documents, contextMaxChars) {
  return `根据知识库检索，找到以下相关内容：\n\n${buildContext(documents, contextMaxChars)}`;
}

/**
 * 检索一条都没过阈值时的回答。这一步必须发生在调用 LLM 之前：
 * 把空上下文塞给模型，它会用自己的记忆编一段看着很像样的答案，
 * 而这恰恰是 RAG 要避免的失败模式；顺便也省掉一次推理费用。
 */
const ABSTAIN_ANSWER = `知识库里没找到能回答这个问题的内容，我不瞎猜。

你可以换个说法再问一次（比如换成题目里常见的叫法），或者到「练习」页按分类刷一遍相关的题。`;

/**
 * 降级提示必须带上原因。只写"LLM 暂时不可用"，用户会以为是本站故障，
 * 而真实原因往往是上游配额（429）或端点不可达 —— 完全不同的处置方式。
 */
function degradedPrefix(error) {
  const reason = String(error?.message || '未知错误').split('\n')[0].slice(0, 180);
  return `⚠️ AI 生成不可用（${reason}），下面直接给你知识库里检索到的原文：`;
}

/**
 * 启动时探一次 LLM 端点（GET /models，OpenAI 兼容服务的通用能力）。
 * 只判断可达性与鉴权，失败原因保留下来供 /api/health 与前端展示。
 */
async function probeLlm(llm, timeoutMs = 6000) {
  try {
    const url = `${llm.apiBase.replace(/\/?$/, '')}/models`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${llm.apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) return { ok: true };
    const detail = await response.text().catch(() => '');
    return { ok: false, error: `HTTP ${response.status} ${detail.slice(0, 120)}`.trim() };
  } catch (e) {
    return { ok: false, error: e.cause?.code || e.name || String(e.message).slice(0, 120) };
  }
}

class RagService {
  constructor(config = loadConfig()) {
    this.config = config;
    this.splitter = createSplitter(config.splitter);
    this.embeddings = null;
    this.vectorStore = null;
    this.retriever = null;
    this.llm = null;
    this.chain = null;
    this.llmStatus = 'disabled';
    this.llmError = null;
    this.ready = false;
  }

  async initialize() {
    const cfg = this.config;

    // 1) 向量嵌入
    this.embeddings = await createEmbeddings(cfg.embeddings);

    // 2) 向量存储与相似度检索
    this.vectorStore = await createVectorStore(cfg, this.embeddings, embeddingId(cfg.embeddings));
    this.retriever = new ScoredRetriever({
      vectorStore: this.vectorStore,
      topK: cfg.retriever.topK,
      minScore: cfg.retriever.minScore,
    });

    // 3) LLM 回答生成链（未配置 API Key 或 LLM_ENABLED=false 时仅返回检索结果）
    this.llmStatus = 'disabled';
    this.llmError = null;
    if (cfg.llm.enabled && cfg.llm.apiKey) {
      this.llm = createLLM(cfg.llm);
      this.chain = buildRagChain({
        retriever: this.retriever,
        llm: this.llm,
        buildContext,
        contextMaxChars: cfg.retriever.contextMaxChars,
      });
      // 启动即探一次：让"没有 AI"成为可观测状态，而不是等用户提问后静默返回检索原文
      const probe = await probeLlm(cfg.llm);
      this.llmStatus = probe.ok ? 'ready' : 'unreachable';
      this.llmError = probe.error || null;
      console.log(
        probe.ok
          ? `  ✅ LLM 就绪（${cfg.llm.model}）`
          : `  ⚠️ LLM 不可达（${cfg.llm.model}）：${probe.error} —— 问答将只返回知识库检索结果`
      );
    } else {
      console.log('  ⚠️ 未配置 LLM，将仅返回检索结果（LLM_ENABLED / LLM_API_KEY）');
    }

    this.ready = true;
    return this;
  }

  /**
   * 全量重建知识库索引：加载 → 分块 → 嵌入 → 写入向量库（先清空，保证幂等）
   */
  async ingest({ sources, limit, batchSize } = {}) {
    if (!this.ready) await this.initialize();

    const cfg = this.config.ingest;
    console.log('📥 开始导入知识库...');

    const { documents } = loadSources(sources || cfg.sources, BACKEND_ROOT);
    const maxCount = limit ?? cfg.limit;
    const toIndex = maxCount > 0 ? documents.slice(0, maxCount) : documents;

    const chunks = await splitDocuments(this.splitter, toIndex);
    console.log(
      `  🧩 ${toIndex.length} 个文档 → ${chunks.length} 个分块` +
      `（chunkSize=${this.config.splitter.chunkSize}, overlap=${this.config.splitter.chunkOverlap}）`
    );

    await this.vectorStore.deleteAll();
    await this.vectorStore.addDocuments(chunks, { batchSize: batchSize || cfg.batchSize });

    const count = await this.count();
    console.log(`✅ 导入完成，向量库现共 ${count} 条记录`);
    return { documents: toIndex.length, chunks: chunks.length, count };
  }

  /** 相似度检索：返回 Document[]，metadata.score 为相似度（0~1） */
  retrieve(query) {
    return this.retriever.invoke(query);
  }

  /** 非流式问答：返回 { answer, sources }（结构兼容旧版 /api/chat） */
  async chat(message, history = []) {
    const documents = await this.retrieve(message);
    const sources = documents.map((d) => toSource(d, { truncateContent: 200 }));

    if (!documents.length) {
      return { answer: ABSTAIN_ANSWER, sources: [], abstained: true };
    }

    if (!this.chain) {
      return { answer: fallbackAnswer(documents, this.config.retriever.contextMaxChars), sources };
    }

    try {
      const answer = await this.chain.invoke({ question: message, history });
      return { answer, sources };
    } catch (error) {
      console.error('LLM Error:', error.message);
      return {
        answer: `${degradedPrefix(error)}\n\n${buildContext(documents, this.config.retriever.contextMaxChars)}`,
        sources,
      };
    }
  }

  /**
   * 流式问答：onSources 先回调完整来源列表，onChunk 逐段回调答案文本
   * @returns {Promise<string>} 完整答案
   */
  async chatStream(message, history = [], { onChunk, onSources } = {}) {
    const documents = await this.retrieve(message);
    if (onSources) onSources(documents.map((d) => toSource(d)));

    if (!documents.length) {
      if (onChunk) onChunk(ABSTAIN_ANSWER);
      return ABSTAIN_ANSWER;
    }

    if (!this.chain) {
      const fallback = fallbackAnswer(documents, this.config.retriever.contextMaxChars);
      if (onChunk) onChunk(fallback);
      return fallback;
    }

    try {
      let full = '';
      for await (const chunk of await this.chain.stream({ question: message, history })) {
        if (!chunk) continue; // 与 /api/resume/optimize 一致：空片段不占一个 SSE 事件
        full += chunk;
        if (onChunk) onChunk(chunk);
      }
      return full;
    } catch (error) {
      console.error('LLM Stream Error:', error.message);
      const fallback = `${degradedPrefix(error)}\n\n${buildContext(documents, this.config.retriever.contextMaxChars)}`;
      if (onChunk) onChunk(fallback);
      return fallback;
    }
  }

  async count() {
    return this.vectorStore.count();
  }

  health() {
    return {
      vector_backend: this.vectorStore ? this.vectorStore.backendName : null,
      embedding: embeddingId(this.config.embeddings),
      llm_model: this.config.llm.model,
      has_llm: !!this.chain,
      llm_status: this.llmStatus,
      llm_error: this.llmError,
      top_k: this.config.retriever.topK,
      rag_engine: 'langchain',
    };
  }
}

async function createRagService(config) {
  const service = new RagService(config);
  await service.initialize();
  return service;
}

module.exports = { RagService, createRagService, toSource };
