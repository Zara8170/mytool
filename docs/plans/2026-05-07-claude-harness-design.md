# claude-harness 설계 문서

**날짜:** 2026-05-07  
**상태:** 승인됨

## 개요

어떤 프로젝트에도 붙일 수 있는 재사용 가능한 자율 개발 하네스(autonomous development harness). Argos 프로젝트의 자율 주행 기법을 참고해 독립적인 pip 패키지로 구현한다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 형태 | 별도 레포 (`claude-harness`) + 로컬 pip 패키지 |
| 언어 | Python |
| 요구사항 저장 | `harness.yaml` (YAML) |
| 검증 전략 | 빌드 + 자동화 테스트 (`verify_cmd` 커스텀 가능) |
| Claude 호출 | `claude --print --dangerously-skip-permissions` |

## 레포 구조

```
claude-harness/
├── pyproject.toml
├── README.md
└── claude_harness/
    ├── cli.py              # harness init / harness run 진입점
    ├── runner.py           # 메인 이터레이션 루프
    ├── phases/
    │   ├── ideation.py     # pending 요구사항 선택
    │   ├── build.py        # claude CLI 호출, git HEAD 저장
    │   ├── verify.py       # verify_cmd 실행 및 결과 수집
    │   └── report.py       # pass/fail 판정, status 업데이트
    ├── config.py           # harness.yaml 파싱
    └── state.py            # 요구사항 status 파일 업데이트
```

## `harness.yaml` 스키마

```yaml
project: advisor
verify_cmd: "npm run build && npm test"

requirements:
  - id: req-001
    title: "사용자 로그인 API"
    description: "JWT 기반 로그인, 회원가입 엔드포인트"
    status: pending      # pending | in_progress | done | failed
  - id: req-002
    title: "대시보드 페이지"
    status: pending
```

## 이터레이션 루프

```
1. Ideation  → harness.yaml에서 status: pending인 요구사항 선택
2. Build     → 현재 git HEAD 저장
             → claude --print --dangerously-skip-permissions
               "다음 요구사항을 구현해줘: {title}\n{description}" 실행
3. Verify    → verify_cmd 실행
             → exit code 0 = pass, 그 외 = fail
4. Report    → pass: status: done으로 업데이트
                      iter-id: {N}-{timestamp} 트레일러로 git commit
             → fail: git reset --hard {saved_HEAD}
                     status: failed로 업데이트
5. 대기      → 10초 후 다음 이터레이션
```

## 사용 흐름

```bash
# 1. 설치 (한 번만)
pip install -e ~/tools/claude-harness

# 2. 대상 프로젝트에서 초기화
cd ~/projects/advisor
harness init       # harness.yaml 템플릿 생성

# 3. 요구사항 작성 후 실행
harness run
```

## 범위 외 (YAGNI)

- PyPI 배포 (로컬 설치로 충분)
- 웹 UI 또는 대시보드
- 병렬 이터레이션
- 외부 이슈 트래커 연동 (Notion, Linear 등)
