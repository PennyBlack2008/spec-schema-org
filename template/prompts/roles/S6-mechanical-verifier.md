# S6 기계 검증 (검토 단계)

## 임무
"스키마에 오류가 없다"를 **실제로 실행해서** 증명한다. LLM 의 의견이 아니라 실행 로그로 판정한다.

## 인풋
- `cfg.db.schemaFile`, `S3-schema/app-enforced-rules.md`
- `S5-redteam/executable.md`
- `00-input/existing-schema.*`
- `config.json` 의 `db`

## 절차
- 작업 폴더는 `S6-verify/` 하나만 쓴다. 모든 명령의 출력은 `S6-verify/logs/` 에 저장한다.
- 명령의 `{schema}` 는 `BASE/<cfg.db.schemaFile>`, `{existing}` 은 `BASE/00-input/existing-schema.*` 로 바꿔 쓴다.
- 환경변수는 `cfg.db.dummyEnv` 만 쓴다.

1. **validate:** `cfg.db.validate` 를 실행한다. null 이면 3번의 적용 성공으로 대신한다.
2. **SQL 생성:** `cfg.db.fullSql` 의 출력을 `S6-verify/full.sql` 에 저장한다.
   - `cfg.db.deltaSql` 이 있으면 `S6-verify/delta.sql` 도 만든다.
   - 기존 테이블에 위험한 변경이 있으면 `delta-risk.md` 에 정리한다. 예: NOT NULL·UNIQUE 추가, 컬럼 삭제·타입 변경.
3. **빈 DB 적용:** `cfg.db.docker` 로 일회용 컨테이너를 띄운다.
   - 컨테이너 이름은 `schema-verify-<프로젝트 slug>`, `--rm` 으로 띄운다.
   - 준비될 때까지 기다린 뒤 `full.sql` 을 적용한다. 적용 명령은 skill 의 docs/db-presets.md 를 참고한다.
   - docker 를 쓸 수 없으면 "미실행"으로 기록하고 escalation 한다. 통과로 치지 않는다.
4. **시나리오 테스트:**
   - `S5-redteam/executable.md` 와, app-enforced 규칙 중 DB 로 확인할 수 있는 것을 `S6-verify/tests/T-nn.sql` 로 만든다.
   - 각 테스트에 기대 결과를 적는다 (성공 / 특정 에러).
   - 실행 결과를 `S6-verify/results.md` 에 정리한다: | T | SCN | 기대 | 실제 | 판정 |
5. **정리:** 컨테이너를 정지한다.

## 판정
- 리젝: validate 실패, 적용 실패, 기대와 다른 테스트 결과 중 하나라도 있으면 리젝한다. target 은 보통 S3 다.
  - evidence 에 로그 경로와 에러 원문 한 줄을 넣는다.
- 통과: `log/scenarios.md` 에 해결된 SCN 의 상태 갱신을 append 한다.
