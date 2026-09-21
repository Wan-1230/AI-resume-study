# Back4App Containers 部署用 Dockerfile（构建上下文 = 仓库根目录）
# node:24 —— 与 backend/package.json engines(>=20) 一致
#
# ⚠️ 本文件走的是容器路线，与 render.yaml（Node 运行时 + 构建期 ingest）是两条路。
# 容器里没有那一步 `npm run ingest`，启动后 /api/health 会是 rag_state=empty、
# AI 接口返回 503。要真用容器部署，需要在 COPY backend/ 之后补一次
# LLM_ENABLED=false VECTOR_BACKEND=memory npm run ingest 把索引烘进镜像（未实测）。
FROM node:24-alpine

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
