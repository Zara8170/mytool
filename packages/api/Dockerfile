# Multi-stage build for the API server
# 빌드 컨텍스트는 모노레포 루트입니다.

# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 의존성 매니페스트 복사
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# 의존성 설치 (api + shared만)
RUN pnpm install --frozen-lockfile=false --filter @mytool/api... --filter @mytool/shared

# 소스 복사
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Prisma client 생성 + 빌드
RUN pnpm --filter @mytool/shared build
RUN pnpm --filter @mytool/api prisma generate
RUN pnpm --filter @mytool/api build

# ---------- Runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 빌드 결과물만 복사
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules

ENV NODE_ENV=production
EXPOSE 3001

# 마이그레이션 적용 후 서버 시작
CMD ["sh", "-c", "cd packages/api && npx prisma migrate deploy && node dist/index.js"]
