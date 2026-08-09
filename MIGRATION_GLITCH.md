# 后端从 Railway 迁移到 Glitch 指南

> 将后端从 Railway 迁移到 [Glitch](https://glitch.com/)（免费 Node.js 托管平台）。
> 前端不变，仍然部署在 Vercel / Cloudflare Pages，只需更新 API 地址。

---

## 为什么选 Glitch

| 特性 | 说明 |
|------|------|
| **价格** | 免费，无需绑定信用卡 |
| **数据持久化** | ✅ 项目文件（`data/users.json`、`chroma_db/`）重启/休眠不丢失 |
| **Node.js 支持** | ✅ 完整 Express 支持，SSE 流式可用 |
| **限额** | 4000 请求/小时；5 分钟无请求进入休眠，唤醒约 5 秒 |
| **限制** | 免费版代码公开可见；不能绑定自定义域名（免费版） |

---

## 一、迁移前准备

1. 备份当前 Railway 上的数据（如已有注册用户）：
   - `data/users.json`（用户数据）
   - `chroma_db/documents.json`（知识库向量数据）
2. 确认本地 `backend/` 目录完整可用。

---

## 二、在 Glitch 创建项目

1. 打开 [glitch.com](https://glitch.com/) 并登录（可用 GitHub 账号登录）。
2. 点击右上角 **New Project** → **hello-node**（或 **Import from GitHub**）。
3. 等待项目创建完成，记下你的项目域名：
   - 格式：`https://<project-name>.glitch.me`
   - 可在左下角项目名称处重命名（项目名会改变域名）。

---

## 三、上传后端文件

> 将本地 `backend/` 目录的内容上传到 Glitch 项目根目录。
> ⚠️ 不要上传：`node_modules/`、`.env`、`render.yaml`、`wrangler.toml`、嵌套的 `backend/` 空目录。

### 方式 A：GitHub 导入（推荐）

1. 新建一个只包含后端代码的 GitHub 仓库（如 `ai-interview-backend`）：
   ```bash
   cd backend
   git init
   git add -A
   git commit -m "init backend"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/ai-interview-backend.git
   git push -u origin main
   ```
2. 在 Glitch 中 **New Project** → **Import from GitHub** → 输入仓库地址。
3. Glitch 会自动执行 `npm install` 并启动。

### 方式 B：手动上传

1. 在 Glitch 项目中，点击左侧 **Tools** → **Git, Import and Export**。
2. 或用 Glitch 编辑器左侧文件树，直接拖拽文件上传。

### 必须包含的文件清单

```
server.js
package.json
package-lock.json
auth/
  index.js
  middleware.js
  users.js
  admin.js
rag/
  vectorstore.js
  retriever.js
  generator.js
scripts/
  ingest.js
  crawl.js
data/
  articles.json
  documents.json
  questions.json
chroma_db/
  documents.json        ← 知识库向量数据（重要！）
```

---

## 四、配置环境变量

1. 在 Glitch 项目中，点击左侧 **Tools** → **.env**（或 **Env**）。
2. 参考 `backend/GLITCH.env.example`，填入你的配置：

```env
MIMO_API_KEY=你的MiMo密钥
MIMO_API_BASE=https://api.xiaomimimo.com/v1
JWT_SECRET=一段随机字符串
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://你的前端域名.vercel.app
GITHUB_CLIENT_ID=你的GitHub客户端ID
GITHUB_CLIENT_SECRET=你的GitHub客户端密钥
GITHUB_CALLBACK_URL=https://<你的项目名>.glitch.me/api/auth/github/callback
```

> ⚠️ 不要设置 `PORT`，Glitch 会自动注入。

---

## 五、更新 GitHub OAuth App 回调地址

1. 打开 [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers)。
2. 找到你之前为 Railway 创建的 OAuth App。
3. 将 **Authorization callback URL** 改为：
   ```
   https://<你的项目名>.glitch.me/api/auth/github/callback
   ```
   （必须与 `.env` 中的 `GITHUB_CALLBACK_URL` 完全一致）
4. 保存。

---

## 六、更新前端 API 地址

1. 修改前端环境变量，将 API 地址指向 Glitch：

   **开发环境**（`.env`）：
   ```env
   VITE_API_BASE=https://<你的项目名>.glitch.me
   ```

   **生产环境**（`.env.production`）：
   ```env
   VITE_API_BASE=https://<你的项目名>.glitch.me
   ```

2. 重新构建并部署前端：
   ```bash
   npm run build
   # 然后推送到 Vercel / Cloudflare Pages
   ```

---

## 七、验证

1. 打开 Glitch 项目，确认日志显示：
   ```
   📦 初始化向量数据库（内存模式）...
   ✅ 从文件加载 N 个文档
   🌐 服务运行在 http://localhost:<port>
   ```
2. 测试健康检查：`https://<你的项目名>.glitch.me/api/health`，应返回：
   ```json
   { "status": "ok", "documents_count": N, "has_llm": true }
   ```
3. 测试前端页面：登录、AI 助手、简历优化是否正常。
4. 测试 GitHub 登录是否跳转正常。

---

## 八、切换 DNS / 确认无误后

1. 确认 Glitch 后端一切正常后，再停用 Railway 服务，避免双端运行。
2. 如需在 Railway 和 Glitch 间切换回滚，只需把 `VITE_API_BASE` 改回 Railway 地址并重新部署前端。

---

## 常见问题

### Q: 免费版 5 分钟休眠，唤醒要等多久？
A: 约 5~10 秒。第一个请求会触发唤醒，Glitch 会显示加载页。建议前端在 API 请求中做好加载状态提示。

### Q: 代码公开可见怎么办？
A: 免费版项目代码对所有人可见。如介意，可升级 Glitch 付费版（约 $10/月），或改选其他方案。

### Q: 4000 请求/小时够用吗？
A: 个人练习/学习场景完全够用。频繁访问会被限流。

### Q: 我的注册用户数据会丢吗？
A: 不会。`data/users.json` 保存在 Glitch 项目文件中，重启/休眠不丢失。但**项目被删除**时数据会丢失，请定期备份。

### Q: 迁移后 GitHub 登录报"安全校验失败"？
A: 检查 `.env` 中的 `GITHUB_CALLBACK_URL` 和 GitHub OAuth App 中的回调地址是否**完全一致**（注意 http/https 和末尾路径）。

### Q: 首页题目不显示？
A: 确认 `data/questions.json` 已上传到 Glitch 项目，且 `chroma_db/documents.json` 存在。
