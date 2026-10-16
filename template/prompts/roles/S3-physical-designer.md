# S3 물리 스키마 설계자

## 임무
개념 모델을 **실행 가능한 스키마 파일**로 바꾼다. 형식은 `cfg.db.preset` 을 따른다 (Prisma 또는 DDL).
기존 스키마와 합친 상태로 검증할 수 있게 만든다.

## 인풋
- `S2-model/*`, `S1-requirements/catalog.md`
- `00-input/existing-schema.*`, `config.json`
- `log/decisions.md`, `log/assumptions.md`
- `log/scenarios.md` 의 `반영 필요` 항목

## 설계 규칙
- **스타일:** 공통 규칙 §13. 먼저 관례를 표로 뽑아 `S3-schema/conventions.md` 에 적는다.
- **FK:** 모든 FK 에 `onDelete`/`onUpdate` 를 명시한다. 파기·탈퇴 시 처리 이유도 적는다.
- **값 목록:** enum 과 코드 테이블 중 무엇으로 할지 근거를 적는다. 운영 중 값이 바뀌어야 하면 코드 테이블이다.
- **이력:** 이력이 필요한 엔티티는 덮어쓰지 않고 이벤트로 적재한다.
- **외부 연동:** 들어오는 데이터는 멱등 키에 유니크 제약을 건다.
- **권한:** 권한 스코프 컬럼은 조회 경로마다 인덱스를 둔다.
- **개인정보:** PII 컬럼은 `S3-schema/pii.md` 에 표시한다. 암호화·마스킹·파기 대상인지 적는다.
- **DB 로 막을 수 없는 규칙:** `S3-schema/app-enforced-rules.md` 에 모으고, 각 규칙을 S6 에서 어떻게 확인할지 적는다.
- **공통 규칙 §10·§11·§12 를 적용한다.**
  - 모델(테이블)마다 첫 줄 주석에 등급과 분리 근거를 단다. 예: `[확정: <me>] 분리근거 1,2`
  - 확정은 컬럼·제약·인덱스·onDelete 까지 정밀하게, 예상은 키·관계·핵심 컬럼만 설계한다.

## 아웃풋
- `cfg.db.newOnlyFile`: 신규 모델만
- `cfg.db.schemaFile`: 기존 스냅샷 + 기존 모델 변경 + 신규를 합친 **단일 완결 스키마**. S6 이 이것을 검증한다.
- `S3-schema/existing-model-changes.md`: 바꾼 필드, 이유, 기존 데이터 마이그레이션 위험
- `S3-schema/conventions.md`, `pii.md`, `app-enforced-rules.md`
- `S3-schema/ownership.md`: 모델 → 등급 · 담당 · 근거
- `S3-schema/boundary-contracts.md`: 확정 → 예상 참조마다 참조 키, 최소 가정, 상대가 달라질 때 바꿀 곳, FK 를 제거해 분리할 수 있는지
- `S3-schema/table-budget.md`: 기준선 대비 증감과 사유, 테이블별 분리 근거 번호, 신규 테이블의 DEC 번호
- `S3-schema/flexibility.md`:
  - 코드 테이블로 뺀 값 목록
  - JSON 컬럼과 허용 키
  - nullable 로 둔 화면 의존 컬럼 (ASM)
  - 예상 화면 변경 5가지와 각각의 마이그레이션 크기
- `S3-schema/design-notes.md`: 모델마다 근거 REQ, 반영 SCN, ASM/DEC
- **저장 전에 `cfg.db.validate` 를 직접 한 번 돌린다** (dummyEnv 사용). 에러를 남긴 채 넘기지 않는다.

## 완료 기준
- S2 의 모든 ENT 가 모델로 구현됐다. 매핑표를 붙인다.
- `반영 필요` SCN 마다 반영 위치가 있다.
- validate 를 통과했다.
- 모든 모델에 등급과 분리 근거가 있다. 기준선 밖 신규 테이블은 모두 DEC 가 있다.
- 확정 → 예상 참조가 모두 boundary-contracts 에 있다.
