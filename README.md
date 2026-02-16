# StudyPilot Backend

Standalone backend API for StudyPilot.

## Features

- Email/password auth with DB-backed sessions
- Document upload + private file retrieval
- AI question answering and study resources
- Feedback submission
- Prisma + PostgreSQL

## API Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/signout`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/upload`
- `GET /api/documents`
- `DELETE /api/documents/:id`
- `GET /api/documents/:id/file`
- `POST /api/ask`
- `POST /api/ask-highlight`
- `POST /api/resources`
- `POST /api/feedback`
- `GET /api/ai/config`
- `PATCH /api/ai/config`
- `DELETE /api/ai/config/key`
- `GET /health`

## Quick Start

1. Install dependencies:
   - `npm install`
2. Configure environment:
   - Copy `.env.example` to `.env.local`
   - Fill required values
3. Prisma setup:
   - `npm run prisma:generate`
   - `npm run prisma:migrate:deploy`
4. Run locally:
   - `npm run dev`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run typecheck`
- `npm run lint`

## Deploy

See `DEPLOY.md` for production deployment steps.
