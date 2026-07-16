# AI 面试题库 - 部署指南

## 项目结构

```
├── src/                    # 前端源码（Vite + React）
├── backend/                # 后端源码（Node.js + Express）
│   ├── data/              # 题目数据
│   ├── rag/               # RAG 核心模块
│   └── server.js          # 后端入口
└── package.json           # 前端依赖
```

## 部署步骤

### 第一步：推送到 GitHub

```bash
# 在项目根目录执行
git add .
git commit -m "准备部署"
git push origin main
```

### 第二步：部署后端到 Railway

1. 访问 https://railway.app/ 并登录
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择你的仓库
4. 选择 `backend` 目录作为根目录
5. 添加环境变量：
   ```
   MIMO_API_KEY=your_mimo_api_key_here
   MIMO_API_BASE=https://api.xiaomimimo.com/v1
   PORT=3001
   ```
6. 点击 Deploy
7. 部署成功后，复制 Railway 提供的域名

### 第三步：部署前端到 Vercel

1. 访问 https://vercel.com/ 并登录
2. 点击 "Add New..." → "Project"
3. 选择你的 GitHub 仓库
4. 配置项目：
   - Framework Preset: Vite
   - Root Directory: ./（默认）
5. 添加环境变量：
   ```
   VITE_API_BASE=https://你的Railway域名/api
   ```
6. 点击 Deploy

### 第四步：测试

1. 打开 Vercel 提供的域名
2. 测试所有功能：
   - 首页加载
   - 题目列表
   - AI 助手对话
   - 练习模式

## 常见问题

### Q: 跨域错误怎么办？
A: 在 Railway 环境变量中添加：
```
FRONTEND_URL=https://你的Vercel域名
```

### Q: 题目数据没有显示？
A: 确保后端 `data/questions.json` 文件已正确部署

### Q: AI 助手不工作？
A: 检查 `MIMO_API_KEY` 是否正确配置

## 费用说明

- **Vercel**: 免费版每月 100GB 流量
- **Railway**: 免费版每月 $5 额度
- **总费用**: 个人项目基本免费
