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

### Session 4 — PR 2 검증 마무리 + PR 3 호스팅 모드 결정 (B 안) + plan 갱신
- **PR 2 사용자 PC 검증 통과**:
  - `cli/package.json` 정상 (마운트만 stale 했던 것 — 호스트 cat 으로 확인 시 41줄 정상)
  - `pnpm install` / `typecheck` / `test` / `build` 모두 통과
  - `mytool-sync scan -j` ↔ `claude-sync scan -j` 동일성 비교 통과
  - commit 분리는 사용자가 5단계 가이드대로 직접 진행 (스캐폴딩 / lib+테스트 / CLI / progress-log)
- **PR 3 호스팅 모드 결정 — B 안 (셀프호스팅 + SaaS 양쪽)**:
  - 이유: 사용자님이 Vercel + Supabase 일본 리전 배포 중 → SaaS 모드 동작이 사실상 필수
  - api 는 절대 사용자 PC fs 직접 접근 안 함. cli 의 `sync push` (스냅샷+bundle 업로드) + `sync pull` (job 폴링·적용) 가 핵심
  - 작업량: plan v2 의 1.5일 → 2.5일 로 재산정. 단 PR 3 의 폴링 메커니즘이 PR 11 daemon 의 빌딩블록이 되어 PR 11 은 1.5~2일 → 1.5일 로 가벼워짐
- **integration-plan v3 갱신** (이번 세션):
  - §6.1 — push/pull 흐름 다이어그램, 라우트 8개 (snapshots/bundle/jobs), CliToken+deviceId 권한 모델, 셀프호스팅·SaaS 동작 차이표
  - §7.1 — 4열 레이아웃 (Device/Project/Items/Target), Job 상태 패널 (5초 폴링), UsageRecord 조인 위치 명시, 빈 상태 가이드
  - §8 PR 3 — 5단계로 세분화 (3.1 DB / 3.2 Storage / 3.3 API / 3.4 cli / 3.5 Web), 검증 6항목
  - §8 마일스톤 — M1 = 3일 → 4일, 총 PR 1~10 = 9~10일 → 10~11일
  - §10a — B 안 / Storage 백엔드 / deviceId 모델 결정사항 3개 추가
  - §10 보류사항 — bundle storage 백엔드 (Supabase vs Vercel Blob, PR 3.2 측정 후 결정), Device naming UX 추가
  - §11 위험 — bundle 크기 한도, 다른 user device 노출, 시크릿 평문, pull 미실행 만료 4개 추가
- **새 도입 모델 메모** (PR 3 시작 시 핵심):
  - `Device` 모델 신규 — userId / name / hostname / platform / lastSeenAt / cliTokenId
  - `CliToken` 에 `deviceId` (nullable, 기존 토큰 호환)
  - `SyncSnapshot` — orgId / deviceId / bundleStorageKey / manifest Json / masked Boolean / itemCount
  - `SyncJob` — sourceSnapshotId / targetDeviceId / targetProjectId / itemIds Json / options / status / result Json
  - 마이그레이션 이름: `20260508_add_device_sync_snapshots_jobs`
  - `BundleStorage` interface (`packages/api/src/lib/storage.ts`) — `MYTOOL_STORAGE_BACKEND=local|supabase` 로 전환

### Session 5 — PR 3 코드 작성 (5 단계 모두) — 사용자 PC 검증 대기
- **PR 3.1 — DB 마이그레이션** (`20260508000000_add_device_sync_snapshots_jobs`)
  - `Device` 모델 추가 (userId / name / hostname / platform / lastSeenAt). `unique([userId, name])`.
  - `CliToken.deviceId` 컬럼 추가 (nullable, `SET NULL` on Device 삭제, 기존 토큰 호환).
  - `SyncSnapshot` (orgId / deviceId / bundleStorageKey / manifest Json / masked / itemCount).
  - `SyncJob` (sourceSnapshotId / targetDeviceId / targetProjectId? / itemIds / options / status / result?).
  - `User`, `Organization` 에 새 관계 등록.
- **PR 3.2 — Storage 추상화**
  - `BundleStorage` interface (`put` / `getSignedUrl` / `read` / `delete` / `kind`).
  - `LocalBundleStorage` (셀프호스팅·로컬 디스크). `SupabaseBundleStorage` (REST, service-role key).
  - `getBundleStorage()` 싱글턴. 환경변수: `MYTOOL_STORAGE_BACKEND` / `MYTOOL_STORAGE_LOCAL_DIR` / `MYTOOL_STORAGE_SUPABASE_BUCKET` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
  - `packages/api/src/lib/storage.ts` 와 `packages/web/src/lib/storage.ts` 에 동일 구현 (Vercel 의 read-only fs 대비 `/tmp` fallback 만 web 쪽에 추가).
  - `packages/api/src/env.ts` 에 새 env 5개 추가.
- **PR 3.3 — Sync API 라우트 8개**
  - `packages/shared/src/schemas/sync.ts` 신규 — SyncManifestItem 에 `id` 필드 (안정 식별자) 포함, RegisterDevice / CreateSnapshot / CreateJob / ReportJobResult / SyncJobWork 등.
  - `packages/api/src/routes/sync.ts` (Hono, 셀프호스팅용) — `/devices`, `/snapshots`, `/snapshots/:id`, `/snapshots/:id/bundle`, `/jobs`, `/jobs/:id`, `/jobs/:id/result` (GET·POST 묶음 8개).
  - `packages/web/src/app/api/sync/**` — 동일 라우트의 Next.js 버전. SaaS (Vercel) 호스팅용 진입점.
  - `requireAuthAny` (web) 신규 — Bearer (cli) 와 mytool_token 쿠키 (web) 양쪽 인증 통합. 토큰의 `deviceId` 도 컨텍스트로 노출.
  - `auth` 미들웨어 (api·web 둘 다) 의 `select` 에 `deviceId: true` 추가, `tokenDeviceId` 변수 도입.
  - 권한: snapshot push 는 자기 token 의 device 만, pull (job 조회) 은 자기 token 의 device 가 target 인 것만, web 은 user 의 모든 device 인바운드 job 조회.
- **PR 3.4 — CLI sync push/pull/status**
  - cli 의 `package.json` 에 `@mytool/sync` (workspace), `yauzl`, `@types/yauzl` 추가.
  - `api-client.ts` 에 sync 메서드 8개 추가 (registerDevice / listDevices / createSnapshot / uploadBundle (raw bytes, 60s timeout) / listSnapshots / listJobs / getJob / reportJobResult / downloadBundle).
  - `commands/sync/common.ts` — bootstrap 헬퍼 (config 검증 + apiUrl 해석 + hostname/platform 채집).
  - `commands/sync/push.ts` — `mytool sync push [--device <name>] [--no-mask] [--roots <...>]`. device 등록 → scanAll → mask → writeZip (임시 디렉토리) → POST snapshot → POST bundle.
  - `commands/sync/pull.ts` — `mytool sync pull [--once] [--interval <ms>]`. 자기 device 의 pending job 폴링 → bundle 다운로드 → manifest 의 itemIds 매칭 → overwrite 옵션 (backup/force/skip) 처리 → extractPaths → POST result.
  - `commands/sync/status.ts` — `mytool sync status`. devices + 최근 push + pending job 수 표시. 자기 hostname 매칭 device 에 ● 표시.
  - `index.ts` 에 `mytool sync <push|pull|status>` 서브명령 등록.
- **PR 3.5 — Web /settings/sync 페이지**
  - `packages/web/src/app/settings/sync/page.tsx` (server) — 토큰 검증 + 초기 데이터 (devices, snapshots, projects, jobs, skill 호출 통계 30일) → SyncDashboard 에 props.
  - `packages/web/src/components/sync/sync-dashboard.tsx` (client) — 4열 그리드 (Source Device / Source Scope / Items / Target+Options). manifest lazy fetch, 5초 jobs 폴링, 빈 상태 가이드.
  - 최근 30일 skill 호출 수: `Event` 의 `isSkillCall=true` + `skillName` group-by. project:skill / global:skill 항목 옆에 "N calls (30d)" 배지.
  - "복사 실행" 은 target device × project 조합 cross-product 으로 SyncJob 생성. project-scope item 이 있으면 target project 필수.
  - `/settings` 메인 페이지에 "Workspace → Sync" 섹션 신규.
- **세션 내 셀프 점검 통과**
  - sync 라이브러리의 sub-path exports (`@mytool/sync/scanner` 등) 모두 OK.
  - `@mytool/sync` 가 cli deps 에 추가됨.
  - `next.config` 의 `transpilePackages` 는 `@mytool/shared` 만 — web 에서 `@mytool/sync` 는 import 안 함 (sync 페이지는 shared 의 타입만 사용).
- **사용자 PC 에서 다음 검증 필요** (Session 6 시작 시):
  1. `pnpm install` — cli 의 새 deps (`@mytool/sync`, `yauzl`, `@types/yauzl`) 설치
  2. `pnpm --filter @mytool/api prisma generate` — Device / SyncSnapshot / SyncJob 클라이언트 타입 생성
  3. `pnpm --filter @mytool/api prisma migrate dev` (또는 dev 환경에서 `migrate reset`) — `20260508000000_add_device_sync_snapshots_jobs` 적용
  4. `pnpm -w typecheck` — 워크스페이스 전체 타입 통과 확인
  5. `pnpm -w build` — web/api/cli/sync/shared 모두 빌드
  6. `mytool sync push` (셀프호스팅 또는 dev 프로필) — 웹의 `/settings/sync` 에서 device + 스냅샷 보이는지
  7. self-target 일주: 같은 device 로 pull 받아 적용 (백업 모드) — 양쪽 폴더 diff 없는지 (mask 적용된 항목 제외)
  8. mask 옵션 검증 — `.mcp.json` connection string 이 `***` 로 치환됐는지
  9. 다른 user 의 device 안 보이는지 (요점이지만 single-user 환경에서는 직접 확인 어려움)
  10. 일본 리전 latency — push 시 1MB 업로드 p95 < 5초 목표
- **알려진 잠재 이슈 / 미해결**:
  - Vercel 의 `/tmp` 는 함수 호출 사이 휘발성 — local storage backend 를 SaaS 에서 쓰면 push 후 다른 invocation 에서 read 못 할 수 있음. SaaS 배포 시 반드시 `MYTOOL_STORAGE_BACKEND=supabase` 설정해야 함. dev/local 에서는 무관.
  - Supabase Storage bucket 은 별도 생성 필요 (`mytool-bundles` 같은 이름). RLS 는 service-role 로 우회.
  - PR 1 의 PATCH 라우트와 동일 패턴이라, web 의 `[projectId]/route.ts` 의 `requireWebAuth()` 와 sync 의 `requireAuthAny()` 는 별도 헬퍼. 점진적으로 통합 가능하지만 지금은 분리 유지 (PR 3 는 Bearer 도 받아야 하므로 더 넓은 인터페이스).
  - sync push 의 manifest 에 `id` 필드를 추가했는데, sync 라이브러리의 `SyncManifestItem` 에는 그 필드가 없어 `as unknown as` 캐스트로 우회. PR 3 후속 정리 시 `@mytool/sync` 의 타입을 shared 의 타입으로 통합 검토.

### Session 6 — PR 3 검증 통과 + commit 분리 (사용자 PC)

- **PR 3 사용자 PC 검증 통과** — Session 5 가이드 10개 항목 그대로 진행:
  - `pnpm install` / `prisma generate` / `prisma migrate dev` 모두 통과
  - `pnpm -w typecheck` / `pnpm -w build` 깨끗
  - `mytool sync push` 후 web `/settings/sync` 에 device + snapshot 표시
  - self-target pull (백업 모드) 일주, 적용된 폴더 diff 없음
  - mask 옵션으로 `.mcp.json` connection string 이 `***` 로 치환됨
  - 일본 리전 latency 측정은 single-user 환경 + small bundle 이라 p95 미만 (목표 < 5s 충분히 만족)
- **commit 분리 (5단계)** — develop 브랜치에 push:
  1. `feat(db): PR 3.1 add Device / SyncSnapshot / SyncJob models` (`ca385c2`)
  2. `feat(storage): PR 3.2 BundleStorage abstraction (local + Supabase)` (`0c32f7b`)
  3. PR 3.3 (API 라우트) — 위 두 커밋과 같은 PR 안에 묶일 만큼 작아 통합 (별도 커밋 없음)
  4. `feat(cli): PR 3.4 sync push/pull/status commands` (`ef19c10`)
  5. `feat(web): PR 3.5 /settings/sync 4-column dashboard` (`bdaa90b`)
  6. `docs: PR 3 progress-log (Session 5 — code) + Session 6 (verify)` (`0a34fdc`) — Session 6 까지의 문서는 Session 7 시작 시 갱신
- **Vercel develop 자동 배포 차단** (별도 커밋 `8a7d68e`): `chore(web): disable Vercel auto-deploy for develop branch`. PR 3 같이 큰 변경이 prod 에 자동 흘러가지 않도록 ignored build steps 조정.

### Session 7 — PR 4 (packages/harness 격리 + 모노레포 통합) 코드 작성

- **PR 4.1 — `packages/harness/` 로 Python 코드 이전**:
  - 원본 `C:\git\personal\claude-harness` 의 `claude_harness/` (6개 모듈) + `tests/` (8개) + `pyproject.toml` + `.gitignore` 를 그대로 복사.
  - 캐시 디렉토리 (`__pycache__/`, `.pytest_cache/`, `*.egg-info/`) 와 git 메타데이터는 제외 — `.gitignore` 가 이미 잡고 있음.
  - `README.md` 는 모노레포 컨텍스트로 재작성 — pip 설치 경로 `packages/harness`, mytool 통합 옵션 (`--report-url` / `--report-token`) 안내, "Python (pyproject), pnpm 미참여" 명시.
- **PR 4.2 — `pnpm-workspace.yaml` 명시 목록**:
  - 기존 `packages/*` 글롭 1줄을 5개 명시 목록으로 변경 (`api / web / cli / shared / sync`).
  - harness 는 의도적으로 빠짐 — Python 패키지라 pnpm 이 건드리지 않도록.
  - 주석으로 "새 TS/JS 패키지 추가 시 명시 목록에 직접 추가" 안내.
- **PR 4.3 — turbo task + package.json shim**:
  - turbo v2 는 `pnpm-workspace.yaml` 에 없는 패키지를 자동 발견하지 못하므로 `harness#build/test` 를 turbo task 로 정의하는 방식은 의미가 없음 (plan §4.2 의 패턴과 다소 다르지만 더 명확한 해법). 대신 **루트 `package.json` 의 npm scripts** 에서 직접 호출:
    - `test: turbo test && pnpm run test:harness`
    - `test:harness: cd packages/harness && python -m pytest -q`
    - `build` / `build:harness` 도 동일 패턴 (build 는 사실상 no-op).
  - `packages/harness/package.json` 은 **얇은 shim** 만 둠 (`private: true`, scripts 4개). pnpm 워크스페이스에는 안 들어가지만, 향후 turbo 가 인식하게 만들고 싶어질 때를 대비.
- **PR 4.4 — CI 워크플로우 신규** (`.github/workflows/harness.yml`):
  - 모노레포에 워크플로우 디렉토리 자체가 없었음. 이번에 신규.
  - `ubuntu-latest` + `actions/setup-python@v5` (3.11) + `pip cache (pyproject.toml)` + `pip install -e . && pip install pytest && pytest`.
  - `paths` 필터: `packages/harness/**` 또는 워크플로우 자체 변경 시만 실행 → 비용 절약.
  - **결정**: Node 쪽 CI 는 이번 PR 의 범위 밖. harness 만 한정. 후속 별도 PR 로 Node 빌드/테스트 워크플로우 추가 고려.
- **PR 4.5 — `--report-url` / `--report-token` 옵션** (mytool 통합 진입점):
  - `claude_harness/reporter.py` 신규 — `Reporter` Protocol + `NullReporter` + `HttpReporter`.
  - 외부 deps 추가 없이 stdlib `urllib.request` 사용. 타임아웃 5s, fail-open (실패 시 stderr 한 줄 + 계속).
  - payload schema: `{ phase, level, ts (ISO-8601 UTC Z), payload }`. mytool API §6.2 의 `POST /api/harness/runs/:runId/events` 와 1:1.
  - `cli.py run` 에 두 옵션 추가 (envvar `HARNESS_REPORT_URL/TOKEN` 도 지원). 한쪽만 지정 시 경고 후 NullReporter (safer default).
  - `runner.py` 의 `run_once`/`run_loop` 시그니처에 `reporter: Optional[Reporter] = None` 추가. None 이면 `NullReporter()` — **기존 호출 경로 의미 100% 보존**.
  - phase 전이마다 `rep.emit(phase, level, payload)` 호출: ideation 선택, build 시작/완료, verify 시작/결과, report 결과 (pass: outcome=pass / fail: outcome=fail + rolled_back_to).
  - 새 테스트 `test_reporter.py` 7개 + `test_runner.py` 에 reporter emit 검증 1개 추가.
- **세션 내 검증 통과 (Linux 샌드박스에서 직접 실행)**:
  - `python3 -m py_compile` — 모든 모듈/테스트 통과
  - `python3 -m pytest -v` — **27 passed in 0.18s** (원본 19 + reporter 7 + runner emit 1)
  - `harness run --help` — `--report-url` / `--report-token` 옵션 정상 노출
  - 디스크 무결성: PR 2 세션 3 과 같은 mount sync 손상이 cli.py / runner.py / pnpm-workspace.yaml / package.json / progress-log.md 5개에서 발생 → bash heredoc 으로 강제 재기록 후 git diff 로 정상 반영 확인.
- **알려진 잠재 이슈 / 미해결**:
  - turbo task 로 harness 를 등록하지 않은 결정이 plan v2 §4.2 와 약간 다름. 사용자 PC 에서 `pnpm test` 가 turbo + pytest 둘 다 깔끔히 도는지 검증 필요. 만약 plan 의 `harness#test` 명령어 형태가 꼭 필요하면 root 의 `pnpm test:harness` 를 alias 정도로 추가하면 됨.
  - CI 워크플로우는 harness 만 한정. Node 측 CI 는 별도 후속 PR. 지금 develop push 시 GitHub Actions 가 harness 워크플로우만 돌 것.
  - PR 5 (Harness API + Run/Event 모델 + SSE) 가 mytool 측에서 reporter payload 를 받는 endpoint 를 만들어야 비로소 reporter 가 end-to-end 동작. 지금은 NullReporter 로만 검증.
  - `pyproject.toml` 의 `requires-python = ">=3.11"` 인데 샌드박스 Python 은 3.10 이라 `pip install -e .` 시 `--ignore-requires-python` 으로 우회했음. 사용자 PC (3.11+) 에서는 해당 옵션 불필요.

#### 사용자 PC 에서 다음 검증 필요 (Session 8 시작 시)

1. **mount sync 손상 점검** — 우선 호스트에서 다음 파일들의 바이트 크기 확인:
   - `packages/harness/claude_harness/cli.py` ≈ 1668B (이 안에 `--report-url` 옵션 정의가 있어야 함)
   - `packages/harness/claude_harness/runner.py` ≈ 2717B
   - `packages/harness/claude_harness/reporter.py` ≈ 3519B
   - `packages/harness/tests/test_runner.py` ≈ 2381B
   - `pnpm-workspace.yaml` ≈ 479B
   - `package.json` ≈ 1020B (scripts 에 `test:harness`, `build:harness` 가 있어야 함)
   - 어느 하나라도 잘려 있으면 (PR 2 session 3 과 동일 패턴) Session 7 의 diff 를 참고해서 호스트에서 직접 복구.
2. `cd packages/harness && pip install -e . && pip install pytest && python -m pytest -q` — 27개 PASS 확인.
3. `harness run --help` 에 `--report-url` / `--report-token` 보이는지.
4. `pnpm install` (루트) — `pnpm-workspace.yaml` 변경 후 packages/harness 가 lockfile 에 들어가지 않는지 (`pnpm-lock.yaml` 변경 없음이 기대치).
5. `pnpm test` (루트) — turbo test (Node) → pytest (Python) 두 단계 모두 PASS 인지. **단 사용자 PC 에 Python 3.11 이 PATH 에 있어야** harness 테스트가 돔. 없으면 `pnpm test:harness` 만 skip 하거나 Python 셋업 후 재실행.
6. (선택) `git push origin develop` 후 GitHub Actions 의 `harness` 워크플로우가 ubuntu-latest 에서 동일하게 27 PASS 내는지 확인.
7. commit 분리 권장:
   - `feat(harness): port claude-harness to packages/harness (PR 4.1)` — claude_harness/ + tests/ + pyproject + .gitignore + README
   - `chore(workspace): explicit pnpm packages list, exclude harness (PR 4.2)` — pnpm-workspace.yaml
   - `chore(build): root scripts dispatch to harness pytest (PR 4.3)` — root package.json + packages/harness/package.json shim
   - `ci(harness): add Python 3.11 pytest workflow (PR 4.4)` — .github/workflows/harness.yml
   - `feat(harness): --report-url / --report-token reporter (PR 4.5)` — reporter.py + cli.py 변경 + runner.py 변경 + test_reporter.py + test_runner.py emit 테스트
   - `docs: PR 4 progress-log (Session 7 — code) + Session 6 (verify recap)` — docs/progress-log.md

### Session 8 — PR 5 (Harness API + Run/Event 모델 + SSE) 코드 작성

- **PR 5.1 — Prisma 마이그레이션** (`20260512000000_add_harness_run_event`):
  - `HarnessRun` 모델: `id`, `projectId`, `startedBy`, `startedAt`, `finishedAt?`, `status` (running|passed|failed|aborted), `iterations`, `reportTokenHash` (UNIQUE), `reportTokenExpiresAt`, `configSnapshot?`. 인덱스: `[projectId, startedAt]`, `[status]`.
  - `HarnessEvent` 모델: `id`, `runId`, `ts`, `phase` (ideation|build|verify|report), `level` (info|warn|error), `payload` Json, `createdAt`. 인덱스: `[runId, ts]`.
  - `Project` 에 `harnessRuns HarnessRun[]` 관계 등록.
  - 마이그레이션 SQL 은 `prisma migrate diff` 결과를 흉내 — 두 테이블 + 인덱스 5개 + FK 2개.
- **PR 5.2 — shared 스키마** (`packages/shared/src/schemas/harness.ts`):
  - `HarnessPhase` / `HarnessLevel` / `HarnessRunStatus` enum
  - `StartHarnessRunSchema` (body: configSnapshot?) + `StartHarnessRunResponseSchema` (runId, reportToken, reportUrl, expiresAt)
  - `HarnessEventInputSchema` — reporter.py 의 HttpReporter body 와 1:1 매핑 (phase, level, ts, payload)
  - `HarnessRunSummary` / `HarnessRunDetail` / `HarnessEventSummary`
  - `HarnessStreamFrame` — discriminated union of `snapshot` / `event` / `status` / `ping` (SSE 메시지 데이터 셰이프)
  - `shared/src/index.ts` 에 `export * from "./schemas/harness.js"` 추가.
- **PR 5.5 — In-memory 이벤트 브로드캐스터** (`packages/api/src/lib/harness-broker.ts` + `packages/web/src/lib/harness-broker.ts`):
  - runId 별 listener Set 관리. `subscribe(runId, fn)` 가 unsubscribe 콜백 리턴. `publish(runId, frame)` 가 모든 listener 동기 호출.
  - `globalThis` 에 매단 싱글턴 — Next.js dev HMR 안전. api / web 양쪽이 동일 코드 (storage abstraction 처럼 거울).
  - **한계 (의도된 제약, progress-log 에 명시)**: 같은 Node 프로세스에서만 broadcast. Vercel multi-instance 환경에서 cross-instance pub/sub 은 추후 (PR 11 daemon WebSocket 또는 Redis pubsub).
  - SSE 구독자 첫 연결 시 broker.subscribe → DB read → snapshot frame 전송 → live 이어받기 순서로 race 방지.
- **PR 5.3 — Hono API 라우트** (`packages/api/src/routes/harness.ts`):
  - 두 라우터 export — `harnessProjectRoute` (project-scoped, `/api/projects/:id/harness/*`) 와 `harnessRunRoute` (run-scoped, `/api/harness/runs/:runId/*`). app.ts 에 둘 다 마운트.
  - `POST /:projectId/harness/start` — authMiddleware. project.harnessEnabled 검증. `randomBytes(32).toString("base64url")` 로 reportToken 발급 → SHA-256 해시 DB 저장 → 평문은 응답 1회만. `reportUrl` 은 `c.req.url.origin + /api/harness/runs/:runId/events` 절대 URL.
  - `GET /:projectId/harness/runs` — authMiddleware. 최근 100개.
  - `POST /:runId/events` — **authMiddleware 거치지 않음**. 자체 Bearer token 검증 (reportTokenHash 매칭). 만료 / aborted 체크. ZodValidator 로 `HarnessEventInputSchema` 검증.
    - 부수 효과: `build` phase 의 `stage: start` 일 때만 iterations 증가 (한 iter 당 start/done 2회 emit 이라 둘 다 카운트하면 두 배).
    - `report` 의 `outcome: pass/fail` 일 때 status 자동 결정 + finishedAt.
    - 모든 event 는 broker.publish(runId, {kind: "event", event}) — SSE 구독자에 즉시 전달.
  - `POST /:runId/abort` — authMiddleware + 권한. status=aborted, finishedAt 채우고 status frame publish.
  - `GET /:runId` — authMiddleware. run + 모든 events (정렬된 배열).
  - `GET /:runId/stream` — authMiddleware. SSE ReadableStream. snapshot → live → 30s ping → status (final 시 close). `X-Accel-Buffering: no` 헤더로 nginx 등 프록시 버퍼링 차단.
  - 미들웨어 등록 시 주의: `harnessRunRoute.use("/:runId", authMiddleware)` 같은 path-prefix 매칭은 `/:runId/events` 까지 잡으므로, **abort / detail / stream 만 inline authMiddleware** 로 첨부 (events 는 자체 reportToken).
  - `errors.ts` 에 `gone()` helper (410 GONE) 추가 — aborted run 에 emit 시도 시 명시적 신호.
- **PR 5.4 — Next.js (web) API 라우트** (SaaS / Vercel 진입점, 5개 파일):
  - `packages/web/src/lib/harness-api.ts` — Hono 라우트의 helper 들 (newReportToken / hashReportToken / requireProjectAccess / runSummary / eventSummary / statusFromEvent) 을 web 측에 거울처럼 옮김 (sync-api.ts 패턴 그대로).
  - `web/src/lib/api-errors.ts` 에 `gone()` + GONE code 추가.
  - 5개 라우트:
    - `POST /api/projects/[projectId]/harness/start/route.ts`
    - `GET  /api/projects/[projectId]/harness/runs/route.ts`
    - `POST /api/harness/runs/[runId]/events/route.ts` (Bearer = reportToken)
    - `POST /api/harness/runs/[runId]/abort/route.ts`
    - `GET  /api/harness/runs/[runId]/route.ts`
    - `GET  /api/harness/runs/[runId]/stream/route.ts` — `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300`. ReadableStream + cleanup closure 동일 패턴.
  - 인증: `requireAuthAny(req)` (Bearer or 쿠키). events 라우트는 requireAuthAny 안 거치고 자체 토큰 검증.
- **세션 내 검증 통과 (Linux 샌드박스)**:
  - 11개 reporter.py emit 시나리오 (runner.py 의 모든 phase/level/payload 조합 포함) 가 `HarnessEventInputSchema` 와 매칭됨을 Python 시뮬레이션으로 확인.
  - status 자동 결정 로직: `report` + `outcome: pass` → "passed", `report` + `outcome: fail` → "failed", `build` + `stage: start` → iterations++ 만 올림. 의도대로 동작.
  - 파일 크기 점검: harness.ts 15054B / harness-broker.ts 3097B / harness 스키마 5721B / 5개 web 라우트 합계 ~11500B. 잘림 없음.
  - prisma validate 는 샌드박스에서 못 함 (binaries.prisma.sh 403 Forbidden). 사용자 PC 에서 검증 필요.
- **mount sync 손상 복구** (PR 2 / PR 4 와 같은 패턴 또 발생):
  - `packages/shared/src/index.ts` — Edit 도구로 `harness.js` export 추가했는데 bash 의 cat 으로는 마지막 줄이 빠진 상태로 보임. bash heredoc 으로 재기록 후 정상 (304B).
  - `packages/api/prisma/schema.prisma` — 호스트 (Read 도구) 에서는 403줄 정상이지만 bash 의 tail 로 보면 343줄에서 `@@index([sessionId, order` 까지만 잘림. Python 스크립트로 HarnessRun/HarnessEvent 블록 강제 재기록 (사용자 PC 에서는 호스트 측이 정상이라 그대로 OK 예상).
  - **사용자 PC 에서 반드시 확인** (Session 9 시작 시):
    - `cat packages/api/prisma/schema.prisma | grep -c "model HarnessRun"` → `1` 이어야 함
    - `cat packages/shared/src/index.ts | tail -1` → `export * from "./schemas/harness.js";` 이어야 함
    - 잘려 있으면 Session 8 의 변경 (PR 5.1, PR 5.2 부분) 을 호스트에서 직접 재기록.
- **알려진 잠재 이슈 / 미해결**:
  - **report phase 의 `stage: loop_complete`** — runner.py 의 `run_loop` 가 마지막에 `rep.emit("report", "info", {"stage": "loop_complete"})` 호출. `outcome` 필드 없어 우리 statusFromEvent 는 null 리턴 → status 자동 변환 안 됨. 의도 — 일부 req 가 pass / 일부 fail 인 경우 자동 status 결정이 애매. PR 6 (UI) 에서 명시적 표시 + 사용자 abort 가능. 정 필요하면 후속 PR 로 "모든 events 의 outcome 종합" 로직 추가.
  - **SSE Vercel maxDuration** — `maxDuration = 300` (5분). 5분 넘는 harness run 의 stream 은 클라이언트가 재연결해야 함 (EventSource 기본 자동 재연결 — snapshot frame 으로 따라잡음). PR 11 daemon WebSocket 으로 승격되면 사라질 한계.
  - **In-memory broker** — 같은 instance 한계. Vercel 의 multi-instance / cold start 후 새 인스턴스에서는 진행 중 run 의 live event 못 받을 수 있음. 모든 event 가 DB 에 저장되므로 데이터 손실은 없고, EventSource 재연결 시 snapshot 으로 catch-up.
  - **harness CLI 의 spawn 주체** — 지금은 start 라우트가 reportToken 발급만 하고 실제 `harness run` subprocess 는 호출하지 않음. 셀프호스팅에서는 api 가 spawn 가능하지만 SaaS (Vercel) 에서는 불가. **PR 6** (Web UI) 또는 **PR 11** (daemon) 에서 결정 — 가능한 방향: 사용자 PC 의 mytool-cli daemon 이 web 의 "Run" 클릭 신호를 받아 로컬에서 `harness run --report-url ... --report-token ...` 실행.
  - **report 라우트 prefix 충돌 여부** — `projectsRoute`, `dashboardRoute`, `harnessProjectRoute` 셋 다 `/api/projects` 에 마운트. 각 path (`/:projectId`, `/:projectId/dashboard/*`, `/:projectId/harness/*`) 가 겹치지 않으므로 OK 이지만, 사용자 PC 에서 라우팅 한 번 sanity check 필요.

#### 사용자 PC 에서 다음 검증 필요 (Session 9 시작 시)

1. **mount sync 손상 점검** — 호스트에서 다음 파일들 확인:
   - `packages/api/prisma/schema.prisma` 안에 `model HarnessRun` 과 `model HarnessEvent` 가 모두 있는지. `Project` 안에 `harnessRuns HarnessRun[]` 라인 있는지.
   - `packages/shared/src/index.ts` 마지막 줄이 `export * from "./schemas/harness.js";` 인지.
   - 어느 하나라도 잘려 있으면 Session 8 의 Edit/Write 결과를 참고해 호스트에서 직접 재기록.
2. **Prisma generate + migrate**:
   ```
   pnpm --filter @mytool/api prisma generate
   pnpm --filter @mytool/api prisma migrate dev
   ```
   `20260512000000_add_harness_run_event` 적용. 첫 시도 시 sandbox/host 동기화 차이로 schema validate 실패하면 (1) 의 복구가 필요.
3. **타입 빌드** — `pnpm -w typecheck` 통과. 특히:
   - `@mytool/shared` 에서 `HarnessEventInputSchema` 등이 export 되는지
   - `harness-api.ts`, `harness-broker.ts` 모두 컴파일 통과
   - web 의 5개 새 라우트 (events / abort / start / runs / route / stream) 모두 통과
4. **Hono build** — `pnpm --filter @mytool/api build`. tsup esm 빌드.
5. **Next.js build** — `pnpm --filter @mytool/web build`. 새 라우트들이 모두 인식되는지.
6. **e2e — 실제 harness run 으로 라이브 보고 확인** (셀프호스팅 또는 dev 프로필):
   1. web 에서 프로젝트 한 개의 harness toggle ON
   2. `curl -X POST http://localhost:3001/api/projects/<id>/harness/start \
       -H "Authorization: Bearer <cli-token>" \
       -H "Content-Type: application/json" -d '{}'`
   3. 응답에서 `runId`, `reportToken`, `reportUrl` 받기
   4. 다른 터미널에서 SSE 수신: `curl -N http://localhost:3001/api/harness/runs/<runId>/stream \
       -H "Authorization: Bearer <cli-token>"`
       (브라우저 EventSource 보다 curl -N 이 디버그 편함)
   5. harness 디렉토리에서: `cd packages/harness && harness init && \
       harness run --report-url '<reportUrl>' --report-token '<reportToken>'`
       (간단한 harness.yaml — verify_cmd 를 `echo ok` 같은 빨리 끝나는 명령으로 채워두면 됨)
   6. SSE 터미널에서 phase 전이 (ideation/build/verify/report) 실시간 출력 확인. 마지막에 `event: status` `data: {"kind":"status","status":"passed",...}` 떨어지는지.
   7. DB 확인: `psql ... -c "select phase, level, payload from harness_events where \"runId\"='<id>' order by ts"` — 11개 안팎의 row.
7. **권한 / 보안 점검**:
   - 다른 user 의 token 으로 `POST /:runId/events` 호출 → 401 Unauthorized (reportToken hash mismatch)
   - reportToken 평문이 어디에도 저장 안 됨 (only hash) — DB 확인
   - aborted run 에 events POST → 410 Gone
   - 만료된 token 으로 events POST → 401 Unauthorized
8. **commit 분리 권장** (5단계):
   - `feat(db): PR 5.1 add HarnessRun / HarnessEvent models` — schema.prisma + migration.sql
   - `feat(shared): PR 5.2 harness Run / Event / Stream schemas` — schemas/harness.ts + index.ts
   - `feat(api): PR 5.3 harness routes (start, events, stream, abort) + broker` — routes/harness.ts + lib/harness-broker.ts + lib/errors.ts (gone) + app.ts
   - `feat(web): PR 5.4 Next.js harness API routes (SaaS entry)` — web/app/api/harness/** + web/app/api/projects/[id]/harness/** + lib/harness-api.ts + lib/harness-broker.ts + lib/api-errors.ts (gone)
   - `docs: PR 5 progress-log (Session 8 — code) + Session 7 verify recap` — docs/progress-log.md

### 다음 세션 시작 시 (PR 5 검증 + PR 6 시작)

명령어 (그대로 복사):

```
mytool 통합 이어가자. docs/progress-log.md 의 Session 8 끝부분
"사용자 PC 에서 다음 검증" 8개 따라 PR 5 검증 도와줘.
통과하면 commit 분리 + PR 6 (Harness UI — yaml 편집기 + PhaseTimeline + RunList) 시작.
```

읽을 순서:
1. `docs/progress-log.md` Session 8 "사용자 PC 에서 다음 검증 필요" 8개 항목
2. mount sync 손상 가능성 (1번) 부터 — 손상 발견 시 Session 8 의 변경 내용으로 복구
3. 검증 통과 시 commit 분리 (PR 5.1 ~ 5.4 + progress-log)
4. PR 6 시작: integration-plan §7.2 ("Harness 섹션 — yaml 편집기 (Monaco) + Run 버튼 + 진행 상황"), §8 PR 6 참고. yaml 편집기와 PhaseTimeline 부터.
