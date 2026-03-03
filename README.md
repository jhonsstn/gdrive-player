# Google Drive Video Player

Next.js app for browsing and streaming videos from configured Google Drive folders.

## Features

- Google OAuth sign-in
- Admin-only folder configuration (`/config`)
- Aggregated video list from multiple Drive folders (`/player`)
- Natural sort toggle (asc/desc)
- Server-side streaming proxy with HTTP Range support (`/api/stream/[fileId]`)
- SQLite + Prisma persistence for configured folders

## Prerequisites

- Node.js 20+
- npm
- Google Cloud project with OAuth credentials

## 1) Configure Google OAuth

1. Create/select a Google Cloud project.
2. Configure OAuth consent screen.
3. Create OAuth Client ID credentials (Web application).
4. Add this redirect URI:
   - `http://localhost:3000/api/auth/callback/google`
5. Copy the generated client ID and client secret.

## 2) Configure environment variables

Copy the example file:

```bash
cp .env.example .env
```

Set values in `.env`:

- `DATABASE_URL` (default: `file:./dev.db`)
- `AUTH_SECRET` (long random string)
- `AUTH_GOOGLE_ID` (Google OAuth client ID)
- `AUTH_GOOGLE_SECRET` (Google OAuth client secret)
- `ADMIN_EMAILS` (comma-separated admin email allowlist, e.g. `admin@example.com,ops@example.com`)

## 3) Install dependencies

```bash
npm install
```

## 4) Initialize database (Prisma + SQLite)

For first local setup:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

For normal development after pulling new migrations:

```bash
npx prisma migrate dev
```

## 5) Start the app

```bash
npm run dev
```

Open:

- `http://localhost:3000/player` for playback
- `http://localhost:3000/config` for admin folder management

## Authentication and admin behavior

- Any user must sign in with Google before using protected routes/APIs.
- Only emails listed in `ADMIN_EMAILS` can create/delete configured folders.
- Non-admin users can access player features but cannot edit folder config.

## Useful commands

```bash
npm run lint
npm run typecheck
npm run test
```
