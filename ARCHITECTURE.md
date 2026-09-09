# Architecture — QA Control Center

## Goal

Turn existing QA matrices, evidence, defects and reports into structured, traceable, filterable information. The app is a control center, not a file viewer.

## High-level

```
Frontend (React + Vite)  →  API (Fastify)  →  Services  →  Prisma  →  PostgreSQL
                                      ↓
                               Parsers (xlsx/csv/pdf/docx/json)
                                      ↓
                          Preview + duplicate detection
                                      ↓
                                 Commit to DB
```

## Packages

| Path | Role |
| --- | --- |
| `apps/web` | SPA: dashboards, tables, import UI, dark/light |
| `apps/api` | REST API, auth, parsers, business rules |
| `packages/shared` | Enums and DTO shapes shared conceptually |

Business logic lives in API services, not React components.

## Layers (API)

1. **Routes** — HTTP, authz, Zod validation
2. **Services** — dashboard aggregation, import pipeline, coverage, search
3. **Parsers** — adaptive structure detection, never invent fields
4. **Repositories** — Prisma only
5. **PostgreSQL** — source of truth

## Auth and security

- JWT Bearer tokens
- Roles: `ADMIN`, `QA_MANAGER`, `QA`, `VIEWER`
- Helmet headers, CORS from env, rate limit, Zod input validation
- Secrets only in environment variables (Vercel / Railway / `.env`)
- Audit log for imports and defect status changes

## Google Drive

Daily sync at 06:00 America/Bogota on the API process (`node-cron`), with an optional HTTP tick for GitHub Actions.

OAuth 2.0 refresh tokens are stored encrypted (`DriveConnection`). Users never enter a Google password. The import pipeline still blocks auto-commit on duplicates and `Copia de` filenames.

See [DEPLOYMENT.md](DEPLOYMENT.md).

## Deployment

- Frontend → Vercel
- API + PostgreSQL → Railway
- Health: `GET /health`

See [DEPLOYMENT.md](DEPLOYMENT.md).
