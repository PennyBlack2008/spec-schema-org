# spec-schema-org

> 명세서는 있는데 화면 기획은 아직 없다. 그래도 DB 스키마는 먼저 잡아야 한다.
> 이 스킬은 그 상황을 위한 **"부장 + 직원" 멀티에이전트 조직**이다.

<img width="1122" height="1402" alt="Image" src="https://github.com/user-attachments/assets/d5450b64-851b-4298-9aa9-deb6f9f4bd94" />

- Claude Code 와 Codex 에서 모두 쓴다. 단계마다 엔진을 섞을 수도 있다.
- 결과물:
  - 전체 관계도 문서
  - 테이블별 명세 문서: 컬럼별 아리까리한 부분, 주의점, 회귀 이력 포함
  - 부장의 최종 평가서
- 모든 판단·토론·회귀가 파일과 git 히스토리로 남는다.

## 조직

```
                 ┌──────────── 부장 ────────────┐
                 │ 매뉴얼: 00-spec/INDEX.md      │  정본을 REQ-ID 로 색인. 질문이 오면 원문을 찾아 인용
                 │       + log/decisions.md     │  같은 질문에 다른 답을 하지 않는다
                 └──▲──────────▲──────────▲─────┘
             브리핑·토론     게이트·중재    에스컬레이션
 S0 정본 정리원 ─▶ 시트별 정본 md + INDEX(부장 매뉴얼) + 기존 스키마 스냅샷
 S1 요구사항 분석가 ─▶ REQ 원자화·태그 + 모순(CON)/모호(AMB)/누락(GAP)
                 ── Run A 끝: 모순을 사용자에게 보고하고 결정을 받는다 ──
 S2 도메인 모델러 ─▶ 개념 ERD · 생명주기 · 담당 경계
 S3 물리 설계자 ─▶ 스키마 파일(+ 기존 스키마와 합본) · 경계 계약 · 테이블 예산
 S4 추적성 검증자 ─▶ REQ ↔ 컬럼·제약 매트릭스 (커버리지 100%)  ┐
 S5 레드팀 ─▶ 예외 시나리오 · 변경 내성 · 과설계 점검              ├ 리젝 → 원인 단계로 회귀
 S6 기계 검증 ─▶ validate · 빈 DB 적용 · 시나리오 SQL 실행         ┘
 S7 문서화 ─▶ 관계도 · 테이블 명세 · 담당별 요약
 S8 감사 + 부장 최종 평가
```

단계마다 같은 사이클을 돈다.
1. **브리핑:** 직원이 받은 인풋을 설명하고, 스키마를 깨뜨릴 예외 시나리오와 질문을 낸다.
2. **토론:** 부장이 정본 근거로 답하고, 시나리오를 판정하고, 결정을 기록한다.
3. **수행:** 직원이 산출물을 만들거나 검토한다.
4. **게이트:** 통과하면 다음 단계로 간다. 리젝되면 원인 단계로 돌아가 리젝 항목만 고친다.
   - 같은 구간 회귀가 3회를 넘거나 전체 회귀가 10회를 넘으면 부장이 진행할지 멈출지 결정한다.

## 설계 원칙 (프롬프트에 박혀 있음)
1. **정본 근거주의:** 모든 판단에 REQ-ID 와 원문을 인용한다. 근거가 없으면 가정(ASM)으로 기록한다.
2. **전부 설계하되 확정은 내 것만:** 팀원 담당 영역도 `[예상]` 으로 그린다.
   - 접점은 경계 계약으로 관리한다.
   - 내 테이블은 남의 설계가 달라져도 FK 교체 수준으로 버텨야 한다.
   - 담당 구분이 없으면 이 원칙은 꺼진다.
3. **화면 기획은 바뀐다:** 사실을 저장하고 화면값은 계산한다. 바뀌는 목록은 코드 테이블에 둔다. 화면이 바뀌어도 "컬럼 추가"로 끝나야 한다.
4. **과설계 금지:** 테이블 분리 근거는 5가지뿐이다. 명세의 테이블 목록이 기준선이고, 기준선 밖의 신규 테이블은 부장 승인이 필요하다.
5. **실행으로 검증:** LLM 의견이 아니라 validate 와 빈 DB 적용, 시나리오 SQL 결과로 판정한다.

## 빠른 시작
```bash
node ~/.agents/skills/spec-schema-org/scripts/init.mjs ./my-schema   # 작업 폴더 생성 + git init
# my-schema/spec/ 에 명세서를 넣고 my-schema/config.json 을 채운다 (docs/config-reference.md)
node ~/.agents/skills/spec-schema-org/scripts/run.mjs --dir ./my-schema --check
node ~/.agents/skills/spec-schema-org/scripts/run.mjs --dir ./my-schema --run A
# log/contradictions.md 의 "사용자 결정:" 칸을 채운다
node ~/.agents/skills/spec-schema-org/scripts/run.mjs --dir ./my-schema --run B
```
Claude Code 나 Codex 에게 "spec-schema-org 로 시작해줘" 라고 하면 위 과정을 대화로 안내한다.

## 설치
- **Codex:** `~/.agents/skills/spec-schema-org/` 에 두면 된다.
- **Claude Code:** `~/.claude/skills/spec-schema-org` 에 같은 폴더를 복사하거나 심볼릭 링크를 건다.
  ```bash
  ln -s ~/.agents/skills/spec-schema-org ~/.claude/skills/spec-schema-org
  ```
- **요구 사항:** Node 18+, git, (검증용) docker, 그리고 쓸 엔진의 CLI(`claude` 또는 `codex`).

## 엔진
`config.json` 의 `engines` 로 역할별 엔진을 고른다. 예: `{"default":"claude","S5":"codex","S8":"codex"}`.
- 각 호출은 헤드리스 CLI 1회다: `claude -p` / `codex exec`.
- 결과는 작업 폴더의 `.run/out/*.json` 파일로 주고받는다. 그래서 어느 엔진이든 같은 방식으로 동작한다.
- 커밋은 오케스트레이터가 직접 한다. 에이전트는 git 을 건드리지 않는다.

## 폴더 (작업 폴더)
| 경로 | 내용 |
|---|---|
| `config.json` | 프로젝트 전제 (사용자가 채움) |
| `spec/` | 명세서 원본 (읽기 전용) |
| `prompts/` | 공통 규칙 · 부장 · 양식 · 역할 S0~S8 — 프로젝트에 맞게 고쳐도 된다 |
| `00-input/`, `00-spec/` | 스냅샷, 정본 정리본, INDEX |
| `S1`~`S8` | 단계 산출물 |
| `log/` | 브리핑 · 토론 · 결정 · 가정 · 모순 · 시나리오 · 회귀 (추가만 하는 기록) |
| `.run/` | 오케스트레이터 상태 · 에이전트 결과 JSON · 호출 로그 |
