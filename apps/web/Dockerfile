# Windcock Web (Nuxt 3 SSR) — Zeabur / any container platform.
# Build context: repo root. Public runtime config (NUXT_PUBLIC_*) is read
# from environment at runtime, so no build args are required.

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY apps/web ./apps/web
RUN npm run build -w apps/web

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
# Web runtime never touches Prisma; skip postinstall scripts entirely.
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/apps/web/.output ./apps/web/.output
EXPOSE 3000
CMD ["node", "apps/web/.output/server/index.mjs"]
