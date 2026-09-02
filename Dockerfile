# Back4App Containers 部署用 Dockerfile（构建上下文 = 仓库根目录）
FROM node:20-alpine

WORKDIR /app

# 先复制依赖清单并安装，利用 Docker 层缓存
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# 复制后端代码（server.js / auth / rag / scripts / data / chroma_db）
COPY backend/ .

# Back4App 平台注入的 PORT 环境变量会覆盖此默认值
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
