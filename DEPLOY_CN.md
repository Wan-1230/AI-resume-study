# 国内部署指南（无需备案）

## 推荐方案

| 组件 | 平台 | 费用 | 国内访问 |
|------|------|------|----------|
| 前端 | Cloudflare Pages | 免费 | ✅ 可访问 |
| 后端 | Render | 免费档（750 实例小时/月） | ✅ 可访问（2026-09 实测） |

---

## 第一步：推送到 GitHub

```bash
git add .
git commit -m "准备部署"
git push
```

---

## 第二步：部署前端到 Cloudflare Pages

### 方法一：通过 Dashboard

1. 访问 https://dash.cloudflare.com/ 并登录
2. 左侧菜单选择 "Workers 和 Pages"
3. 点击 "创建应用程序" → "Pages" → "连接到 Git"
4. 选择你的 GitHub 仓库
5. 配置：
   - 项目名称：`ai-interview`
   - 生产分支：`main`
   - 构建命令：`npm run build`
   - 输出目录：`dist`
6. 点击 "保存并部署"

### 方法二：通过命令行

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 构建前端
npm run build

# 部署到 Cloudflare Pages
wrangler pages deploy dist --project-name=ai-interview
```

### 设置环境变量

1. 在 Cloudflare Pages 项目设置中
2. 选择 "设置" → "环境变量"
3. 添加：
   ```
   VITE_API_BASE=https://你的Railway域名/api
   ```

---

## 第三步：部署后端到 Render

> Railway 免费额度已停止发放。完整迁移说明（含 GitHub OAuth 回调、保活方案）见 [MIGRATION_RENDER.md](./MIGRATION_RENDER.md)。

1. 访问 https://dashboard.render.com/ 并用 GitHub 账号登录
2. 点击 **New +** → **Web Service**，连接你的 GitHub 仓库
3. 配置：
   - Root Directory：`backend`
   - Region：Singapore
   - Instance Type：Free
   - Build Command：`npm install`
   - Start Command：`node server.js`
   - Health Check Path：`/api/health`
4. 添加环境变量：
   ```
   MIMO_API_KEY=your_mimo_api_key_here
   MIMO_API_BASE=https://api.xiaomimimo.com/v1
   JWT_SECRET=一段随机字符串
   GITHUB_CALLBACK_URL=https://你的服务域名.onrender.com/api/auth/github/callback
   ```
   （不要设置 `PORT`，Render 会自动注入）
5. 部署后复制域名：`https://xxxx.onrender.com`

> 也可以用根目录的 `render.yaml` 蓝图一键部署：**New + → Blueprint** → 选择本仓库。

---

## 第四步：更新前端环境变量

在 Cloudflare Pages 项目中更新：
```
VITE_API_BASE=https://你的服务域名.onrender.com
```

---

## 常见问题

### Q: Render 国内能访问吗？
A: 可以。`render.com` 与 `*.onrender.com` 实测国内可直连；免费服务选新加坡区域延迟更友好。注意免费档 15 分钟无流量会休眠，唤醒需 30~60 秒。

### Q: Cloudflare Pages 国内速度如何？
A: Cloudflare 在国内有节点，速度不错，无需备案。

### Q: 需要买域名吗？
A: Cloudflare Pages 提供 `xxx.pages.dev`，Render 提供 `xxxx.onrender.com`，都不需要买域名。

---

## 费用说明

- **Cloudflare Pages**: 完全免费，无限流量
- **Render**: 免费档 750 实例小时/月（单个服务足够 24/7 运行），15 分钟无流量休眠
- **总费用**: 基本免费
