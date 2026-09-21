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

- **15 分钟无流量自动休眠**，下一次请求需等待约 30~60 秒冷启动（保活办法见文末 FAQ）
- **0.1 核 / 512MB 内存 / 每月 750 实例小时 / 每月 5GB 出站流量**
- **磁盘是临时的**，因此本仓库不再往磁盘写任何需要保留的东西：
  - 用户与学习数据 → Postgres（见下一节，Neon 免费档）
  - 向量索引与 embedding 模型 → **构建阶段**生成，随构建产物进入运行时；运行时只读不写
- 无需信用卡；超额只是暂停服务，下个周期恢复

---

## 零、先准备一个免费 Postgres（必做）

后端把「用户 + 学习数据」全部放进 Postgres：注册账号、收藏、练习会话、逐题作答、自建题。
只有知识库语料（`backend/data/*.json`）仍然是仓库里的只读文件。

1. 打开 [neon.tech](https://neon.tech/)，用 GitHub 账号注册（免费档：0.5GB 存储、可 autosuspend，官方明确写了这些限制都不会删除你的数据）。
2. 创建项目，区域选 **Singapore (ap-southeast-1)**，与 Render 服务同区，省掉跨洋往返。
3. 复制 **Connection string**（pooled 那条，形如 `postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`）。
4. 后端启动时会自动 `CREATE TABLE IF NOT EXISTS`，不需要手动建表、也没有迁移文件要跑。

> ⚠️ 别用 Render 自带的免费 Postgres：它在创建 30 天后过期删除。
> Supabase 免费档也能用，但项目闲置一周会被暂停，比 Neon 更容易在演示当天发现连不上。
>
> ⚠️ 国内直连 `*.neon.tech` 的实际连通性我没有可靠来源，部署完请从你自己的网络 curl 一次
> `/api/health` 确认 `db_ok: true`，不要等用户反馈才发现连不上。

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
   - **Build Command**: `npm ci && LLM_ENABLED=false VECTOR_BACKEND=memory npm run ingest`
   - **Start Command**: `node server.js`
   - **Health Check Path**: `/api/health`
4. 在 **Environment** 页签添加环境变量（见下表），点击 **Save and Deploy**。

### 必须配置的环境变量

| 变量 | 值 | 说明 |
|------|-----|------|
| `DATABASE_URL` | 上一步的 Neon 连接串 | **必填**。留空后端会启动失败，不会静默跑成空库 |
| `LLM_API_KEY` | 你的推理服务密钥 | 必填 |
| `LLM_API_BASE` | `https://api.agnes-ai.cn/v1` | 任意 OpenAI 兼容服务；Blueprint 已写死此值 |
| `LLM_MODEL` | `agnes-3.0-flash` | 同上 |
| `JWT_SECRET` | 随机字符串 | Blueprint 会自动生成 |
| `JWT_EXPIRES_IN` | `7d` | |
| `VECTOR_BACKEND` | `memory` | 固定值。别让运行时去探测 Chroma 或做嵌入 |
| `EMBEDDINGS_BATCH_SIZE` | `16` | 构建期批量嵌入的内存上限（32 时实测峰值约 1GB） |
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

1. 等待 Render 日志出现（顺序是**先监听、再后台加载索引**，这样健康检查不会在加载期把实例判死）：
   ```
   🌐 服务运行在 http://localhost:10000
   📦 初始化向量存储（memory 模式）...
     ✅ 从缓存加载 661 个向量（embedding: local:xenova/bge-small-zh-v1.5）
     ✅ LLM 就绪（agnes-3.0-flash）
   ✅ RAG 系统就绪（661 条向量）
   ```
2. 健康检查：`https://<你的服务域名>/api/health`，应返回：
   ```json
   { "status": "ok", "documents_count": 661, "rag_state": "ready", "db_ok": true, "has_llm": true }
   ```
   - `db_ok: false` → `DATABASE_URL` 有问题（连接串、IP allowlist、sslmode）
   - `rag_state: empty` → 构建期没跑出索引，见下方 FAQ
3. 前端测试：注册、登录、题目列表、收藏、练习并交卷、AI 助手对话、简历优化。
4. **重新部署一次**，再用刚才注册的账号登录 —— 数据还在才算迁移完成。

---

## 常见问题

### Q: 15 分钟休眠影响大吗？
A: 第一次请求会等待 30~60 秒。个人练习可接受；如介意，可用免费监控服务（如 UptimeRobot）每 5~10 分钟 ping 一次 `/api/health` 保活（会占用免费实例小时数，24/7 保活约 744 小时/月，刚好不超额）。

### Q: 注册用户会丢吗？
A: 不会了。账号与学习数据存在 Postgres（Neon 免费档），Render 侧重新部署、休眠重启都不影响。
只有知识库语料和向量索引是随代码走的：改了 `backend/data/documents.json` 或换了 embedding 模型，
重新部署时构建阶段会自动重新生成索引。

### Q: 为什么索引必须在构建期生成？
A: 免费运行时只有 0.1 核 / 512MB，而实测批量嵌入 32 个分块峰值 RSS 约 1GB、661 个分块在单核要一分多钟。
放在启动阶段必然被 OOM 杀掉，或让健康检查超时重启。构建环境资源充足得多，产出的
`vector_store_data/memory_vectors.json` 与 `.cache/` 里的模型会随构建产物进入运行时 —— 运行时只读文件，
实测常驻 RSS 约 285MB、首次检索 364ms、热检索 9ms。
如果 `/api/health` 出现 `rag_state: empty`，说明构建产物没带出索引，检查 buildCommand 里的
`npm run ingest` 是否真的执行成功（看构建日志最后有没有「✅ 导入完成」）。

### Q: 本地开发怎么起 Postgres？
A: `docker run -d --name ai-pg -e POSTGRES_PASSWORD=devpw -e POSTGRES_DB=ai_interview -p 5432:5432 postgres:17-alpine`，
然后 `backend/.env` 里 `DATABASE_URL=postgresql://postgres:devpw@localhost:5432/ai_interview`。
不想占用本地端口就直接填 Neon 的 dev branch 连接串，表结构同样自动创建。

### Q: 首次访问很慢？
A: 冷启动是「实例唤醒（约 30~60 秒）+ 读索引（毫秒级）」，不再是重新构建词库。
如果每次都很慢，检查构建日志里索引是否生成成功（见上一问）。

### Q: LLM 回答报"AI 生成不可用"？
A: 先看 `/api/health` 的 `llm_status` 与 `llm_error`，前端会原样展示原因。
常见是 `LLM_API_BASE`/`LLM_API_KEY` 不对，或上游 429 免费额度用尽 ——
后者会让问答降级成"直接返回知识库检索原文"，属预期行为，不是本站故障。
