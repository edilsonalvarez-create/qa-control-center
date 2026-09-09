# Deployment

## Live (production)

| Layer | URL | Git |
| --- | --- | --- |
| Frontend (Vercel) | https://qa-control-center-ten.vercel.app | Auto-deploys from GitHub on `edilsonalvarez-create` (team CAMPUS) |
| API (Railway) | https://api-production-f1d3.up.railway.app | Auto-deploys from `edilsonalvarez-create/qa-control-center` branch `master` |
| Health | https://api-production-f1d3.up.railway.app/health | |

Login (seed admin): `admin@qacc.local` / `ChangeMeNow!` — change immediately.

GitHub repo: https://github.com/edilsonalvarez-create/qa-control-center

## Topology

```
GitHub  →  Vercel   →  apps/web
GitHub  →  Railway  →  apps/api + PostgreSQL
```

Do not put passwords, tokens, or OAuth secrets in the repository.

## Local (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:5173 (or nginx on 3100 if using the web container)
- API: http://localhost:8080
- Health: http://localhost:8080/health
- Postgres: localhost:5432

Seed catalog (projects/modules/source files only, no fake metrics):

```bash
npm run db:seed
```

Default admin comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Change it immediately.

## Railway (API + Postgres)

1. New project → add PostgreSQL plugin.
2. New service from this GitHub repo. Root directory: `apps/api` **or** set build to workspace.
3. Environment:

```
NODE_ENV=production
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<long random>
CORS_ORIGINS=https://<your-vercel-app>.vercel.app
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

4. Build: `npm install && npm run prisma:generate && npm run build`
5. Release: `npx prisma migrate deploy && npm run prisma:seed`
6. Start: `npm start`
7. Confirm `GET https://<api>/health`

If the monorepo root is the Railway service, set:

```
npm install
npx prisma generate --schema=apps/api/prisma/schema.prisma
npm run build --workspace=@qacc/api
```

## Vercel (frontend)

1. Import the GitHub repo.
2. Root directory: `apps/web`
3. Framework: Vite
4. Env: `VITE_API_URL=https://<railway-api>.up.railway.app`
5. Build: `npm install && npm run build`
6. Output: `dist`

`vercel.json` is included under `apps/web` for SPA rewrites.

## CORS and cookies

Production `CORS_ORIGINS` must be the exact Vercel origin (no trailing slash). JWT is sent as `Authorization: Bearer`.

## Google Drive (daily sync)

The **Railway API** (not Vercel) lists and downloads Drive files. Schedule: `0 6 * * *` in `America/Bogota`.

1. Google Cloud Console → APIs → enable **Google Drive API**.
2. Credentials → OAuth client **Web application**.
3. Authorized redirect URI (production):
   `https://api-production-f1d3.up.railway.app/api/v1/integrations/google/callback`
4. Railway API variables:

```
FRONTEND_URL=https://qa-control-center-ten.vercel.app
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://api-production-f1d3.up.railway.app/api/v1/integrations/google/callback
GOOGLE_DRIVE_FOLDER_ID=1hCe3QBPraJEvt6H60KcCOiNIFzG6zdL-
DRIVE_SYNC_CRON=0 6 * * *
DRIVE_SYNC_TZ=America/Bogota
CRON_SECRET=<random>
```

5. Open the live app → Settings → **Conectar Google Drive** with an account that can read the folder.

The daily job runs inside the Railway API (`node-cron` at 06:00 America/Bogota). Never commit client secrets. Never paste a Google password into the app.

Unattended alternatives (Railway only): `GOOGLE_REFRESH_TOKEN` or `GOOGLE_SERVICE_ACCOUNT_JSON` (share the folder with the service account email).

If Workspace blocks creating Google Cloud projects, use **Google Apps Script** instead (`scripts/drive-sync.gs`): it runs as your Google user, lists the QA folder, and POSTs new files to `/api/v1/integrations/google/ingest` with `CRON_SECRET`. Set the script timezone to America/Bogota and a daily trigger at 6:00.

## Health

`GET /health` returns `{ status, version, database }`. Railway and uptime checks should use this path.
