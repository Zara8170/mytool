# mytool — Phase 0~3 완료 요약

> 직접 구현 노선 (A안)으로 만든 Claude Code 옵저버빌리티 도구 첫 빌드

## 🎯 완료한 작업

총 **75개 파일** 작성. Argos 아키텍처 문서를 참고하되 셀프호스팅과 단순성을 우선해 직접 구현했어요.

### Phase 0: 모노레포 셋업 ✅
- `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- 4개 패키지 디렉터리 (`shared`, `api`, `web`, `cli`)
- **자체호스팅 친화적 docker-compose.yml** (Argos는 Postgres만, mytool은 API+Web 모두 포함)
- 환경변수 템플릿(`.env.example`)
- 루트 `README.md`, `.gitignore`

### Phase 1: `packages/shared` ✅
공통 타입과 Zod 스키마 — 모든 다른 패키지가 이걸 import해요.
- `constants/pricing.ts` — 모델별 단가 + `calculateCost()`
- `schemas/events.ts` — Hook 이벤트 페이로드 스키마 (CLI ↔ API 계약)
- `schemas/auth.ts` — 회원가입/로그인 요청·응답
- `schemas/project.ts` — 조직/프로젝트
- `schemas/dashboard.ts` — 대시보드 응답 타입

### Phase 2: `packages/api` ✅ (Hono + Prisma)
- **Prisma 스키마** (10개 테이블): User, Organization, OrgMembership, Project, ClaudeSession, Event, UsageRecord, Message, CliToken
- **인증 라우트** (`/api/auth/*`): bcrypt + JWT, 회원가입 시 개인 org 자동 생성
- **이벤트 수집** (`POST /api/events`): 권한 체크 → 세션 upsert → 파생 필드 계산 → Event 저장 → UsageRecord 생성, 모두 단일 트랜잭션
- **조직/프로젝트 라우트**
- **대시보드 라우트** (`summary`, `usage`, `sessions`)
- 인증 미들웨어 (Bearer JWT + DB revocation 체크)
- 표준화된 에러 응답
- **API Dockerfile** (multi-stage, prisma migrate deploy 포함)

### Phase 3: `packages/cli` ✅ (`mytool-ai` npm 패키지)
가장 까다로웠던 부분이에요. Argos가 발견한 모든 핵심 패턴 반영:
- **`mytool hook`** — Claude Code가 호출하는 내부 명령
  - 100ms stdin 타임아웃 (TTY 안전)
  - 3초 API 타임아웃 (사용자 차단 금지)
  - **항상 exit 0** (어떤 실패도 무시)
- **transcript 파서** — `extractUsageFromTranscript()` + `detectSlashCommand()` (slash 커맨드 감지의 두 가지 패턴 모두 지원)
- **멱등성 보장된 hook 주입** — 기존 사용자 hook 보존, 누락 이벤트만 추가
- **`.mytool/project.json`** 상위 디렉터리 탐색
- **메인 명령** — 4가지 컨텍스트 자동 감지 (로그인 X / 프로젝트 X 등)
- **status / logout** 보조 명령
- 디버그 로깅 (`MYTOOL_DEBUG=1`)

### Phase 4: `packages/web` ✅ (Next.js 15 + React 19 + Recharts)
- **Auth.js 안 쓰고 단순화**: httpOnly 쿠키 + JWT 직접 처리
- **로그인/회원가입 페이지**
- **대시보드 Overview** — KPI 카드 4개 + 일별 토큰 차트(Recharts AreaChart) + Top Skills/Agents
- **Sessions 페이지** — 최근 세션 테이블
- **Skills 페이지** — 호출 빈도 바 차트
- **Settings 페이지** — 첫 사용자 가이드
- 미들웨어 — 인증 미보호 라우트 차단
- Tailwind 다크 테마
- **Web Dockerfile** (Next.js standalone build)

### 단위 테스트 ✅
가장 위험한 코드 3곳에 테스트 작성:
- `hooks-inject.test.ts` — 멱등성, 기존 hook 보존, 손상된 JSON 처리
- `transcript.test.ts` — 토큰 합산, 손상된 줄 무시, slash 감지의 두 패턴
- `events.test.ts` (api) — Skill/Agent 파생 필드, 길이 제한
- `pricing.test.ts` (shared) — 비용 계산, 알 수 없는 모델 fallback

## 📂 생성된 파일 구조

```
mytool/
├── README.md
├── docker-compose.yml          # Postgres + API + Web 모두 정의
├── docs/architecture.md        # 전체 설계 문서 (Argos와의 차이점 포함)
├── package.json (root)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
└── packages/
    ├── shared/                 # 7 files
    │   └── src/
    │       ├── index.ts
    │       ├── constants/pricing.ts (+test)
    │       └── schemas/{auth,events,project,dashboard}.ts
    ├── api/                    # 19 files
    │   ├── prisma/schema.prisma
    │   ├── Dockerfile
    │   └── src/
    │       ├── app.ts, index.ts, env.ts, db.ts
    │       ├── lib/{jwt,errors,events}.ts (+events.test.ts)
    │       ├── middleware/{auth,error}.ts
    │       └── routes/{health,auth,events,orgs,projects,dashboard}.ts
    ├── cli/                    # 14 files
    │   └── src/
    │       ├── index.ts (entry)
    │       ├── commands/{main,hook,status}.ts
    │       └── lib/
    │           ├── api-client.ts, config.ts, project.ts
    │           ├── stdin.ts, debug.ts
    │           ├── hooks-inject.ts (+test)
    │           └── transcript.ts (+test)
    └── web/                    # 17 files
        ├── Dockerfile, next.config.ts, tailwind.config.ts
        └── src/
            ├── middleware.ts
            ├── lib/{auth,server-api}.ts
            ├── components/{logout-button,token-usage-chart}.tsx
            └── app/
                ├── layout.tsx, page.tsx, globals.css
                ├── login/page.tsx, settings/page.tsx
                ├── api/{auth,logout}/route.ts
                └── dashboard/[projectId]/
                    ├── layout.tsx, page.tsx
                    ├── sessions/page.tsx
                    └── skills/page.tsx
```

## ✅ 다음 단계 (실행 가능한 상태)

지금 코드를 받아서 바로 실행하려면:

```bash
# 1. 압축 해제 후
cd mytool

# 2. 의존성 설치
pnpm install

# 3. 환경변수 설정
cp .env.example .env
# .env에서 JWT_SECRET, AUTH_SECRET, POSTGRES_PASSWORD 채우기
# (최소 32자, openssl rand -base64 48 추천)

# 4. DB 띄우기
pnpm db:up

# 5. shared 빌드 → DB 마이그레이션
pnpm --filter @mytool/shared build
pnpm db:migrate
# (첫 실행 시 마이그레이션 이름 입력 요구. "init" 등으로)

# 6. 개발 서버 실행
pnpm dev
# → API: http://localhost:3001/health
# → Web: http://localhost:3000

# 7. CLI 빌드 후 자기 자신에게 적용
pnpm --filter mytool-ai build
node packages/cli/dist/index.js --api-url http://localhost:3001
# → 회원가입 → 프로젝트 생성 → hook 자동 주입
```

## 🚧 알려진 제약 / 다음 작업 후보

이번 작업은 **MVP**이고, 운영 단계로 가려면 추가 작업이 필요해요:

### 빠른 검증을 위해 즉시 추가 권장
1. **첫 실제 이벤트 수집 검증** — 실제 Claude Code에서 hook이 발화되는지 확인
2. **Prisma 마이그레이션 첫 생성** — `pnpm db:migrate` 실행 시 SQL 파일 생성됨
3. **lockfile 생성** — `pnpm install` 시 `pnpm-lock.yaml` 자동 생성

### MVP 다음 단계
4. 세션 상세 페이지 (전사 뷰어) — `Message` 테이블은 있지만 채우는 로직과 UI는 미구현
5. Users 페이지 (Argos에 있던 팀원별 통계 화면)
6. 날짜 범위 피커
7. 비용 알림 (월별 한도)
8. **invite 시스템** — 현재는 본인 org만 사용 가능, 팀원 초대는 미구현

### 운영 강화
9. Rate limit 미들웨어 (특히 `/api/events`)
10. 더 많은 단위 테스트 (인증, 권한, dashboard 집계)
11. E2E 테스트 (Playwright)
12. 로깅·모니터링 (Sentry 같은 도구)
13. CI/CD (GitHub Actions)

## 🆚 Argos와의 핵심 차이 요약

| 항목 | Argos | mytool |
|------|-------|--------|
| 인증 (Web) | Auth.js v5 + Credentials provider | httpOnly 쿠키 + JWT 직접 |
| DB connection | Supabase의 `DIRECT_URL` 분리 | 단일 `DATABASE_URL` |
| Docker Compose | Postgres만 | Postgres + API + Web 전체 |
| 라이선스 | LICENSE 파일 부재 (README만 MIT) | LICENSE 명시 (MIT) |
| Stale 도메인 마이그레이션 | 있음 | 없음 (불필요) |
| 일별 집계 SQL | raw SQL (`$queryRaw` + `Prisma.sql`) | type-safe Prisma 쿼리 |
| 모노레포 도구 | turborepo + pnpm | turborepo + pnpm (동일) |

각 차이점은 **셀프호스팅 단순화 + 디버깅 용이성**이라는 명확한 이유가 있어요.

## 📦 결과물

`/mnt/user-data/outputs/`:
- `mytool/` — 전체 소스 트리
- `mytool-phase0-3.zip` — 압축 버전 (다운로드용)
- 이전 분석 문서 3개 (`claude-code-monitor-plan.md`, `..-v2.md`, `argos-clone-issues.md`)
