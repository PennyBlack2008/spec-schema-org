# DB 프리셋

`config.json` 의 `db` 를 아래 값으로 채운다.
- `<PRISMA>` 는 **기존 저장소에 설치된** prisma 바이너리다. 예: `<repo>/node_modules/.bin/prisma`
- 패키지를 새로 설치하거나 버전을 올리지 않는다.
- 기존 저장소가 없으면(standalone) 사용자에게 prisma 실행 경로를 물어본다.

## prisma-mysql
```json
"schemaFile": "S3-schema/merged.prisma",
"newOnlyFile": "S3-schema/new.prisma",
"validate": "<PRISMA> validate --schema {schema}",
"fullSql":  "<PRISMA> migrate diff --from-empty --to-schema-datamodel {schema} --script",
"deltaSql": "<PRISMA> migrate diff --from-schema-datamodel {existing} --to-schema-datamodel {schema} --script",
"docker": { "image": "mysql:8.0", "port": 3399, "env": { "MYSQL_ROOT_PASSWORD": "test", "MYSQL_DATABASE": "verify" } },
"dummyEnv": { "DATABASE_URL": "mysql://root:test@127.0.0.1:3399/verify" }
```
적용 명령 (S6): `docker exec -i <컨테이너> mysql -uroot -ptest verify < full.sql`

## prisma-postgres
```json
"schemaFile": "S3-schema/merged.prisma",
"newOnlyFile": "S3-schema/new.prisma",
"validate": "<PRISMA> validate --schema {schema}",
"fullSql":  "<PRISMA> migrate diff --from-empty --to-schema-datamodel {schema} --script",
"deltaSql": "<PRISMA> migrate diff --from-schema-datamodel {existing} --to-schema-datamodel {schema} --script",
"docker": { "image": "postgres:16", "port": 5499, "env": { "POSTGRES_PASSWORD": "test", "POSTGRES_DB": "verify" } },
"dummyEnv": { "DATABASE_URL": "postgresql://postgres:test@127.0.0.1:5499/verify" }
```
적용 명령 (S6): `docker exec -i <컨테이너> psql -U postgres -d verify -v ON_ERROR_STOP=1 < full.sql`

## sql-mysql / sql-postgres (ORM 없이 DDL)
```json
"schemaFile": "S3-schema/merged.sql",
"newOnlyFile": "S3-schema/new.sql",
"validate": null,
"fullSql": "cat {schema}",
"deltaSql": null
```
- validate 는 "빈 DB 에 적용 성공"으로 대신한다.
- deltaSql 은 S3 가 `S3-schema/delta.sql` 로 직접 작성한다.
- docker 설정은 위 mysql / postgres 프리셋의 것을 쓴다.

## 기타 ORM (drizzle, typeorm 등)
위 형식에 맞춰 `validate`·`fullSql` 명령을 직접 정한다. 조건은 둘이다.
- `fullSql` 의 표준출력이 빈 DB 에 그대로 적용할 수 있는 SQL 이어야 한다.
- 실행에 DB 접속이 필요한 명령은 `dummyEnv` 와 일회용 컨테이너만 써야 한다.
