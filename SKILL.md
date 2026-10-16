---
name: spec-schema-org
description: 요구사항 명세서(스프레드시트·문서)만 있고 화면 기획은 아직 없을 때, "부장 + 역할별 직원" 멀티에이전트 조직이 명세를 전부 만족하는 DB 스키마를 설계·검증·문서화한다. 리젝되면 원인 단계로 돌아가고, 모든 토론·결정·회귀를 기록하며, 단계마다 git 커밋한다. Claude Code·Codex 어느 쪽에서도 동작한다. 사용자가 "명세서로 DB 스키마 설계", "스키마 설계 조직 돌려줘", "spec-schema-org" 를 말하거나 이 스킬의 작업 폴더(config.json + prompts/01-boss.md)에서 작업할 때 사용.
---

# spec-schema-org — 명세서 → DB 스키마 설계 조직

부장 1명과 직원 S0~S8 이 명세서(정본)를 **전부 만족하는 DB 스키마**를 예상 설계한다.
- 직원이 단계마다 브리핑하면 부장이 정본을 근거로 토론하고, 그 내용이 기록에 남는다.
- 리젝되면 **원인 단계로 회귀**한다.
- 최종 산출물은 **전체 관계도 문서**와 **테이블별 명세 문서**다.

사람이 읽을 개념 설명은 [README.md](README.md) 에 있다.

`SKILL_DIR` = 이 파일이 있는 폴더 (`~/.agents/skills/spec-schema-org` 또는 `~/.claude/skills/spec-schema-org`).

## 무엇을 할지 고르기
| 사용자 요청 | 할 일 |
|---|---|
| 새로 시작 | §1 → §2 → §3 |
| 작업 폴더가 있고 "Run A/B 돌려줘" | §3 |
| 진행 상황 보기 | `git -C <작업폴더> log --oneline`, `<작업폴더>/.run/state.json` |
| "부장에게 물어봐" / 명세 질문 | §4 |
| 리젝·회귀 이력 보기 | `git -C <작업폴더> log --grep REJECT`, `log/regressions.md` |

## 1. 작업 폴더 만들기
```bash
node SKILL_DIR/scripts/init.mjs <작업폴더>
```
- 템플릿을 복사하고 `git init` 과 첫 커밋까지 한다. 이미 있는 파일은 덮어쓰지 않는다.
- 작업 폴더는 사용자에게 묻는다. 기본값은 `<현재 폴더>/schema-org`.
- 명세서 원본 파일(xlsx·csv·md·docx·pdf)은 사용자가 `<작업폴더>/spec/` 에 넣는다.
  - 구글 시트라면 xlsx 로 내려받아 넣으라고 안내한다. 모든 시트가 함께 들어온다.

## 2. config.json 채우기 (사용자와 대화하며)
`<작업폴더>/config.json` 을 연다. 아래 질문을 **한 번에 묶어** 묻고, 답을 받아 채운다. 각 키의 뜻은 `docs/config-reference.md`, DB 프리셋은 `docs/db-presets.md` 를 본다.
1. 프로젝트 이름과 명세서 파일. 명세서 안에 테이블 목록 시트가 있으면 그 시트를 `baseline.source` 로 쓴다.
2. 기존 스키마에 붙여 확장하는지(`extend`), 독립 스키마인지(`standalone`). 확장이면 저장소 경로·ref·스키마 파일 경로.
3. DB 와 ORM. 프리셋: `prisma-mysql`, `prisma-postgres`, `sql-mysql`, `sql-postgres`.
4. 담당 구분 여부. "나"와 팀원, 그리고 명세서에서 담당을 나타내는 열 이름. 없으면 `ownership.me = null` 이고, 그러면 모든 테이블이 확정 등급이 된다.
5. 엔진: 전부 claude / 전부 codex / 섞기.
   - 섞기 예: 부장은 claude, 레드팀(S5)은 codex 처럼 서로 다른 모델이 검토하게 한다.

채운 뒤 점검을 돌린다:
```bash
node SKILL_DIR/scripts/run.mjs --dir <작업폴더> --check
```
엔진 CLI 설치, docker, 명세서 파일, 기존 스키마 경로를 확인한다. 실패 항목은 사용자에게 알린다.

## 3. 실행
```bash
node SKILL_DIR/scripts/run.mjs --dir <작업폴더> --run A     # 정본 정리 · 요구사항 분석 · 모순 보고
# 사용자: log/contradictions.md 의 "사용자 결정:" 칸 채움
node SKILL_DIR/scripts/run.mjs --dir <작업폴더> --run B     # 모델 → 스키마 → 검증 → 문서 → 최종 평가
```
- **오래 걸린다.** 단계마다 에이전트 CLI 를 3~4번 호출한다.
  - Claude Code: Bash 의 `run_in_background` 로 실행하고, 끝나면 결과를 요약한다.
  - Codex: 사용자에게 별도 터미널에서 실행하라고 안내하거나, 긴 타임아웃으로 실행한다.
- **중단 후 재실행:** 같은 명령을 다시 실행하면 `.run/state.json` 기준으로 이어서 진행한다. 처음부터 다시 하려면 `--fresh`.
- **흐름만 시험:** `--engine mock` 으로 LLM 없이 상태 전이와 커밋만 시험할 수 있다. 리젝 주입은 `--mock-reject S5`.
- **끝나면 보여줄 것:** 결과 JSON 의 status, 회귀 횟수, `git log --oneline`. 그리고 산출물 경로:
  - Run A: `00-spec/INDEX.md`, `log/contradictions.md`
  - Run B: `S7-docs/`, `S8-final/boss-evaluation.md`
- **`STOPPED` 로 끝나면** `log/contradictions.md` 의 "사용자 결정 필요" 항목을 사용자에게 보여준다.

## 4. 부장으로서 답하기
`<작업폴더>/prompts/00-common-rules.md` 와 `prompts/01-boss.md` 를 읽고, "질문에 답하는 절차"를 따른다.
- 순서: decisions → INDEX → 원문 grep.
- 반드시 근거(REQ-ID, 원문 행)를 인용한다. 정본에 없는 내용이면 "정본에 없음"이라고 말한다.

## 주의
- 이 스킬은 공유 DB 에 아무것도 적용하지 않는다. 검증은 일회용 로컬 컨테이너에서만 한다.
- 기존 저장소는 `git show <ref>:<path>` 로 **읽기만** 한다.
- 헤드리스 실행에는 권한 우회 플래그가 들어간다(`config.json` 의 `engineArgs`). 작업 폴더 안에서만 쓰기를 하도록 프롬프트로 제한하지만, 사용자에게 이 점을 한 번 알린다.
