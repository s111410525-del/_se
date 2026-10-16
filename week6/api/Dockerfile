# ---------- 建置階段：只安裝生產環境相依套件 ----------
FROM node:20-alpine AS build
WORKDIR /app

# 先複製套件描述檔，讓 Docker 可以快取「安裝套件」這層
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 執行階段：只帶走 node_modules 與原始碼 ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./

# Alpine 內建的 wget 可用來執行容器健康檢查
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

EXPOSE 3000
USER node
CMD ["node", "server.js"]
