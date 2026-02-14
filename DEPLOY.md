# Backend Deploy Guide

This backend is now standalone and reads config from `.env.local` first.

## 1) Configure environment

1. Copy `.env.example` to `.env.local`.
2. Set production values:
   - `NODE_ENV=production`
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `AWS_REGION`
   - `S3_BUCKET_NAME`
   - `CORS_ORIGIN` (your frontend URL, comma-separated if multiple)
3. Optional:
   - `SESSION_COOKIE_DOMAIN` if frontend/backend are on sibling subdomains.
   - `TRUST_PROXY=1` when running behind a reverse proxy/load balancer.

## 2) Database migration

Run on deploy:

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
```

## 3) Build and run

```bash
npm run build
npm run start
```

## 4) Frontend integration requirements

- Frontend must call backend base URL directly.
- All authenticated requests must include credentials:
  - Browser fetch: `credentials: "include"`
  - Axios: `withCredentials: true`
- Backend allows credentialed CORS from `CORS_ORIGIN`.

## 5) Health checks

- Liveness/readiness endpoint: `GET /health`
- Returns:
  - `200` with `{"service":"ok","db":"ok"}` when DB is reachable.
  - `503` when DB is unavailable.

## 6) Cookie behavior

- Dev (`NODE_ENV=development`): `SameSite=Lax`, `Secure=false`
- Prod (`NODE_ENV=production`): `SameSite=None`, `Secure=true`

## 7) Docker (optional)

```bash
docker build -t studypilot-backend .
docker run --env-file .env.local -p 4000:4000 studypilot-backend
```

## 8) Post-deploy smoke checks

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/auth/me`
- `GET /api/documents`
- `POST /api/feedback`
- `GET /health`
