# 실행 방법

`SKILL` = `~/.agents/skills/spec-schema-org` (Claude Code 에선 `~/.claude/skills/spec-schema-org`)

## 준비
1. `spec/` 에 명세서 원본을 넣는다. 구글 시트는 xlsx 로 내려받으면 모든 시트가 들어온다.
2. `config.json` 을 채운다. 키 설명은 `SKILL/docs/config-reference.md`, DB 설정은 `SKILL/docs/db-presets.md`.
3. 점검한다: `node SKILL/scripts/run.mjs --dir . --check`

## Run A — 정본 정리 · 요구사항 분석 · 모순 보고
```bash
node SKILL/scripts/run.mjs --dir . --run A
```
끝나면 할 일:
- `00-spec/INDEX.md` 를 확인한다.
- `log/contradictions.md` 의 **"사용자 결정:"** 칸을 채운다. 비워 두면 부장 권고안이 잠정 결정으로 진행된다.

## Run B — 모델 → 스키마 → 검증 → 문서 → 최종 평가
```bash
node SKILL/scripts/run.mjs --dir . --run B
```
결과물:
- `S7-docs/01-관계도.md`
- `S7-docs/tables/*.md`
- `S8-final/boss-evaluation.md`

## 운영
- **중단 후 재개:** 같은 명령을 다시 실행하면 이어서 진행한다. 처음부터 하려면 `--fresh`.
- **흐름만 시험:** `--engine mock` (리젝 주입: `--mock-reject S5`)
- **엔진 섞기:** `config.json` 의 `engines`. 예: `{"default":"claude","S5":"codex","S8":"codex"}`
- **이력:** `git log --oneline` / `git log --grep REJECT` / `.run/logs/` (에이전트 호출 원문)
- **부장에게 질문:** Claude Code 나 Codex 에게 "prompts/01-boss.md 의 부장으로서 답해줘: <질문>"
