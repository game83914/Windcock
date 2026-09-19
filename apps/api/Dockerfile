# Windcock API (NestJS) — Zeabur / any container platform.
# Build context: repo root. 預設建置最後的 runtime stage。
# Migration 走 `migrator` stage（docker-compose.yml 的 migrate one-shot 服務），
# 維運機也可用 repo 執行 `npm run prisma:deploy -w apps/api`。

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci
COPY apps/api/nest-cli.json apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src
RUN npm run build -w apps/api

FROM node:20-slim AS migrator
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci --ignore-scripts
CMD ["npx", "prisma", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"]

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/prisma ./apps/api/prisma
# --ignore-scripts：prisma CLI 屬 devDeps 已被移除，client 改由 build 階段複製現成產物
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/api/v1/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
