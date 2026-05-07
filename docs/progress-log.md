# mytool 통합 진행 로그

> 매 세션마다 한 두 줄씩 추가. 새 세션 시작 시 이 파일을 먼저 읽으면 즉시 컨텍스트 복구.
> 큰 결정 사항은 `integration-plan.md` 의 §10a 에 별도 기록.

## 2026-05-07

### Session 1 — 설계 + PR 1 완료
- claude-sync 단독 도구 완성 (`C:\git\personal\claude-sync`).
- mytool 통합 설계 v2 작성 (`C:\git\personal\mytool\docs\integration-plan.md`).
  - 4축 비전 (Memory · Skills · Execution + Observability backbone)
  - hook 3종 (SessionStart / PreToolUse / Stop), fail-open
  - 일본 서버 SLA: SessionStart 800ms, PreToolUse 500ms
  - daemon 모드 (PR 11) — Vercel 호스팅에 필수
- **PR 1 구현 완료** — Project 토글 + UI:
  - `Project` 모델에 `syncEnabled`/`harnessEnabled`/`harnessConfig` 추가
  - 마이그레이션 SQL 파일 작성 (`20260507120000_add_sync_harness_toggles`)
  - shared 의 `PatchProjectSchema` 신규
  - api 의 PATCH 라우트 신규 (Hono + Next.js 양쪽)
  - Overview 페이지에 "Workspace" 섹션 + 토글 카드 2개
  - 검증: 미진행 (사용자님 PC 에서 일괄 검증 예정)

### Session 2 — PR 1 검증 + CLI 프로필 분리 + develop push
- **PR 1 검증 5개 항목 모두 통과**
  - 마이그레이션: `migrate reset` 으로 깨끗이 적용 (로컬 데이터 없어 안전)
  - 타입 빌드: 통과 (Windows standalone EPERM 은 개발자 모드 켜서 해결)
  - PATCH 라우트: 첫 시도 시 `Missing Bearer token` 에러 → web `[projectId]/route.ts` 의 GET/PATCH 가 `requireAuth(req)` (Bearer) 쓰던 것을 DELETE 와 동일한 쿠키 기반 `requireWebAuth()` 헬퍼로 통일. 수정 후 통과.
  - UI 토글: 200 OK + 새로고침 후 상태 유지 확인
  - 권한 / drift: 코드 일관성 + `migrate status` 로 갈음
- **부산물 1: CLI 빌드 의존성 누락** — `packages/cli/package.json` 에 `@mytool/shared`, `zod` 가 빠져 있어 tsup 빌드 실패. 추가하고 `pnpm install` 재실행으로 해결.
- **부산물 2: CLI 프로필 분리 시스템 도입** — prod/dev 환경 전환마다 매번 로그아웃·재로그인 하는 통증 제거.
  - `MYTOOL_PROFILE` 환경변수 → `~/.mytool/config.<profile>.json`
  - 미설정 시 `default` (= 기존 `config.json`, 하위호환)
  - `MYTOOL_API_URL` 환경변수도 추가 지원 (override flag 다음 우선순위)
  - `mytool` 헤더에 `[dev]` 같은 프로필 태그 표시
- **글로벌 mytool 명령을 로컬 dist 에 링크** — `npm uninstall -g mytool-ai` → `pnpm setup` (PNPM_HOME 셋업) → `pnpm link --global`. 이후 `pnpm --filter mytool-ai build` 만 하면 즉시 반영.
  - VSCode 통합 터미널의 PATH 가 시스템 PATH 를 덮는 이슈 발견. 임시로 세션마다 `$env:PATH = "$env:PNPM_HOME;$env:PATH"` 처리 중. 영구 해결은 `terminal.integrated.env.windows` 로 (보류).
- **commit 4개로 정리**:
  1. `feat: PR 1 sync/harness toggle infrastructure` (auth fix 포함)
  2. `fix(cli): missing @mytool/shared and zod deps`
  3. `feat(cli): MYTOOL_PROFILE env var`
  4. `docs: integration-plan v2 + progress-log`
  - 14개 파일은 LF→CRLF 노이즈만 있어 `git checkout --` 로 되돌림
- **`develop` 브랜치에 push** — Vercel 이 develop 도 자동 배포하는 줄 모르고 push 해버림. 다행히:
  - prod Supabase DB 에 마이그레이션 미적용 (build script 가 `prisma generate` 만 호출, `migrate deploy` 없음)
  - 사용자=본인뿐이라 잠재 영향 0
  - 정식 배포는 M1 (PR 3) 끝나고 develop → main PR 머지 시점에. 그때 Vercel preview 환경이 prod DB 와 분리됐는지도 점검 필요.

### Session 3 — PR 2 (packages/sync 신규 + claude-sync lib 이전) 코드 작성
- **완료**:
  - `packages/sync/` 스캐폴딩 (package.json, tsconfig, tsup.config, vitest.config, README)
    - cli 패턴 차용: tsup esm 빌드, vitest, `mytool-sync` 라는 bin 추가
    - 라이브러리 surface 는 shared 패턴 차용 — `main: src/index.ts` + `exports` 필드로 `@mytool/sync/scanner` 같은 sub-path 도 import 가능
  - 4개 lib TS 이전 (`scanner.ts`, `bundle.ts`, `mask.ts`, `preset.ts`)
    - 원본 `.mjs` 와 동일 동작 유지 — 함수 시그니처·필드명·동작 모두 보존
    - 공통 타입은 `src/types.ts` 로 분리 (PR 3 에서 shared 로 이동 가능)
    - `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` 에 맞춰 옵셔널 필드 `?:`, 인덱싱 결과 `?? "?"` fallback 처리
    - bundle 의 yauzl/archiver 콜백을 Promise 로 타입 안전하게 래핑
  - CLI shim 4개 (`commands/{scan,export,import,preset}.ts` + `cli.ts`)
    - 원본과 동일한 commander 명령·옵션·에러 출력 유지
    - import 커맨드는 SyncManifestItem 과 SyncItem 의 변환을 `toSyncItem()` 으로 처리
  - 단위 테스트 작성:
    - `mask.test.ts` — JSON 키 기반·텍스트 정규식 기반 마스킹, 비대상 타입, 변경 없음 케이스 (총 7개)
    - `scanner.test.ts` — scanGlobal/scanProject/autoDiscoverProjects/scanAll, 임시 디렉토리에 가짜 .claude 만들어 검증, scheduled_tasks.lock 스킵, node_modules/hidden 미하강, 중첩 .claude 무시 (총 10개)
- **블로커 (이번 세션에서 해결 못 함)**:
  - **샌드박스에서 `pnpm install` 실패** — `packages/cli/package.json` 이 디스크상 750B 에서 잘려 있음 (`"en` 에서 끝남, `engines` 섹션과 closing `}` 누락). Read 도구로 보면 정상 41줄로 보이는데 실제 디스크 바이트는 truncated.
  - Write 도구로 41줄 정상 내용 덮어썼지만 mount 측에서 여전히 750B 로 stale 상태. host filesystem 과 sandbox mount 간 동기화 이슈로 추정.
  - 결과: typecheck/test 실행 + claude-sync 와 동일성 비교 검증은 **사용자 PC 에서 직접** 해야 함.
- **사용자가 다음에 해야 할 것** (Session 4 시작 시):
  1. `cat C:\git\personal\mytool\packages\cli\package.json` 으로 파일 끝 확인. `"en` 으로 끝나면 손상이 host 에도 있는 것 — 정상 41줄 내용 (Session 2 의 "부산물 1" 결과인 `@mytool/shared` + `zod` 추가된 형태) 으로 직접 복구.
  2. `pnpm install` — `packages/sync` 의 deps (commander, chalk, archiver, yauzl, @inquirer/prompts, zod, @types/archiver, @types/yauzl, tsup, tsx, vitest) 다운로드.
  3. `pnpm --filter @mytool/sync typecheck` — strict TS 통과 확인.
  4. `pnpm --filter @mytool/sync test` — vitest 17개 케이스 전부 PASS 인지.
  5. `pnpm --filter @mytool/sync build` — `dist/cli.js` 생성.
  6. `node packages/sync/dist/cli.js scan -j` 와 `claude-sync scan -j` 결과 비교 (jq 로 정렬 후 diff 권장). 차이가 나면 PR 2 끝나기 전에 수정.
  7. 모든 검증 통과 시 commit 분리: (a) 스캐폴딩, (b) lib TS 이전 + 테스트, (c) CLI shim. 옵션으로 cli/package.json 복구 commit.

### 다음 세션 시작 시
1. `docs/integration-plan.md` 읽기 — 4축 비전, 결정사항 (§10a)
2. `docs/progress-log.md` (이 파일) 읽기 — 어디까지 했는지
3. **Session 3 의 사용자 후속 작업 7단계** 점검 후 PR 3 (Sync API + Settings 페이지) 진입.
