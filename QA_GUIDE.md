# QA Guide — testing this application

## What must be true before calling a feature done

Implementation, validation, tests, error handling, and evidence it works.

## Test layers

| Layer | Command | Covers |
| --- | --- | --- |
| Parser unit | `npm test` | Header detection, metric regex, fingerprints, no invented fields |
| API | `npm test --workspace=@qacc/api` | Health, auth guards, import preview |
| Manual | Import Center | Upload a real `Matriz_QA_*.xlsx` from Drive |

## Parser fixtures

`apps/api/tests/fixtures/` uses **generic headers** that match real matrix naming (`ID`, `Caso`, `Resultado`, `Módulo`). Rows are labeled `FIXTURE` and are **not** HORUS/SUMIMEDICAL results.

## Import quality rules

1. Never auto-commit when duplicates are detected — show preview.
2. If a field cannot be parsed with confidence, store `Unknown` or `Requires review`.
3. Conflicting numbers between two reports create a `DataConflict`, not a silent overwrite.
4. `Copia de ...` files must surface as duplicate candidates.

## Suggested regression for the control center

1. Login as VIEWER — cannot import.
2. Login as QA — can upload, cannot manage users.
3. Upload the same CSV twice — second preview lists duplicates.
4. Commit once — dashboard KPIs match the file, not demo numbers.
5. Open a FAIL case — defect + evidence link + original URL.
6. Coverage matrix colors: untested modules from seed stay ⚫ until a run exists.

## Security checks

- Unauthenticated `/api/v1/dashboard` → 401
- SQL / XSS payloads in search → rejected or sanitized
- Rate limit on `/api/v1/auth/login`
- `.env` is gitignored; `.env.example` has no production secrets
