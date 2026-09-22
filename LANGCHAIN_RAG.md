# LangChain RAG 架构与配置指南

本项目的检索增强生成（RAG）系统基于 **LangChain.js（LangChain 官方 JS 版，1.x）** 重建，
包含 RAG 的四个核心组件：**文档加载与分块 → 向量嵌入 → 向量存储与相似度检索 → LLM 回答生成**。

> 分支说明：本分支 `feat/langchain-rag` 用 LangChain 管线替换了原手写实现
> （TF-IDF 内存检索 / chromadb 客户端直连 / 裸 OpenAI SDK）。
> 如需回退旧版，切回 `main` 分支即可。

## 一、架构总览

```
数据源（.json / .txt / .md / 目录）
      │
      ▼
┌─────────────┐   ┌─────────────┐   ┌──────────────┐
│  loaders.js  │ → │ splitters.js │ → │ embeddings.js │
│  文档加载     │   │  文档分块     │   │  向量嵌入      │
└─────────────┘   └─────────────┘   └──────┬───────┘
                                    ▼
                          ┌──────────────────┐
                          │    stores.js      │
                          │  向量存储/相似度检索 │
                          │  memory（默认）     │
                          │  chroma（可选）     │
                          └────────┬─────────┘
                                   ▼
                          ┌──────────────────┐
                          │   retriever.js    │
                          │  ScoredRetriever  │
                          │ （分数过滤+上下文） │
                          └────────┬─────────┘
                                   ▼
                          ┌──────────────────┐
                          │    chains.js      │
                          │  ChatOpenAI + LCEL│
                          │  RAG 链（流式）     │
                          └────────┬─────────┘
                                   ▼
                     server.js  /api/chat（·/stream）
```

`service.js` 是管线的编排层，把以上组件串成 `RagService`，对上层只暴露
`initialize / ingest / retrieve / chat / chatStream / count / health` 少量接口。

## 二、模块职责

| 模块 | 职责 | 关键扩展点 |
|------|------|-----------|
| `rag/langchain/config.js` | 唯一读取环境变量的地方，产出统一配置对象 | 加配置项只需在此扩展 |
| `rag/langchain/loaders.js` | 文档加载：`.json` 知识库 / `.txt·.md` / 目录（递归）→ `Document[]` | 新数据源类型在 `loadSource` 分发处扩展 |
| `rag/langchain/splitters.js` | 文档分块：`RecursiveCharacterTextSplitter`，短文档原样通过 | 可换 `TokenTextSplitter` / Markdown 专用切分器 |
| `rag/langchain/embeddings.js` | 向量嵌入：本地中文模型（默认，命中 `backend/.cache` 即完全离线）/ OpenAI 兼容 API | 换模型改 `EMBEDDINGS_*` 变量即可 |
| `rag/langchain/stores.js` | 向量存储与相似度检索：`memory`（默认）/ `chroma`，score 统一为 cosine 相似度 | 新后端实现同一接口后在工厂注册 |
| `rag/langchain/retriever.js` | `ScoredRetriever`（BaseRetriever 扩展，相似度阈值过滤）+ 上下文打包 | 可在此加重排（re-rank）/多路召回 |
| `rag/langchain/chains.js` | LLM 回答生成：`ChatOpenAI` + 提示词模板 + LCEL 链（支持流式与对话历史） | 换提示词/模型/加查询改写都在此 |
| `rag/langchain/service.js` | 管线编排：`RagService`，对接 server.js 与 ingest 脚本 | — |

## 三、快速开始

```bash
cd backend
npm install          # 安装依赖（LangChain 相关包已写入 package.json）

npm run ingest       # 导入知识库：加载 → 分块 → 嵌入 → 写入向量库（幂等，可重复执行）
npm start            # 启动后端（只读索引；索引为空时 AI 接口返回 503 并写明 rag_state=empty）

curl http://localhost:3001/api/health
# {"status":"ok","documents_count":661,"vector_backend":"memory","embedding":"local:xenova/bge-small-zh-v1.5","has_llm":true,"rag_engine":"langchain",...}
```

默认配置下**零外部依赖**：embedding 用本地中文向量模型（缓存于 `backend/.cache`），
向量库用内存 + JSON 持久化，LLM 走任意 OpenAI 兼容接口。
首次使用需下载约 90MB 模型，国内网络建议设 `HF_ENDPOINT=https://hf-mirror.com`。

> 模型只要还在 `backend/.cache/Xenova/bge-small-zh-v1.5/` 里，嵌入阶段就完全不走网络
> （`embeddings.js` 命中缓存后会关掉 transformers.js 的远端请求），
> 代理 / 证书异常的环境不会被首次下载问题卡住。

## 四、环境变量

### LLM（回答生成）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_API_KEY` | 回退 `MIMO_API_KEY` | 任意 OpenAI 兼容服务的 API Key |
| `LLM_API_BASE` | 回退 `MIMO_API_BASE` | 服务地址（默认 `https://api.mimo.com/v1`） |
| `LLM_MODEL` | `mimo-v2.5` | 模型名 |
| `LLM_TEMPERATURE` | `0.85` | 采样温度 |
| `LLM_MAX_TOKENS` | `1500` | 单次回答最大 token |
| `LLM_ENABLED` | `true` | 设为 `false` 强制关闭 LLM（仅返回检索结果，离线调试用） |

### 向量嵌入

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `EMBEDDINGS_PROVIDER` | `local` | `local`（本地中文嵌入模型）/ `openai`（OpenAI 兼容 API） |
| `EMBEDDINGS_MODEL` | `Xenova/bge-small-zh-v1.5`（local）<br>`text-embedding-3-small`（openai） | 模型名。**更换后索引自动重建**，实测对比见「检索质量基线」一节 |
| `EMBEDDINGS_API_BASE` / `EMBEDDINGS_API_KEY` | 复用 `LLM_*` | openai 模式的服务地址与密钥 |
| `EMBEDDINGS_BATCH_SIZE` | `32` | 批量嵌入大小 |
| `HF_CACHE_DIR` | `backend/.cache` | 本地模型缓存目录 |
| `HF_ENDPOINT` | 空 | HuggingFace 下载镜像，国内推荐 `https://hf-mirror.com`（兼容旧变量 `CHROMA_HF_ENDPOINT`） |

### 向量存储

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VECTOR_BACKEND` | `auto` | `memory`（内存 + JSON 持久化）/ `chroma`（ChromaDB 服务端）/ `auto`（探测 Chroma，3 秒超时回退 memory）；旧值 `tfidf` 等同 `memory` |
| `VECTOR_STORE_PATH` | `backend/vector_store_data` | memory 模式的持久化目录 |
| `CHROMA_HOST` / `CHROMA_PORT` / `CHROMA_SSL` | `localhost` / `8000` / `false` | Chroma 服务端连接 |
| `CHROMA_TOKEN` | 空 | 服务端开启 token 鉴权时填写 |
| `CHROMA_COLLECTION` | `interview_knowledge` | 集合名 |
| `CHROMA_CONNECT_TIMEOUT_MS` | `30000` | 连接重试窗口 |

### 分块 / 检索 / 导入

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RAG_CHUNK_SIZE` | `800` | 分块目标字符数 |
| `RAG_CHUNK_OVERLAP` | `120` | 相邻分块重叠字符数 |
| `RAG_TOP_K` | `5` | 检索返回条数 |
| `RAG_MIN_SCORE` | `0.5` | 相似度阈值（0~1），低于阈值的结果被过滤；`0` 表示不过滤。取值按默认模型实测标定，换模型需重测（见「检索质量基线」） |
| `RAG_CONTEXT_MAX_CHARS` | `2000` | 送入提示词的上下文字符预算 |
| `RAG_SOURCES` | `data/documents.json` | 导入数据源，逗号分隔多个 |
| `RAG_INGEST_LIMIT` | `0` | 调试：只导入前 N 个文档，0 为全量 |
| `RAG_BATCH_SIZE` | `64` | 写入向量库的批次大小 |

## 五、数据流细节

1. **加载**：`loaders.js` 把数据源统一为 LangChain `Document`（`pageContent` + 标量 `metadata`），
   原始文档 id 写入 `metadata.doc_id`。
2. **分块**：`splitters.js` 用 `RecursiveCharacterTextSplitter` 切分长文档；
   知识库 JSON 里已有的短片段会原样通过。每个分块获得确定性 id（`doc_id::序号`）。
3. **嵌入**：`embeddings.js` 产出 LangChain `Embeddings` 实例。本地模式通过
   `HuggingFaceTransformersEmbeddings`（mean pooling + normalize，默认模型 512 维）在 Node 进程内计算。
   注意 `cacheDir` / `remoteHost` / `allowRemoteModels` 必须设在 **ESM 构建**的 `env` 上
   （`await import('@huggingface/transformers')`）：LangChain 封装内部用的是 ESM，
   而 `require` 拿到的是另一份 CJS 实例，两者 `env` 互不影响，配错就等于没配。
4. **存储**：`stores.js` 按 `VECTOR_BACKEND` 选择后端，并在元数据中记录 embedding 版本标识
   （`local:xenova/bge-small-zh-v1.5` 等）——**换模型后自动删除重建**，避免新旧向量混用。
5. **检索**：`ScoredRetriever` 走向量库的 `similaritySearchWithScore`，统一换算为 cosine
   相似度（0~1，越大越相关），按 `RAG_MIN_SCORE` 过滤后把分数写入 `metadata.score`。
   全部结果都被过滤时 `chat` / `chatStream` 直接返回「知识库里没找到」并带 `abstained: true`，
   **不会**把空上下文塞给模型——那样它会用参数记忆编一段像样但没依据的答案，还白烧一次推理。
6. **生成**：`chains.js` 用 LCEL 组装 `检索 → 上下文打包 → ChatPromptTemplate → ChatOpenAI →
   StringOutputParser`。输入 `{ question, history }`，支持 `chain.stream()` 流式输出。
   `buildContext` 给每块资料打上 `[1] [2] …` 编号，提示词要求模型在句末引用对应编号；
   前端 `MarkdownLite` 把 `[n]` 渲染成可点角标，点击滚到第 n 张来源卡片并高亮 ——
   编号与 `sources[n-1]` 严格对应（同一批文档、同一顺序，截断只砍尾部）。

### 数据与持久化

- memory 模式：向量 + 原文 + metadata 整体落盘到 `backend/vector_store_data/memory_vectors.json`
  （已加入 `.gitignore`），重启直接加载，无需重新嵌入。
- chroma 模式：数据由 Chroma 服务端落盘（`--path` 目录，默认 `backend/chroma_data/`）。
- `npm run ingest` 是**全量重建**语义：先清空后写入，可安全重复执行。

### 检索质量基线（实测，2026-09-22）

60 条人工标注（25 题干改写 + 20 文章级改写 + 15 负样本，见 `backend/data/retrieval-eval.json`），
一条命令复现：

```bash
cd backend
node scripts/eval-retrieval.js                          # 当前配置
node scripts/eval-retrieval.js --json=a.json            # 存快照
node scripts/eval-retrieval.js --compare=a.json,b.json  # 出差异表
```

| 默认本地模型 | hit@1 | hit@3 | hit@5 | MRR@5 |
|---|---|---|---|---|
| `Xenova/all-MiniLM-L6-v2`（旧） | 13.3% | 31.1% | 46.7% | 0.240 |
| `Xenova/bge-small-zh-v1.5`（现） | 53.3% | 66.7% | 73.3% | 0.614 |

英文 MiniLM 在中文语料上是主要瓶颈，换模型即可拿到 +26.7pt 的 hit@5；memory 与 chromadb 两个后端逐项一致。

阈值不能当"拒答开关"用：负样本 top1 分数落在 0.426~0.728，正样本落在 0.532~0.762，两者大面积重叠。
`RAG_MIN_SCORE=0.5`（已是代码默认值）是免费的：拒掉 20% 无关查询、真命中零损失；再往上就要拿真命中换拒答率
（0.55 → 保留 71.1%，0.6 → 保留 57.8%）。所以它只当噪声闸门用——想「可靠拒答」得靠更聪明的信号
（比如让模型判断资料是否支撑回答），而不是继续调这个数；过滤到空结果时的拒答分支已经内置在 `service.js`。

## 六、扩展指南

- **换 LLM**：改 `LLM_API_BASE` / `LLM_MODEL` / `LLM_API_KEY` 指向任意 OpenAI 兼容服务即可，
  代码零改动（`@langchain/openai` 的 `ChatOpenAI`）。
- **换 embedding 模型**：改 `EMBEDDINGS_MODEL`；索引会在下次启动/导入时自动重建。
- **加自定义知识源**：PDF/网页等可在 `loaders.js` 的 `loadSource` 分发处接入对应
  LangChain Loader（如 `PDFLoader`）。
- **换向量库**：在 `stores.js` 按现有 `MemoryVectorStoreAdapter` 的接口实现新适配器
  （`initialize / addDocuments / similaritySearchWithScore / count / deleteAll`），
  并在 `createVectorStore` 注册。
- **检索优化**：`retriever.js` 中可加 re-rank、多路召回（向量 + BM25）、查询改写等；
  阈值过滤已内置（`RAG_MIN_SCORE`）。
- **调提示词**：`chains.js` 的 `SYSTEM_PROMPT` 与消息模板。

## 七、常见问题

- **`/api/health` 的 `vector_backend` 是什么？** 当前实际生效的向量库后端（`memory` / `chromadb`），
  用于确认配置是否生效。
- **导入报 `fetch failed` / `unable to verify the first certificate`？** 说明模型还没缓存、正在走下载，
  而本机证书链接不上 HuggingFace CDN（常见于代理 MITM）。先设 `HF_ENDPOINT=https://hf-mirror.com` 重试；
  仍失败则用 `NODE_OPTIONS=--use-system-ca npm run ingest`（Node ≥ 22.15 会改读系统根证书），
  或手动把模型文件放进 `backend/.cache/Xenova/bge-small-zh-v1.5/`。缓存命中后该阶段不再有任何网络请求。
- **导入很慢？** 本地嵌入在 CPU 上运行（661 块约数分钟）；调试时可设 `RAG_INGEST_LIMIT=20` 小批量验证，
  或换 `EMBEDDINGS_PROVIDER=openai` 走 API 嵌入。
- **想完全离线？** `LLM_ENABLED=false` + `VECTOR_BACKEND=memory`，仅检索不生成。
- **模型下载失败？** 设 `HF_ENDPOINT=https://hf-mirror.com` 后重试，模型只需下载一次。
