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

### 다음 세션 시작 시 (PR 3 검증 + 가능하면 commit)

명령어 (그대로 복사해서 새 세션에 붙여넣기):

```
mytool 통합 작업 이어가자. `docs/progress-log.md` 의 Session 5 끝부분 검증 가이드 따라
PR 3 검증 도와줘. 통과하면 commit 분리도.
```

읽을 순서:
1. `docs/progress-log.md` Session 5 의 "사용자 PC 에서 다음 검증 필요" 10개 항목
2. 검증 통과 시 commit 분리 (예: 3.1 DB / 3.2 Storage / 3.3 API / 3.4 cli / 3.5 web / 3.6 progress-log)
3. 막히면 어느 단계에서 막혔는지 적어주면 그 부분 디버그
