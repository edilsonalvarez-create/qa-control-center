# Deployment

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

## Google Drive (later)

Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` only in Railway. Never commit them. Users authenticate with Google OAuth, not by pasting a password.

## Health

`GET /health` returns `{ status, version, database }`. Railway and uptime checks should use this path.
