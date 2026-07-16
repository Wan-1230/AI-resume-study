# 国内部署指南（无需备案）

## 推荐方案

| 组件 | 平台 | 费用 | 国内访问 |
|------|------|------|----------|
| 前端 | Cloudflare Pages | 免费 | ✅ 可访问 |
| 后端 | Railway | 免费额度 | ✅ 可访问 |

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

## 第三步：部署后端到 Railway

1. 访问 https://railway.app/
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择仓库，Root Directory 填 `backend`
4. 添加环境变量：
   ```
   MIMO_API_KEY=your_mimo_api_key_here
   MIMO_API_BASE=https://api.xiaomimimo.com/v1
   PORT=3001
   ```
5. 部署后复制域名

---

## 第四步：更新前端环境变量

在 Cloudflare Pages 项目中更新：
```
VITE_API_BASE=https://你的Railway域名/api
```

---

## 常见问题

### Q: Railway 国内能访问吗？
A: 可以访问，速度一般但可用。如果速度不满意，可以考虑使用国内云服务器。

### Q: Cloudflare Pages 国内速度如何？
A: Cloudflare 在国内有节点，速度不错，无需备案。

### Q: 需要买域名吗？
A: Cloudflare Pages 会提供免费域名（xxx.pages.dev），不需要买域名。

---

## 费用说明

- **Cloudflare Pages**: 完全免费，无限流量
- **Railway**: 免费额度 $5/月，轻度使用足够
- **总费用**: 基本免费
