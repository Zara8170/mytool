# Multi-stage build for the Next.js web app
# 빌드 컨텍스트는 모노레포 루트입니다.

# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 의존성 매니페스트
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

RUN pnpm install --frozen-lockfile=false --filter @mytool/web... --filter @mytool/shared

# 소스 복사
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

# 빌드
RUN pnpm --filter @mytool/shared build
RUN pnpm --filter @mytool/web build

# ---------- Runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

# Next.js standalone output을 그대로 사용
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=builder /app/packages/web/public ./packages/web/public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "packages/web/server.js"]
