/**
 * LangChain RAG 配置模块
 * 唯一读取环境变量的地方，其余模块只消费这里的配置对象；
 * 新增配置项时只需在此扩展，便于维护。完整说明见根目录 LANGCHAIN_RAG.md
 */

const path = require('path');
const dotenv = require('dotenv');

const BACKEND_ROOT = path.join(__dirname, '..', '..');

// 幂等加载 backend/.env（dotenv 不会覆盖已存在的环境变量，入口重复调用无害）
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

function toNumber(value, fallback) {
  const n = Number(value);
  return value != null && value !== '' && Number.isFinite(n) ? n : fallback;
}

const LLM_MODEL_DEFAULT = 'mimo-v2.5';
// 中文语料实测（scripts/eval-retrieval.js，60 条人工标注，data/eval-reports/）：
// bge-small-zh-v1.5 hit@1 53.3% / MRR 0.61，all-MiniLM-L6-v2 只有 13.3% / 0.24，故取前者为默认。
const EMBEDDING_LOCAL_MODEL_DEFAULT = 'Xenova/bge-small-zh-v1.5';
const EMBEDDING_OPENAI_MODEL_DEFAULT = 'text-embedding-3-small';

/**
 * @param {NodeJS.ProcessEnv} env
 */
function loadConfig(env = process.env) {
  const llm = {
    // 设 LLM_ENABLED=false 可强制关闭 LLM（仅返回检索结果，适合离线开发/调试）
    enabled: env.LLM_ENABLED !== 'false',
    // 兼容旧变量：未设置 LLM_* 时回退 MIMO_*（保持既有 .env 可用）
    apiKey: env.LLM_API_KEY || env.MIMO_API_KEY || '',
    apiBase: env.LLM_API_BASE || env.MIMO_API_BASE || 'https://api.mimo.com/v1',
    model: env.LLM_MODEL || LLM_MODEL_DEFAULT,
    temperature: toNumber(env.LLM_TEMPERATURE, 0.85),
    maxTokens: toNumber(env.LLM_MAX_TOKENS, 1500),
    // 单次请求的硬上限。不设的话 LangChain 会一直等上游挂死的连接，
    // 免费实例上这条连接同时占着一个并发名额和一个 SSE 心跳定时器
    timeoutMs: toNumber(env.LLM_TIMEOUT_MS, 90_000),
    maxRetries: toNumber(env.LLM_MAX_RETRIES, 0),
  };

  const embeddingsProvider = (env.EMBEDDINGS_PROVIDER || 'local').toLowerCase();
  const embeddings = {
    // local：本地中文嵌入模型（离线、零成本）；openai：任意 OpenAI 兼容 embedding 服务
    provider: embeddingsProvider === 'openai' ? 'openai' : 'local',
    model:
      env.EMBEDDINGS_MODEL ||
      (embeddingsProvider === 'openai' ? EMBEDDING_OPENAI_MODEL_DEFAULT : EMBEDDING_LOCAL_MODEL_DEFAULT),
    apiKey: env.EMBEDDINGS_API_KEY || llm.apiKey,
    apiBase: env.EMBEDDINGS_API_BASE || llm.apiBase,
    batchSize: toNumber(env.EMBEDDINGS_BATCH_SIZE, 32),
    // 本地模型缓存目录与 HuggingFace 镜像（沿用旧系统的 backend/.cache，模型无需重新下载）
    cacheDir: env.HF_CACHE_DIR || path.join(BACKEND_ROOT, '.cache'),
    mirror: env.HF_ENDPOINT || env.CHROMA_HF_ENDPOINT || '',
  };

  const storeBackendRaw = (env.VECTOR_BACKEND || 'auto').toLowerCase();
  const store = {
    // auto：优先探测 Chroma 服务端（3 秒超时），连不上回退 memory
    // chroma：强制使用 ChromaDB（连不上启动失败）；memory / tfidf（旧值）：内存向量库
    backend: ['auto', 'chroma', 'memory', 'tfidf'].includes(storeBackendRaw) ? storeBackendRaw : 'auto',
    // memory 模式的 JSON 持久化目录
    dataPath: env.VECTOR_STORE_PATH || path.join(BACKEND_ROOT, 'vector_store_data'),
    collection: env.CHROMA_COLLECTION || 'interview_knowledge',
    host: env.CHROMA_HOST || 'localhost',
    port: toNumber(env.CHROMA_PORT, 8000),
    ssl: env.CHROMA_SSL === 'true',
    token: env.CHROMA_TOKEN || '',
    connectTimeoutMs: toNumber(env.CHROMA_CONNECT_TIMEOUT_MS, 30000),
  };

  const splitter = {
    chunkSize: toNumber(env.RAG_CHUNK_SIZE, 800),
    chunkOverlap: toNumber(env.RAG_CHUNK_OVERLAP, 120),
  };

  const retriever = {
    topK: toNumber(env.RAG_TOP_K, 5),
    // 0.5 是按默认嵌入模型实测出来的：能滤掉 20% 的无关查询且不伤任何真命中，
    // 到 0.55 就开始误伤（详见 scripts/eval-retrieval.js 的阈值扫描与 data/eval-reports/）。
    // 换 embedding 模型后这个数要重测 —— 不同模型的分数尺度不可比。
    minScore: toNumber(env.RAG_MIN_SCORE, 0.5),
    contextMaxChars: toNumber(env.RAG_CONTEXT_MAX_CHARS, 2000),
  };

  const ingest = {
    // 数据源：逗号分隔，支持 .json 知识库 / .txt·.md 文件 / 目录（递归）
    sources: (env.RAG_SOURCES || 'data/documents.json')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    limit: toNumber(env.RAG_INGEST_LIMIT, 0), // 0 表示全量
    batchSize: toNumber(env.RAG_BATCH_SIZE, 64),
  };

  return { llm, embeddings, store, splitter, retriever, ingest };
}

/**
 * embedding 版本标识：写入存储元数据，模型变化时自动触发索引重建，避免新旧向量混用
 */
function embeddingId(embeddingsConfig) {
  return `${embeddingsConfig.provider}:${embeddingsConfig.model.toLowerCase()}`;
}

module.exports = { loadConfig, embeddingId, BACKEND_ROOT };
