# AI面试宝典 🎯

[![English](https://img.shields.io/badge/🌐-English-blue)](./README.md)
[![简体中文](https://img.shields.io/badge/🌐-简体中文-red)](./README_CN.md)

基于 RAG（检索增强生成）的智能面试准备平台，专注于 AI 应用开发领域的面试题目练习、AI 智能答疑和简历优化。采用 TF-IDF 向量检索 + LLM 生成的混合架构。

## ✨ 功能特性

### 🏠 全屏滚动首页
- 五段式全屏滚动：Hero → AI 助手 → 简历优化 → 题库 → 关于
- WebGL 动态线程背景动画
- 打字机效果展示 AI 对话能力

### 🤖 AI 智能助手
- 基于 **RAG 架构**：TF-IDF 语义检索 + MiMo LLM 生成
- 支持流式（SSE）对话，实时逐字输出
- 自动检索知识库，提供准确、有引用的回答
- 预设推荐问题，快速上手

### 📝 简历优化
- 上传简历（支持 PDF / Word / Markdown / TXT / 图片）+ 职位描述（JD）
- AI 分析 JD 并优化简历措辞，突出匹配技能
- 流式输出优化结果，实时预览
- 一键导出为 Word 文档（.docx）

### 📚 题库管理
- **练习模式**：按分类 / 难度筛选，自动计时，交卷统计得分
- **我的题库**：个人题目 CRUD + 搜索 + 筛选 + 分页
- **数据导入**：支持 Excel / CSV 批量导入题目
- 题目支持分类标签和难度分级（易/中/难）

### 🔐 用户认证
- 邮箱注册 / 登录
- GitHub OAuth 一键登录
- JWT Token 认证 + 管理员角色

### 🛡️ 管理后台
- 用户管理（搜索、查看详情、删除）
- 用户统计（邮箱注册 vs GitHub 登录）

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 18 + TypeScript |
| **构建工具** | Vite 6 |
| **样式** | Tailwind CSS 3 + GSAP 动画 |
| **路由** | React Router v7 |
| **状态管理** | Zustand 5 |
| **图标** | Lucide React |
| **文件处理** | PDF.js / Mammoth / XLSX / docx |
| **动画** | OGL (WebGL) / GSAP |
| **后端** | Node.js + Express |
| **向量检索** | TF-IDF（内存模式） |
| **LLM** | MiMo API |
| **认证** | JWT + bcrypt + GitHub OAuth |

## 📁 项目结构

```
├── src/                          # 前端源码
│   ├── components/               # 通用组件
│   │   ├── Header.tsx            # 顶部导航栏（含登录/用户信息）
│   │   ├── Footer.tsx            # 页脚
│   │   ├── Sidebar.tsx           # 侧边栏
│   │   ├── PillNav.tsx           # 胶囊导航
│   │   ├── Threads.tsx           # WebGL 线程背景
│   │   ├── TypewriterChat.tsx    # 打字机效果组件
│   │   ├── ChatMessage.tsx       # 聊天消息
│   │   ├── QuestionCard.tsx      # 题目卡片
│   │   ├── MagicBento.tsx        # Bento 布局卡片
│   │   ├── ScrollReveal.tsx      # 滚动渐显动画
│   │   ├── ClickSpark.tsx        # 点击粒子特效
│   │   ├── ErrorBoundary.tsx     # 全局错误边界
│   │   └── ...
│   ├── pages/                    # 页面
│   │   ├── Home.tsx              # 首页（全屏滚动）
│   │   ├── ChatPage.tsx          # AI 助手对话
│   │   ├── ResumePage.tsx        # 简历优化
│   │   ├── PracticePage.tsx      # 练习模式
│   │   ├── MyQuestionsPage.tsx   # 我的题库
│   │   ├── ImportPage.tsx        # 题目导入
│   │   ├── QuestionDetail.tsx    # 题目详情
│   │   ├── AuthPage.tsx          # 登录/注册
│   │   ├── AuthCallback.tsx      # OAuth 回调
│   │   ├── AdminLoginPage.tsx    # 管理员登录
│   │   └── AdminDashboard.tsx    # 管理后台
│   ├── lib/                      # API 客户端
│   │   ├── api.ts                # 通用 API
│   │   ├── authApi.ts            # 认证 API
│   │   ├── chatApi.ts            # 聊天 API
│   │   ├── resumeApi.ts          # 简历优化 API
│   │   └── adminApi.ts           # 管理员 API
│   ├── store/                    # Zustand 状态管理
│   ├── hooks/                    # 自定义 Hooks
│   ├── types/                    # TypeScript 类型定义
│   └── constants/                # 配置常量
├── backend/                      # 后端源码
│   ├── server.js                 # Express 入口
│   ├── auth/                     # 认证模块
│   │   ├── index.js              # 认证路由
│   │   ├── middleware.js         # JWT 中间件
│   │   ├── users.js              # 用户数据管理
│   │   └── admin.js              # 管理员验证
│   ├── rag/                      # RAG 核心模块
│   │   ├── vectorstore.js        # TF-IDF 向量存储
│   │   ├── retriever.js          # 语义检索
│   │   └── generator.js          # LLM 生成
│   ├── scripts/                  # 数据导入脚本
│   └── data/                     # 知识库数据
├── public/                       # 静态资源
└── dist/                         # 构建输出
```

## 🚀 快速开始

### 前置要求
- **Node.js** >= 18
- **npm** >= 9

### 1. 克隆项目

```bash
git clone https://github.com/Wan-1230/AI-resume-study.git
cd AI-resume-study
```

### 2. 安装前端依赖

```bash
npm install
```

### 3. 安装后端依赖

```bash
cd backend
npm install
cd ..
```

### 4. 配置后端环境变量

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，填入必要的配置：

```env
# MiMo LLM API
MIMO_API_KEY=your_mimo_api_key
MIMO_API_BASE=https://api.mimo.com/v1

# 向量存储数据目录
CHROMA_DB_PATH=./chroma_db

# 服务端口
PORT=3001

# GitHub OAuth（在 GitHub Developer Settings 创建 OAuth App）
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback

# JWT
JWT_SECRET=your_jwt_secret_key_for_token_signing
JWT_EXPIRES_IN=7d

# 前端地址（CORS + OAuth 回调使用）
FRONTEND_URL=http://localhost:5173

# 管理员账号
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password
```

### 5. 准备知识库数据

```bash
cd backend
node scripts/ingest.js    # 导入知识库文档到向量存储
cd ..
```

### 6. 启动开发服务器

```bash
# 终端 1：启动后端
cd backend
npm run dev

# 终端 2：启动前端
npm run dev
```

访问 **http://localhost:5173** 即可使用。

## 📦 构建与部署

### 前端构建

```bash
npm run build       # 构建到 dist/
npm run preview     # 预览构建结果
```

### 部署方案

| 组件 | 推荐平台 | 费用 |
|------|----------|------|
| 前端 | Vercel / Cloudflare Pages | 免费 |
| 后端 | Railway | 免费额度 $5/月 |

详细部署步骤见 [DEPLOY.md](./DEPLOY.md)（Railway + Vercel）或 [DEPLOY_CN.md](./DEPLOY_CN.md)（Cloudflare Pages + Railway，国内优化）。

## 🔧 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端开发服务器 |
| `npm run build` | TypeScript 检查 + 生产构建 |
| `npm run check` | TypeScript 类型检查 |
| `npm run lint` | ESLint 代码检查 |
| `npm run preview` | 预览生产构建 |

## 📄 许可

MIT License
