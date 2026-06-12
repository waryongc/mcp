# yeorot-mcp 원격(HTTP) 서버 — Streamable HTTP, 포트 ${PORT:-3000}
# TLS는 리버스 프록시(nginx/Caddy)에서 종료 (평문 HTTP 직접 노출 금지)

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# 필수 env: YEOROT_API_URL / 선택: PORT, MCP_ALLOWED_HOSTS, MCP_ALLOWED_ORIGINS
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/healthz" || exit 1
CMD ["node", "dist/server-http.js"]
