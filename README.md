# QA Control Center

**Live**

- App: https://qa-control-center-ten.vercel.app
- API: https://api-production-f1d3.up.railway.app
- Health: https://api-production-f1d3.up.railway.app/health
- Repo: https://github.com/edilsonalvarez-create/qa-control-center

Enterprise console for **what QA tested, when, with what result, which defects remain open, and which original evidence supports each finding**.

This repository is **not** QA Guardian (the diagnostic engine in `Andres`). It is a new product.

## What it answers

- What has QA tested, on which module, with which type of test?
- How many cases passed, failed, blocked, or skipped?
- Which defects are open or critical?
- What evidence exists, without duplicating Drive files?
- Which modules still have no coverage?

## Stack

| Layer | Tech |
| --- | --- |
| Web | React, Vite, TypeScript, Tailwind |
| API | Node.js, Fastify, TypeScript |
| DB | PostgreSQL + Prisma |
| Hosting | Vercel (web) + Railway (API/DB) |

## Quick start

```bash
cp .env.example .env
docker compose up --build postgres -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

Open http://localhost:5173 — log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

Seed loads **only** the catalog discovered in Drive (projects, modules, source file references). It does **not** invent PASS/FAIL counts. Import a real `Matriz_QA_*.xlsx` via Import Center to populate KPIs.

## Documentation

- [docs/QA_DATA_DISCOVERY.md](docs/QA_DATA_DISCOVERY.md) — files, projects, duplicates, gaps
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATA_MODEL.md](DATA_MODEL.md)
- [QA_GUIDE.md](QA_GUIDE.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)

## Environment variables

See [.env.example](.env.example). Never commit `.env`.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Liveness + DB ping |
| POST | `/api/v1/auth/login` | JWT |
| GET | `/api/v1/dashboard` | KPIs + series (filters as query) |
| GET | `/api/v1/test-runs` | List + filters |
| GET | `/api/v1/test-runs/:id` | Traceability chain |
| GET | `/api/v1/defects` | Defect board |
| GET | `/api/v1/coverage` | Module matrix |
| GET | `/api/v1/search?q=` | Global search |
| POST | `/api/v1/import/upload` | Parse + preview (no auto-commit on duplicates) |
| POST | `/api/v1/import/:id/commit` | Persist after preview |

## Google Drive

MVP uses **manual upload**. Original `source_url` / `source_file_id` are stored when provided. OAuth is designed for a later phase — never paste a Google password into this app.

Drive corpus: [pruebas qa](https://drive.google.com/drive/folders/1hCe3QBPraJEvt6H60KcCOiNIFzG6zdL-).

## Testing

```bash
npm test
```

## License

Private — Sumimedical / QA operations use.
