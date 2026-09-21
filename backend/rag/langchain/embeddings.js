/**
 * LangChain RAG 向量嵌入模块
 * 职责：提供 LangChain Embeddings 实例，把文本转换成向量。
 *   - local（默认）：HuggingFaceTransformersEmbeddings，本地中文嵌入模型（512 维），
 *     离线可用、零 API 成本，模型缓存复用 backend/.cache（命中缓存后完全不走网络）
 *   - openai：OpenAIEmbeddings，可指向任意 OpenAI 兼容 embedding 服务
 */

const fs = require('fs');
const path = require('path');
const { HuggingFaceTransformersEmbeddings } = require('@langchain/community/embeddings/huggingface_transformers');
const { OpenAIEmbeddings } = require('@langchain/openai');

// FileCache 的落盘布局是 cacheDir/<org>/<model>/<file>，据此判断模型是否已在本地
function isModelCached(cfg) {
  return fs.existsSync(path.join(cfg.cacheDir, ...String(cfg.model).split('/')));
}

/**
 * transformers.js 全局配置：模型缓存目录 + HuggingFace 镜像 + 离线开关
 * 必须配置 ESM 构建的 env：LangChain 封装内部用 `await import(...)` 加载，
 * 而 require 拿到的是独立的 CJS 实例，两份 env 互不影响。
 * （国内网络首次下载约需 90MB，直连 huggingface.co 常超时，可设 HF_ENDPOINT=https://hf-mirror.com）
 */
async function configureTransformersEnv(cfg) {
  const { env } = await import('@huggingface/transformers');
  env.cacheDir = cfg.cacheDir;
  if (cfg.mirror) env.remoteHost = cfg.mirror.replace(/\/?$/, '/');
  // 命中缓存后禁止远端请求：否则每次加载都会向 hub 校验版本，
  // 证书链异常（代理 MITM / 缺 root CA）时会在本地模型完好的情况下仍然失败
  if (isModelCached(cfg)) env.allowRemoteModels = false;
}

async function createEmbeddings(cfg) {
  if (cfg.provider === 'openai') {
    console.log(`  🧮 Embeddings: OpenAI 兼容 API（${cfg.model} @ ${cfg.apiBase}）`);
    return new OpenAIEmbeddings({
      model: cfg.model,
      apiKey: cfg.apiKey,
      batchSize: cfg.batchSize,
      configuration: { baseURL: cfg.apiBase },
    });
  }

  await configureTransformersEnv(cfg);
  console.log(`  🧮 Embeddings: 本地模型（${cfg.model}）`);
  return new HuggingFaceTransformersEmbeddings({
    model: cfg.model,
    batchSize: cfg.batchSize,
  });
}

module.exports = { createEmbeddings };
