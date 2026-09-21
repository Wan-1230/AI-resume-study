# ChromaDB 向量检索部署指南

本项目的向量检索基于 **LangChain RAG 管线**（见 `LANGCHAIN_RAG.md`），向量存储支持两种后端：
默认的 `memory`（内存 + JSON 持久化，零外部依赖）和可选的 **ChromaDB 服务端**。
embedding 始终由本地中文嵌入模型（默认 `Xenova/bge-small-zh-v1.5`，512 维）在 Node 进程内计算，无需申请任何 embedding API Key。

## 工作机制

```
VECTOR_BACKEND=auto（默认）
    │
    ├─ 探测到 Chroma 服务端 ──→ ChromaVectorStore（cosine 向量检索）
    │                             └─ 集合 interview_knowledge，embedding: local:xenova/bge-small-zh-v1.5
    │
    └─ 探测不到（3 秒超时）──→ memory 向量库（LangChain MemoryVectorStore + JSON 持久化）
```

- 生产环境（Render 免费档 / Back4App 单容器）跑不了 Chroma 服务端，**无需任何改动**，
  自动使用 memory 后端；向量落盘在 `backend/vector_store_data/memory_vectors.json`，重启免重新嵌入。
- 本地开发启动 Chroma 服务端后，重启后端即自动切换到 ChromaDB，知识库数据在集合非空时不会重复导入。
- `/api/health` 接口的 `vector_backend` 字段（`chromadb` 或 `memory`）可随时确认当前生效的后端。

## 前置条件

- **Node.js ≥ 20**（`chromadb` npm 客户端要求）
- 本地运行 Chroma 服务端，三选一：
  - **uv（推荐，Windows 可用）**：`uv --version` 确认已安装
  - **Python ≥ 3.10**：`python --version`
  - **Docker**

> 注意：`npx chroma run`（chromadb npm 包自带 CLI）**不支持 Windows x64**（仅 macOS / Linux / Windows ARM64），Windows 用户请用上面三种方式。

## 第一步：启动 Chroma 服务端

**方式 A — uv（无需安装任何东西到全局）：**

```bash
cd backend
uvx --from chromadb chroma run --path ./chroma_data --port 8000
```

**方式 B — Python：**

```bash
pip install chromadb
cd backend
chroma run --path ./chroma_data --port 8000
```

**方式 C — Docker：**

```bash
docker run -d --name chroma -p 8000:8000 -v "%cd%/backend/chroma_data:/data" chromadb/chroma
```

（Linux/macOS 将 `%cd%` 换成 `$(pwd)`）

验证服务端已就绪：

```bash
curl http://localhost:8000/api/v2/heartbeat
```

## 第二步：配置环境变量

编辑 `backend/.env`（可参考 `backend/.env.example`）：

```env
VECTOR_BACKEND=auto
CHROMA_HOST=localhost
CHROMA_PORT=8000
HF_ENDPOINT=https://hf-mirror.com
```

> **HF_ENDPOINT（旧变量 `CHROMA_HF_ENDPOINT` 仍然兼容）**：首次导入/检索时，embedding 模型
> （约 90MB）需要从 HuggingFace CDN 下载并缓存到 `backend/.cache/`。国内网络直连 huggingface.co
> 通常会失败（超时或 TLS 证书错误），指向镜像 `https://hf-mirror.com` 即可。模型只需下载一次；
> 缓存命中后嵌入阶段完全不走网络。

## 第三步：导入知识库并启动后端

```bash
cd backend
npm run ingest     # 显式导入并跑测试查询（全量重建：先清空集合再写入，可重复执行）
npm start          # 启动后端：只读取已生成的索引，不再自动导入（免费实例跑不动运行时嵌入）
```

验证：

```bash
curl http://localhost:3001/api/health
# {"status":"ok","documents_count":661,"vector_backend":"chromadb","embedding":"local:xenova/bge-small-zh-v1.5","top_k":5,"rag_engine":"langchain"}

curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"RAG 召回率低怎么排查？"}'
```

`vector_backend` 显示 `chromadb` 即切换成功（`documents_count` 是分块数：307 个知识条目 → 661 个分块）。
关闭 Chroma 服务端再重启后端，日志会出现回退提示，`vector_backend` 变为 `memory`。

## 环境变量一览

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VECTOR_BACKEND` | `auto` | `auto` / `chroma` / `memory`。`chroma` 为强制模式（连不上直接启动失败），`auto` 不可用时静默回退 memory（旧值 `tfidf` 等同 `memory`） |
| `CHROMA_HOST` | `localhost` | Chroma 服务端地址 |
| `CHROMA_PORT` | `8000` | Chroma 服务端端口 |
| `CHROMA_SSL` | `false` | 是否走 HTTPS |
| `CHROMA_TOKEN` | 空 | 服务端开启 token 鉴权时填写（作为 `x-chroma-token` 头发送） |
| `CHROMA_COLLECTION` | `interview_knowledge` | 集合名 |
| `CHROMA_CONNECT_TIMEOUT_MS` | `30000`（`auto` 探测时 3000） | 心跳重试窗口，兼容服务端晚于后端启动的场景 |
| `HF_ENDPOINT` | 空 | 嵌入模型下载镜像，国内推荐 `https://hf-mirror.com`（旧变量 `CHROMA_HF_ENDPOINT` 仍兼容） |
| `VECTOR_STORE_PATH` | `backend/vector_store_data` | memory 后端的 JSON 持久化目录 |

> `CHROMA_DB_PATH` 是旧 TF-IDF 实现的遗留变量，当前代码已不再读取，可从 `backend/.env` 中删除。

## 数据与持久化

- Chroma 数据落盘在 `backend/chroma_data/`（服务端 `--path` 参数决定），已加入 `.gitignore`。
- embedding 模型缓存位于 `backend/.cache/`，已加入 `.gitignore`。
- 集合 metadata 中记录了 embedding 标识（`local:xenova/bge-small-zh-v1.5`）；若检测到集合由其他模型生成，会自动删除重建，避免新旧向量混用。
- 换 embedding 模型 / 集合损坏时，删除 `backend/chroma_data/` 重启服务端，再执行 `npm run ingest` 重建即可。

## 常见问题

- **日志里反复出现 `Cannot instantiate a collection with the DefaultEmbeddingFunction. Please install @chroma-core/default-embed`？**
  可以忽略。这是 `chromadb` JS 客户端在实例化集合对象时尝试装配它自带的默认嵌入函数（该包未安装）。
  本项目的向量始终由 LangChain 侧算好后显式传入（写入传 `embeddings`、查询传 `queryEmbeddings`），
  客户端的默认嵌入函数永远不会被调用，因此不影响写入和检索结果。
- **`npm run ingest` 报 `fetch failed` / `unable to verify the first certificate`？**
  模型尚未缓存、正在下载而证书链不通。设 `HF_ENDPOINT=https://hf-mirror.com` 重试，
  仍失败则改用 `NODE_OPTIONS=--use-system-ca npm run ingest`（Node ≥ 22.15 改读系统根证书）。
- **`backend/chroma_db/` 和根目录 `chroma_db/` 是什么？** 旧 TF-IDF 实现的数据目录，
  现在的代码不再读写，确认无需要后可自行删除（Chroma 的实际数据目录是 `backend/chroma_data/`）。

## 接入托管 Chroma（可选）

本地/自部署之外，也可以接 Chroma Cloud 或任何远程 Chroma 服务端：

```env
VECTOR_BACKEND=chroma
CHROMA_HOST=<远程地址>
CHROMA_PORT=443
CHROMA_SSL=true
CHROMA_TOKEN=<API Key>
```

接入后 Render 等单进程生产环境同样能使用 ChromaDB 检索，无需改动代码。
