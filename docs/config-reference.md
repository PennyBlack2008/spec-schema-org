# config.json 레퍼런스

에이전트와 오케스트레이터는 모두 이 파일을 읽는다. 에이전트는 이 파일을 수정하지 않는다.

| 키 | 뜻 | 비고 |
|---|---|---|
| `project` | 프로젝트 이름 | 문서 제목에 쓰인다 |
| `language` | 산출물 언어 | `ko` / `en` |
| `spec.files` | 명세서 원본 경로 목록 (작업 폴더 기준) | xlsx·csv·md·docx·pdf. 여러 개 가능 |
| `spec.canonical` | 정본이 어디에 있는지에 대한 설명 | 사람용 메모 |
| `spec.allSheets` | 모든 시트(문서 전체)를 만족해야 하는지 | 보통 `true` |
| `baseline.source` | 테이블 기준선이 될 시트·섹션 이름 | `null` 이면 S2 결과를 부장이 승인한 것이 기준선 |
| `existingSchema.mode` | `extend`(기존 스키마 위에 확장) / `standalone`(독립) | `standalone` 이면 `repo/ref/path` 무시 |
| `existingSchema.repo` `ref` `path` | 기존 스키마를 `git -C repo show ref:path` 로 스냅샷 | 작업 트리가 아니라 ref 를 읽는다. 다른 브랜치에서 작업 중이어도 안전 |
| `existingSchema.fetch` | 스냅샷 전에 `git fetch` 할지 | |
| `db.preset` | `docs/db-presets.md` 의 이름 | 아래 명령들을 프리셋 값으로 채운다 |
| `db.schemaFile` | S3 가 만드는 **합본 스키마** 경로 | 기존 + 변경 + 신규. S6 이 이것을 검증한다 |
| `db.newOnlyFile` | 신규 모델만 담는 파일 | 리뷰용 |
| `db.validate` `fullSql` `deltaSql` | S6 이 실행할 명령 | `{schema}` `{existing}` 자리표시자를 쓴다. 표준출력이 SQL |
| `db.docker` | 일회용 검증 DB 컨테이너 | 기존 포트와 겹치지 않는 포트를 쓴다 |
| `db.dummyEnv` | validate 등에 필요한 가짜 환경변수 | **실제 접속 정보 금지** |
| `db.conventionsFrom` | `existing`(기존 스키마 관례를 따름) / `default` | |
| `ownership.me` | 이 결과를 쓸 사람(확정 등급의 주인) | `null` 이면 담당 구분 없이 전부 확정 |
| `ownership.members` | 다른 담당자들 | 이들의 영역은 `[예상]` 등급 |
| `ownership.rowColumn` | 명세서에서 담당을 나타내는 열 이름 | |
| `ownership.tableOwnerSource` | 테이블별 담당이 적힌 시트 | 있으면 행 단위 담당보다 우선 |
| `ownership.rule` | 담당 판정 원칙 | 예: 데이터 쓰기 주체 기준 |
| `screenPlan` | `none` / `draft` / `final` | `final` 이 아니면 변경 내성 원칙을 강하게 적용 |
| `outOfScope` | 하지 않을 것 | |
| `readOnly.priorWork` | 이전 시도 폴더 | 설계 단계는 열람 금지, S8 감사만 참고 |
| `engines` | 역할별 엔진: `default`, `boss`, `S0`~`S8` | 값은 `claude` / `codex` |
| `engineArgs` | 엔진별 추가 CLI 인자 | 헤드리스라서 권한 우회가 필요. 조직 정책에 맞게 조정 |
| `timeoutMinutes` | 에이전트 호출 1회의 타임아웃 | |
| `limits.maxPair` `maxTotal` | 같은 구간 / 전체 회귀 한도 | 넘으면 부장이 에스컬레이션 판단 |
| `git.commit` | 단계마다 커밋할지 | |
| `git.trailer` | 커밋 메시지 끝에 붙일 줄 | 예: `Co-Authored-By: ...` |
