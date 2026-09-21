/**
 * LangChain RAG 向量存储模块
 * 职责：统一封装不同向量库的写入与相似度检索，各后端实现同一接口：
 *   initialize / addDocuments / similaritySearchWithScore / count / deleteAll
 * 返回的 score 统一为相似度语义（cosine，越大越相似），屏蔽后端距离差异。
 *
 * 后端选择（VECTOR_BACKEND）：
 *   - memory（默认）：LangChain MemoryVectorStore（纯 JS 内存 + cosine），
 *     向量持久化为 JSON（VECTOR_STORE_PATH），零外部依赖，生产兜底
 *   - chroma：ChromaDB 服务端（本地启动方式见 CHROMA_SETUP.md）
 *   - auto：优先探测 Chroma 服务端（3 秒超时），不可用回退 memory
 * 接入其他向量库（pgvector/Qdrant/FAISS 等）时实现同样接口并在 createVectorStore 注册。
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Document } = require('@langchain/core/documents');
const { MemoryVectorStore } = require('@langchain/classic/vectorstores/memory');
const { Chroma } = require('@langchain/community/vectorstores/chroma');
const { ChromaClient } = require('chromadb');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 分批写入时的进度输出间隔，避免刷屏 */
const LOG_EVERY_BATCHES = 4;

function logBatchProgress(done, total) {
  if (done === total || (done / 64) % LOG_EVERY_BATCHES === 0) {
    console.log(`  📄 已嵌入 ${done}/${total}`);
  }
}

class MemoryVectorStoreAdapter {
  constructor(storeConfig, embeddings) {
    this.cfg = storeConfig;
    this.embeddings = embeddings;
    this.store = new MemoryVectorStore(embeddings);
    this.backendName = 'memory';
    this.embeddingId = null;
  }

  get filePath() {
    return path.join(this.cfg.dataPath, 'memory_vectors.json');
  }

  async initialize(embeddingId) {
    this.embeddingId = embeddingId;
    console.log('📦 初始化向量存储（memory 模式）...');

    if (fs.existsSync(this.filePath)) {
      try {
        const saved = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        if (saved.embedding === embeddingId && Array.isArray(saved.vectors) && saved.vectors.length) {
          await this.store.addVectors(
            saved.vectors.map((v) => v.embedding),
            saved.vectors.map(
              (v) => new Document({ pageContent: v.content, metadata: v.metadata, id: v.id })
            )
          );
          console.log(`  ✅ 从缓存加载 ${this.store.memoryVectors.length} 个向量（embedding: ${embeddingId}）`);
        } else {
          console.log(`  ⚠️ 缓存 embedding 不匹配（${saved.embedding || '未记录'} ≠ ${embeddingId}），等待重新导入`);
        }
      } catch (e) {
        console.log('  ⚠️ 缓存文件损坏，等待重新导入');
      }
    }

    return this;
  }

  async addDocuments(documents, { batchSize = 64 } = {}) {
    if (!documents.length) return;
    for (let start = 0; start < documents.length; start += batchSize) {
      const batch = documents.slice(start, start + batchSize);
      await this.store.addDocuments(batch);
      logBatchProgress(Math.min(start + batchSize, documents.length), documents.length);
    }
    this.persist();
    console.log(`  ✅ memory 向量库现共 ${this.store.memoryVectors.length} 条记录`);
  }

  /** 向量 + 原文 + metadata 整体落盘，重启后无需重新嵌入 */
  persist() {
    fs.mkdirSync(this.cfg.dataPath, { recursive: true });
    const payload = {
      embedding: this.embeddingId,
      savedAt: new Date().toISOString(),
      vectors: this.store.memoryVectors.map((v) => ({
        content: v.content,
        embedding: v.embedding,
        metadata: v.metadata,
        id: v.id,
      })),
    };
    fs.writeFileSync(this.filePath, JSON.stringify(payload));
  }

  async similaritySearchWithScore(query, k) {
    // MemoryVectorStore 返回 cosine 相似度（越大越相似），无需换算
    const results = await this.store.similaritySearchWithScore(query, k);
    return results.map(([document, score]) => ({ document, score }));
  }

  async count() {
    return this.store.memoryVectors.length;
  }

  async deleteAll() {
    this.store = new MemoryVectorStore(this.embeddings);
    if (fs.existsSync(this.filePath)) fs.rmSync(this.filePath);
    console.log('  🗑️ 已清空 memory 向量库');
  }
}

class ChromaVectorStoreAdapter {
  constructor(storeConfig, embeddings) {
    this.cfg = storeConfig;
    this.embeddings = embeddings;
    this.client = null;
    this.collection = null;
    this.store = null;
    this.backendName = 'chromadb';
  }

  async initialize(embeddingId) {
    this.embeddingId = embeddingId;
    console.log('📦 初始化向量存储（ChromaDB 模式）...');

    this.client = new ChromaClient({
      host: this.cfg.host,
      port: this.cfg.port,
      ssl: this.cfg.ssl,
      ...(this.cfg.token ? { headers: { 'x-chroma-token': this.cfg.token } } : {}),
    });

    await this.waitForServer();
    this.collection = await this.ensureCollection(embeddingId);

    // 复用自建 client：保证集合以 cosine 空间创建且经过 embedding 版本校验
    this.store = new Chroma(this.embeddings, {
      index: this.client,
      collectionName: this.cfg.collection,
    });

    const count = await this.collection.count();
    console.log(`  ✅ 已连接 http://${this.cfg.host}:${this.cfg.port}，集合 "${this.cfg.collection}" 共 ${count} 条记录`);

    return this;
  }

  async waitForServer() {
    const deadline = Date.now() + this.cfg.connectTimeoutMs;
    for (;;) {
      try {
        await this.client.heartbeat();
        return;
      } catch (e) {
        if (Date.now() >= deadline) {
          throw new Error(
            `无法连接 Chroma 服务端 http://${this.cfg.host}:${this.cfg.port}（${this.cfg.connectTimeoutMs}ms 内重试失败）。` +
            `启动方式见 CHROMA_SETUP.md，或将 VECTOR_BACKEND 设为 memory`
          );
        }
        await sleep(500);
      }
    }
  }

  /**
   * 集合必须以 cosine 空间创建，且 metadata.embedding 与当前模型一致；
   * 不一致（如换过 embedding 模型）时删除重建，避免新旧向量混用
   */
  async ensureCollection(embeddingId) {
    const create = () =>
      this.client.getOrCreateCollection({
        name: this.cfg.collection,
        configuration: { hnsw: { space: 'cosine' } },
        metadata: { embedding: embeddingId },
      });

    let collection = await create();
    const meta = collection.metadata || {};
    if (meta.embedding === embeddingId) return collection;

    if ((await collection.count()) > 0) {
      console.log(`  ⚠️ 集合 "${this.cfg.collection}" 的 embedding 不一致（${meta.embedding || '未记录'} ≠ ${embeddingId}），将删除重建`);
    }
    await this.client.deleteCollection({ name: this.cfg.collection });
    collection = await create();
    return collection;
  }

  async addDocuments(documents, { batchSize = 64 } = {}) {
    if (!documents.length) return;

    // 分块 id 确定性（doc_id::序号）→ upsert 幂等，重复导入不产生重复数据
    for (let start = 0; start < documents.length; start += batchSize) {
      const batch = documents.slice(start, start + batchSize);
      await this.store.addDocuments(batch, {
        ids: batch.map((d) => d.id ?? randomUUID()),
      });
      logBatchProgress(Math.min(start + batchSize, documents.length), documents.length);
    }

    console.log(`  ✅ ChromaDB 集合 "${this.cfg.collection}" 现共 ${await this.collection.count()} 条记录`);
  }

  async similaritySearchWithScore(query, k) {
    // Chroma cosine 空间返回 distance = 1 - cosine 相似度，换算为相似度语义
    const results = await this.store.similaritySearchWithScore(query, k);
    return results.map(([document, distance]) => ({ document, score: 1 - distance }));
  }

  async count() {
    return this.collection.count();
  }

  async deleteAll() {
    await this.client.deleteCollection({ name: this.cfg.collection });
    this.collection = await this.ensureCollection(this.embeddingId);
    // 重建 LangChain Chroma 实例，使其内部缓存的集合引用保持有效
    this.store = new Chroma(this.embeddings, {
      index: this.client,
      collectionName: this.cfg.collection,
    });
    console.log('  🗑️ 已清空 ChromaDB 集合');
  }
}

// auto 模式下快速探测，避免 Chroma 缺席时拖慢启动
const PROBE_TIMEOUT_MS = 3000;

/**
 * 向量存储工厂
 * @param {object} config loadConfig() 的完整配置
 * @param {Embeddings} embeddings LangChain Embeddings 实例
 * @param {string} embedId embedding 版本标识
 */
async function createVectorStore(config, embeddings, embedId) {
  const backend = config.store.backend;

  if (backend === 'memory' || backend === 'tfidf') {
    return new MemoryVectorStoreAdapter(config.store, embeddings).initialize(embedId);
  }

  if (backend === 'chroma') {
    return new ChromaVectorStoreAdapter(config.store, embeddings).initialize(embedId);
  }

  // auto：快速探测 Chroma 服务端，不可用回退 memory
  try {
    const probeConfig = {
      ...config.store,
      connectTimeoutMs: Math.min(PROBE_TIMEOUT_MS, config.store.connectTimeoutMs),
    };
    return await new ChromaVectorStoreAdapter(probeConfig, embeddings).initialize(embedId);
  } catch (e) {
    console.log(`  ⚠️ ChromaDB 不可用（${String(e.message).slice(0, 120)}）`);
    console.log('  ⚠️ 回退到 memory 向量库。启动 Chroma 服务端方法见 CHROMA_SETUP.md');
    return new MemoryVectorStoreAdapter(config.store, embeddings).initialize(embedId);
  }
}

module.exports = { createVectorStore, MemoryVectorStoreAdapter, ChromaVectorStoreAdapter };
