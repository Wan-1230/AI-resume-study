# AI面试宝典 🎯

[![English](https://img.shields.io/badge/🌐-English-blue)](./README.md)
[![简体中文](https://img.shields.io/badge/🌐-简体中文-red)](./README_CN.md)

面向 **AI 应用开发岗** 的面试准备平台：RAG 智能答疑、题库练习与模考、简历与 JD 匹配。
检索用本地中文向量嵌入（离线、零 API 成本），向量库支持内存与 ChromaDB 双后端，回答由任意 OpenAI 兼容的大模型生成。

> 本文档只描述**已经能用**的功能；规划中的能力统一写在 [PRD.md](./PRD.md)，实现进度见其中的进度标注。

## ✨ 功能特性

### 🏠 全屏滚动首页
- 五段式全屏滚动：Hero → AI 助手 → 简历优化 → 题库 → 关于
- WebGL 动态线程背景（OGL）+ GSAP 滚动渐显
- 打字机效果演示 AI 对话

### 🤖 AI 智能问答
- **对话会存下来**：登录后有历史会话侧栏，可回看、重命名、删除、重新生成，并对每条回答点赞/踩
- **管理后台带「检索质量」面板**：真实查询数、拒答率、平均耗时、赞踩比、top1 分数分桶
  （数据来自 `retrieval_log`，只记查询与命中元数据，不记答案正文）
- **LangChain RAG 管线**：文档加载 → 分块 → 向量嵌入 → 向量存储 → 相似度检索 → LLM 生成
  （架构与全部环境变量见 [LANGCHAIN_RAG.md](./LANGCHAIN_RAG.md)）
- 嵌入模型 `Xenova/bge-small-zh-v1.5` 在 Node 进程内计算，**缓存命中后完全离线、不产生任何网络请求**
- 检索质量是可复现的指标，不是形容词：60 条人工标注下 `hit-rate@5 73.3% / MRR 0.61`，
  换模型前的旧默认值是 `46.7% / 0.24`（`node backend/scripts/eval-retrieval.js` 一条命令复现）
- 答案里的每句话都带 `[1] [2]` 角标，点击跳到对应来源并高亮、可展开原文核对；
  资料编号与来源列表严格按同一顺序对齐，越界的角标会被审计脚本抓出来
- 一条资料都没过阈值时直接回答"知识库里没找到"，**不调用模型**——宁可说不知道，也不用参数记忆编一个像样的答案
- 向量后端 `memory`（默认，JSON 持久化，零外部依赖）/ `chroma`（本地 ChromaDB 服务端），
  `auto` 模式探测不到 Chroma 时自动回退 memory，详见 [CHROMA_SETUP.md](./CHROMA_SETUP.md)
- **SSE 流式输出**，逐段渲染 + 光标指示；回答下方展示带相似度分数的参考来源卡片
- 回答按 Markdown 渲染（代码块可一键复制、行内代码、标题、列表）
- LLM 端点即插即用：`LLM_API_BASE` / `LLM_MODEL` 换任意 OpenAI 兼容服务，代码零改动
- 启动时探测一次 LLM 端点，`/api/health` 的 `llm_status` 会区分 `ready / unreachable / disabled`；
  AI 不可用时前端**明确标注并给出原因**（不再静默把检索原文冒充 AI 回答）

### 📝 简历与 JD
- 上传简历（PDF / Word(.docx) / Markdown / TXT，或粘贴文本）+ 职位描述
- 流式输出优化后的简历与修改建议，可一键复制
- **匹配报告**：把 JD 拆成逐条要求，回简历里找原句证据，分数按"命中 / 部分 / 未命中"汇总**算出来**
  （不是让模型报一个 85%），再给缺口清单；同一份简历对 RAG 岗与 Java 岗实测 77% vs 14%
- 缺口旁的"可补"来自站内知识库检索，且带一道相干闸门 —— 只覆盖 AI 岗的库不会往 Java 缺口上硬挂 RAG 条目
- 报告与简历可一键导出 `.docx`（前端生成，服务端不落盘）
- 需要登录：整份简历会外送第三方推理服务，且额度比问答更紧

### 📚 题库与练习
- **练习模式**：按分类 / 难度选题，逐题作答并计时，交卷后统计正确率
- 选项**每次随机排序**（防"记住第几个是答案"），正确答案在题库中按 A/B/C/D 均匀分布
- 服务端按**选项文本**判分，改前端刷不出虚假正确率
- **收藏**、**练习记录**、**错题本**（最近一次答对即从错题毕业）、**模拟面试**（6 选择 + 2 口头展开）
- 模拟面试每题会有面试官针对你说的话追问一层，交卷后按六个维度打分（概念准确性 / 结构完整度 /
  实操经验关联 / 深度与取舍 / 论据一致性 / 表达效率）并给改进清单；报告可开启只读分享链接
- 客观题对错由服务端按题库判（6000 次组卷映射校验 0 不一致），开放题只评语不假判对错；
  评审不可用时报告照样出，只是六维那部分会写明没跑、**分类掌握度统计**均持久化到 Postgres，跨刷新、重启与重新部署保留
- **我的题库**：登录后新建 / 编辑 / 删除自己的题目；系统题库只读，不能被人删改
- **批量导入**：Excel / CSV 逐行校验，失败行带行号回报原因（不静默丢弃）

### 🔐 用户认证与管理后台
- 邮箱注册 / 登录（bcrypt + JWT），GitHub OAuth（需自行配置，未配置时前端不显示该入口）
- 登录后的 JWT 通过弹窗 `postMessage` 交回，**不经过 URL**（避免进浏览器历史与代理日志）
- 管理后台：用户搜索、详情、删除与注册方式统计
- `/api/chat*` 公开可试用但按 IP/用户限流，并限制同时进行的 LLM 请求数；超额返回 429 + `Retry-After`

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 18 + TypeScript |
| **构建工具** | Vite 6 |
| **样式** | Tailwind CSS 3 + GSAP 动画 |
| **路由** | React Router v7 |
| **状态管理** | Zustand 5 |
| **图标** | Lucide React |
| **动画** | OGL (WebGL) / GSAP |
| **文件解析** | PDF.js / Mammoth / XLSX |
| **后端** | Node.js + Express |
| **RAG 框架** | LangChain.js 1.x（`@langchain/core` / `classic` / `community` / `openai`） |
| **向量嵌入** | transformers.js（本地 `bge-small-zh-v1.5`，512 维） |
| **向量存储** | memory（JSON 持久化）/ ChromaDB |
| **业务数据** | Postgres（`node-postgres` 直连，无 ORM；免费档用 Neon） |
| **LLM** | 任意 OpenAI 兼容服务（`LLM_API_BASE` 切换） |
| **认证** | JWT + bcrypt + GitHub OAuth |
| **测试与 CI** | `node:test` 33 个用例（零新增依赖）+ GitHub Actions：tsc → eslint → 构建 → 后端逐文件语法检查 → 单元测试 |

## 📁 项目结构

```
├── src/                          # 前端源码
│   ├── components/               # 通用组件
│   │   ├── Header.tsx            # 顶部导航（登录态 / 仓库链接）
│   │   ├── ChatMessage.tsx       # 对话气泡（含复制、来源卡片）
│   │   ├── MarkdownLite.tsx      # 回答的 Markdown 渲染（不使用 innerHTML）
│   │   ├── SourceCard.tsx        # 参考来源卡片（类型 / 分类 / 相似度 / 外链）
│   │   ├── QuestionCard.tsx      # 题目卡片（收藏开关）
│   │   ├── TypewriterChat.tsx    # 首页打字机演示
│   │   ├── Threads.tsx           # WebGL 线程背景
│   │   └── ...                   # ScrollReveal / ClickSpark / PillNav / ErrorBoundary 等
│   ├── pages/                    # 页面
│   │   ├── Home.tsx              # 首页（全屏滚动）
│   │   ├── ChatPage.tsx          # AI 问答（流式）
│   │   ├── PracticePage.tsx      # 练习与交卷统计
│   │   ├── QuestionDetail.tsx    # 题目详情（真实作答统计、加入我的题库）
│   │   ├── MyQuestionsPage.tsx   # 我的题库（登录可见，真实 CRUD）
│   │   ├── ImportPage.tsx        # Excel/CSV 导入（逐行回报）
│   │   ├── ResumePage.tsx        # 简历 + JD 优化（登录，流式）
│   │   ├── AuthPage.tsx          # 登录 / 注册（含 OAuth 弹窗）
│   │   ├── AdminLoginPage.tsx    # 管理员登录
│   │   └── AdminDashboard.tsx    # 管理后台
│   ├── lib/                      # API 客户端
│   │   ├── api.ts                # 系统题库读取 + 我的题库 CRUD
│   │   ├── chatApi.ts            # 问答（流式 / 健康检查）
│   │   ├── learningApi.ts        # 收藏 / 练习记录 / 统计 / 错题本
│   │   ├── authApi.ts            # 认证与登录方式探测
│   │   ├── resumeApi.ts          # 简历优化（流式）
│   │   ├── adminApi.ts           # 管理后台
│   │   └── shuffleOptions.ts     # 选项乱序（Fisher-Yates + 答案位置重算）
│   ├── store/                    # Zustand 全局状态
│   ├── hooks/ · types/ · constants/
├── backend/                      # 后端源码
│   ├── server.js                 # Express 入口（路由挂载、限流、健康检查）
│   ├── auth/                     # 认证：邮箱、GitHub OAuth、JWT 中间件、用户存储
│   ├── guard/                    # AI 接口限流与并发闸门（零依赖内存实现）
│   ├── db/                       # Postgres 连接池与建表（账号 / 收藏 / 练习 / 我的题库）
│   ├── learning/                 # 收藏、练习会话、统计、错题本、题目统计接口
│   ├── myquestions/              # 我的题库 CRUD 与批量导入
│   ├── rag/langchain/            # RAG 管线：config / loaders / splitters / embeddings /
│   │                             #   stores / retriever / chains / service
│   ├── scripts/
│   │   ├── ingest.js             # 知识库导入（加载→分块→嵌入→写向量库）+ 检索自测
│   │   ├── audit-questions.js    # 题库质量审计（只读，量化答案分布 / 干扰项 / 难度）
│   │   ├── repair-questions.js   # 题库修复（LLM 重生成干扰项 + 答案位置均衡，带备份）
│   │   ├── clean-corpus-answers.js # 清洗语料中的"答案: X"残渣
│   │   └── crawl.js              # 抓取题源生成知识库
│   └── data/                     # questions.json 题库 / documents.json 知识库 / articles.json
│                                 # 运行产物：*.bak-* 与向量索引 memory_vectors.json 均已 gitignore；业务数据在 Postgres
├── public/ · dist/               # 静态资源 / 构建产物
└── PRD.md · LANGCHAIN_RAG.md · CHROMA_SETUP.md · DEMO.md
```

## 🚀 快速开始

### 前置要求
- **Node.js ≥ 20**（业务数据存 Postgres，见 `backend/package.json` engines）
- **npm** ≥ 9
- 一个 OpenAI 兼容的 LLM API Key（不配也能跑：问答会明确降级为"只返回知识库检索结果"）

### 1. 安装依赖

```bash
npm install                 # 前端
cd backend && npm install   # 后端
```

### 2. 配置后端环境变量

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`：

```env
# LLM（任意 OpenAI 兼容服务）
LLM_API_KEY=your_api_key
LLM_API_BASE=https://api.agnes-ai.cn/v1
LLM_MODEL=agnes-3.0-flash

# 向量后端：auto（默认，探测 Chroma，失败回退 memory）/ chroma / memory
VECTOR_BACKEND=auto

# 嵌入模型首次下载走 HuggingFace，国内网络建议启用镜像（已缓存则完全离线）
# HF_ENDPOINT=https://hf-mirror.com

# AI 接口护栏（不设则用默认值；滑动窗口，登录用户按账号、匿名按 IP 计）
# GUARD_WINDOW_MS=60000         窗口长度（毫秒）
# CHAT_RATE_MAX=20              问答：每窗口次数
# RESUME_RATE_MAX=5             简历优化：每窗口次数（且必须登录）
# LLM_MAX_CONCURRENT=2          同时进行的 LLM 请求数，超出的进队列
# LLM_MAX_QUEUE=10              队列已满 → 503
# LLM_QUEUE_WAIT_MS=15000       排队超时 → 503

PORT=3001
JWT_SECRET=change_me
FRONTEND_URL=http://localhost:5173

# GitHub OAuth（可选；不配置则前端不显示该登录入口）
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback

# 管理员账号（单一账号，由环境变量提供）
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password
```

完整变量说明见 [LANGCHAIN_RAG.md](./LANGCHAIN_RAG.md)。

### 3. 导入知识库

```bash
cd backend
npm run ingest
```

307 条知识条目 → 661 个分块；嵌入在本地 CPU 上跑，约 2~4 分钟。
启动后端时若向量为空也会自动导入。

### 4. 启动

```bash
# 终端 1
cd backend && npm start

# 终端 2（项目根目录）
npm run dev
```

前端 **http://localhost:5173**，健康检查 **http://localhost:3001/api/health**：

```json
{"status":"ok","documents_count":661,"vector_backend":"chromadb",
 "embedding":"local:xenova/bge-small-zh-v1.5","llm_model":"agnes-3.0-flash",
 "has_llm":true,"llm_status":"ready","top_k":5,"rag_engine":"langchain"}
```

> 想用 ChromaDB 而不是内存向量库：`uvx --from chromadb chroma run --path ./chroma_data --port 8000`，
> 步骤见 [CHROMA_SETUP.md](./CHROMA_SETUP.md)。

## 🔧 可用命令

| 命令 | 位置 | 说明 |
|------|------|------|
| `npm run dev` | 根目录 | 前端开发服务器 |
| `npm run build` / `preview` | 根目录 | 生产构建 / 预览 |
| `npm run check` / `lint` | 根目录 | TypeScript 类型检查 / ESLint |
| `npm start` / `npm run dev` | backend | 启动后端 / `--watch` 模式 |
| `npm run ingest` | backend | 全量重建向量库（幂等，先清空再写入） |
| `npm run crawl` | backend | 抓取题源，生成知识库数据 |
| `node scripts/audit-questions.js` | backend | 题库质量审计（只读） |
| `node scripts/repair-questions.js --dry-run` | backend | 题库修复预演（不写盘） |
| `node scripts/clean-corpus-answers.js` | backend | 清洗语料答案残渣（预演；加 `--write` 生效） |

## 📦 构建与部署

| 组件 | 推荐平台 | 说明 |
|------|----------|------|
| 前端 | Vercel / Cloudflare Pages | 静态托管；题库读取有静态 JSON 兜底，后端休眠时页面仍可浏览 |
| 后端 | Render 免费档 | 单进程，向量库自动使用 memory 后端；750 实例小时/月、15 分钟无流量休眠 |

步骤见 [DEPLOY.md](./DEPLOY.md)（Render + Vercel）或 [DEPLOY_CN.md](./DEPLOY_CN.md)（Cloudflare Pages + Render，国内优化），
容器方式见根目录 `Dockerfile`（基镜 `node:24-alpine`）。演示与验收脚本见 [DEMO.md](./DEMO.md)。

## ⚠️ 已知限制

- **上游 LLM 配额**：当前使用的服务为免费档速率限制，批量生成脚本会挤占线上问答（429 时明确降级为纯检索）
- **GitHub OAuth 未验证成功回路**：需要自行创建 OAuth App 后才能实测
- **难度分布尚未重标定**：约 95% 题目标为 medium，等有真实作答正确率后回填（理由见 PRD P0-4）
- **题型只有四选一**：开放简答题与 LLM 评分在规划中（PRD P0-4 / P1-3）
- **限流是单进程内存实现**：多实例部署需换成共享存储（改 `backend/guard.js` 里的计数 Map 即可，中间件签名不变）

## 📄 许可

MIT License
