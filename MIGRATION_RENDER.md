# 后端从 Railway 迁移到 Render 指南

> Railway 免费额度（$5/月）已停止发放，本指南将后端迁移到 [Render](https://render.com/)（免费档）。
> 前端不变（Vercel / Cloudflare Pages），部署完成后只需更新前端 API 地址。

---

## 为什么选 Render

| 特性 | 说明 |
|------|------|
| **价格** | 免费档：每个工作区每月 750 免费实例小时（单个服务 24/7 跑满一个月 ≈ 744 小时，刚好够用） |
| **国内访问** | `render.com` / `*.onrender.com` 实测国内可直连（2026-09 本机验证） |
| **区域** | 免费服务可选 **新加坡** 区域，对国内延迟友好 |
| **自动部署** | 连接 GitHub 仓库后，push 到 `main` 自动重新部署；仓库根目录的 `render.yaml` 蓝图会被自动读取 |
| **无需信用卡** | 注册即可使用免费档（可用 GitHub 账号直接登录） |

### 免费档限制（务必了解）

- **15 分钟无流量自动休眠**，下一次请求需等待约 30~60 秒冷启动
- **磁盘是临时的**：运行时写入的文件（`data/users.json` 注册用户）在休眠/重启/重新部署后丢失；知识库数据（`chroma_db/documents.json`）随代码部署，不受影响
- 每月 100GB → **5GB 出站流量**（个人学习场景足够）
- 需要注意：Railway 时代重新部署同样会丢注册用户，行为基本一致

---

## 一、部署后端（两条路线任选）

### 路线 A：Blueprint 一键部署（推荐，自动读取 render.yaml）

1. 打开 [dashboard.render.com](https://dashboard.render.com/)，用 GitHub 账号登录。
2. 右上角 **New +** → **Blueprint**。
3. 选择仓库 `Wan-1230/AI-resume-study`，Render 自动识别根目录 `render.yaml`。
4. 按提示填入标了 `sync: false` 的环境变量（见下表），点击 **Apply**。
5. 等待构建完成，记下服务域名：`https://ai-interview-backend-xxxx.onrender.com`。

### 路线 B：手动创建

1. 打开 [dashboard.render.com](https://dashboard.render.com/) → **New +** → **Web Service**。
2. 连接 GitHub 仓库 `Wan-1230/AI-resume-study`。
3. 配置：
   - **Name**: `ai-interview-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Region**: Singapore
   - **Instance Type**: Free
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Health Check Path**: `/api/health`
4. 在 **Environment** 页签添加环境变量（见下表），点击 **Save and Deploy**。

### 必须配置的环境变量

| 变量 | 值 | 说明 |
|------|-----|------|
| `MIMO_API_KEY` | 你的 MiMo 密钥 | 必填 |
| `MIMO_API_BASE` | `https://api.xiaomimimo.com/v1` | 注意：`api.mimo.com` 无法解析，必须用 xiaomimimo 域名 |
| `JWT_SECRET` | 随机字符串 | Blueprint 会自动生成 |
| `JWT_EXPIRES_IN` | `7d` | |
| `GITHUB_CLIENT_ID` | 你的 GitHub OAuth Client ID | 需要邮箱注册/GitHub 登录功能时必填 |
| `GITHUB_CLIENT_SECRET` | 你的 GitHub OAuth Client Secret | 同上 |
| `GITHUB_CALLBACK_URL` | `https://<你的服务域名>/api/auth/github/callback` | 必须与 GitHub OAuth App 中的回调地址完全一致 |
| `FRONTEND_URL` | 前端正式域名（如 `https://xxx.pages.dev`） | 可留空 = CORS 允许所有来源；确定后建议填上 |

> ⚠️ 不要设置 `PORT`：Render 自动注入，`server.js` 里的 `process.env.PORT || 3001` 会自动使用。

---

## 二、更新 GitHub OAuth App 回调地址

1. 打开 [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers)。
2. 找到之前为 Railway 创建的 OAuth App。
3. 将 **Authorization callback URL** 改为：
   ```
   https://<你的服务域名>.onrender.com/api/auth/github/callback
   ```
4. 保存。

---

## 三、更新前端 API 地址

1. 修改根目录 `.env.production`：
   ```env
   VITE_API_BASE=https://<你的服务域名>.onrender.com
   ```
2. 提交推送后，Vercel / Cloudflare Pages 会自动重新构建部署。
3. 如果前端平台的环境变量面板里单独配置过 `VITE_API_BASE`，**面板值会覆盖文件**，记得同步修改。

---

## 四、验证

1. 等待 Render 日志出现：
   ```
   📦 初始化向量数据库（内存模式）...
   ✅ 从文件加载 N 个文档
   🌐 服务运行在 http://localhost:<port>
   ```
2. 健康检查：`https://<你的服务域名>/api/health`，应返回：
   ```json
   { "status": "ok", "documents_count": N, "has_llm": true }
   ```
3. 前端测试：登录、题目列表、AI 助手对话、简历优化。

---

## 常见问题

### Q: 15 分钟休眠影响大吗？
A: 第一次请求会等待 30~60 秒。个人练习可接受；如介意，可用免费监控服务（如 UptimeRobot）每 5~10 分钟 ping 一次 `/api/health` 保活（会占用免费实例小时数，24/7 保活约 744 小时/月，刚好不超额）。

### Q: 注册用户会丢吗？
A: 免费档磁盘临时，服务休眠/重启后 `data/users.json` 恢复为部署时的状态。这是 Railway（无卷）+ Render 免费档的共同限制。如需持久化，可升级 Render 付费档挂载磁盘，或把用户存储改为外部数据库（如 Supabase/Neon 免费档）。

### Q: 首次访问很慢？
A: 冷启动 + RAG 初始化（TF-IDF 词库构建）约需几秒到一分钟，属正常现象。

### Q: LLM 回答报"LLM 暂时不可用"？
A: 检查 `MIMO_API_BASE` 是否为 `https://api.xiaomimimo.com/v1`（不是 api.mimo.com），以及 `MIMO_API_KEY` 是否有效。
