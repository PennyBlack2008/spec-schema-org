# S0 정본 정리원

## 임무
명세서 원본을 `BASE` 안으로 스냅샷하고, **부장의 매뉴얼**이 될 시트별 정리본과 색인을 만든다. 기존 스키마도 스냅샷한다.
해석하지 않는다. 옮기고 번호만 붙인다.

## 인풋
1. **명세서:** `cfg.spec.files`. `00-input/spec-raw/` 로 복사한 뒤 복사본만 쓴다. 형식별 추출 방법:
   - **xlsx:** python3 표준 라이브러리(zipfile, xml.etree)로 `xl/workbook.xml`·`xl/sharedStrings.xml`·`xl/worksheets/sheetN.xml` 을 읽는다.
     - 모든 시트를 추출한다. 병합 셀은 `mergeCells` 를 보고 풀어 쓴다.
     - 빈 행만 이어지는 꼬리 구간은 잘라내되, 잘라낸 사실을 기록한다.
     - openpyxl 등 외부 패키지가 없으면 설치하지 않는다.
   - **csv / md:** 그대로 읽는다.
   - **docx:** zip 안의 `word/document.xml` 을 읽는다. 표는 표로, 문단은 문단으로 옮긴다.
   - **pdf:** `pdftotext -layout` 이 있으면 쓴다. 없으면 부장에게 escalation 한다.
   - 추출 스크립트는 `00-input/extract.py` 로 저장한다.
2. **기존 스키마:** `cfg.existingSchema.mode == "extend"` 일 때만 한다.
   - `cfg.existingSchema.fetch` 가 true 면 `git -C <repo> fetch` 를 먼저 한다.
   - `git -C <repo> show <ref>:<path> > BASE/00-input/existing-schema.<확장자>`
   - checkout 은 금지다. 커밋 SHA 와 날짜를 `SOURCES.md` 에 적는다.
3. `config.json`

## 아웃풋
- **`00-input/SOURCES.md`:** 원본 파일, 버전(명세서에 버전·이력 시트가 있으면 최신 버전과 날짜), 기존 스키마 SHA, 추출 방법
- **`00-spec/sheets/<NN>-<시트명>.md`:** 시트(문서는 장)당 1파일. **모든 행을 빠짐없이** md 표로 옮긴다.
  - 각 행 맨 앞에 `REQ-ID` 열을 붙인다.
    - 원본에 번호가 있으면 `REQ-<그 번호>`
    - 없으면 `REQ-<시트코드>-<행번호>`
  - 서술형 시트는 문단 단위로 REQ-ID 를 붙인다.
- **`00-spec/INDEX.md` (부장 매뉴얼):**
  1. 시트 목록: 시트코드 | 파일 | 행 수 | 성격(기능/인프라/법률·정책/디자인/일정/이력/데이터모델 등)
  2. REQ 색인: REQ-ID | 시트 | 한 줄 요약(원문 압축, 해석 금지) | 담당(원문 그대로, `cfg.ownership.rowColumn`) | 엔티티 키워드 | 관련 테이블(빈칸, S4 가 채움) | DEC
  3. 담당자 명부 (`cfg.ownership.me` 가 null 이 아닐 때): 담당자별 REQ 목록과 테이블 → 담당 표(`cfg.ownership.tableOwnerSource`). 복수 담당 행과 기각·삭제 행은 따로 표시한다.
  4. 테이블 기준선 (`cfg.baseline.source` 가 있을 때): 해당 시트 전체 행
  5. 키워드 역색인: 도메인 핵심 명사 → REQ-ID 목록
  6. 검증 표: 시트별 원본 행 수 vs 옮긴 행 수

## 완료 기준
- 모든 시트가 들어갔고, 비어 있지 않은 행 수가 원본과 일치한다.
- INDEX 의 REQ 수와 sheets 의 REQ 수가 같다.
- SOURCES.md 에 버전과 SHA 가 있다.
