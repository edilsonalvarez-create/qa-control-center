# Data model

PostgreSQL via Prisma. Uncertain values are stored as `Unknown` or `Requires review`, never guessed.

## Core entities

- **User** — email, role, password hash
- **Project** — name, client, product (HORUS Health when applicable), status
- **Module** — belongs to a project
- **Requirement** — optional; many start as Unknown
- **TestRun** — execution of a suite/matrix (counts, env, tester, version, commit, fingerprint)
- **TestCase** — row inside a run
- **Defect** — linked to case/run/project/module; severity + workflow status
- **Evidence** — reference to original file/URL (do not duplicate binaries by default)
- **Release** — version/commit/environment
- **QaReport** — weekly/monthly/narrative source document
- **SourceFile** — Drive or upload metadata + content hash
- **ImportJob** — upload → parse → preview → commit
- **DuplicateCandidate** — suggested consolidation, never auto-merged
- **DataConflict** — contradictory facts between sources
- **AuditLog** — who changed what

## Defect statuses

`OPEN`, `IN_PROGRESS`, `FIXED`, `READY_FOR_RETEST`, `RETEST_FAILED`, `CLOSED`, `REOPENED`

## Coverage status (computed)

| Status | Meaning |
| --- | --- |
| `stable` | Tests exist, last run not failing |
| `observations` | Tests exist with blocked/skipped or open non-critical defects |
| `failing` | Last run has FAIL or critical/high open defects |
| `untested` | Module catalogued, no runs |

## Traceability

`Requirement → Module → TestCase → TestRun → Result → Defect → Evidence → Retest → Final result`

## Duplicate fingerprint

Normalized concatenation of project, module, case title, execution date, version. Source file hash distinguishes copies of the same Excel (`Copia de ...`).
