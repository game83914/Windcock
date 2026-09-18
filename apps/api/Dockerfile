# Windcock API (NestJS) — Zeabur / any container platform.
# Build context: repo root. Migration is applied separately via
# `npm run prisma:deploy -w apps/api` (never at container start with replicas).

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

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/prisma ./apps/api/prisma
# postinstall regenerates the Prisma client into node_modules
RUN npm ci --omit=dev
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
