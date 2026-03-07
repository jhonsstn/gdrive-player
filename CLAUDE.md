# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**gdrive-player** is a Next.js 16 web app for browsing and streaming Google Drive videos. Users authenticate via Google OAuth, admins configure Drive folders, and the server proxies video streaming with HTTP Range support.

## Commands

```bash
pnpm dev          # Dev server (Turbopack)
pnpm build        # Production build
pnpm start        # Production server
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest (all *.test.ts)
pnpm test:watch   # Vitest watch mode
```

### Prisma

```bash
pnpm prisma migrate dev --name <name>   # Create/apply migration
pnpm prisma generate                    # Regenerate client
```

## Tech Stack

Next.js 16 (App Router), TypeScript strict, React 19, next-auth v5 (Google OAuth), SQLite via Prisma 7 + `@prisma/adapter-better-sqlite3`, Zod 4 for env validation, Vitest 4, pnpm.

## Architecture

### Routing (no middleware — auth guards live in each page/route)

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Login; redirects authed users to `/player` |
| `/player` | Authenticated | Video browse & playback |
| `/config` | Admin only | Manage configured Drive folders |
| `/api/auth/[...nextauth]` | Public | NextAuth handler |
| `/api/config/folders` | Admin | GET/POST/DELETE folder config |
| `/api/videos` | Authenticated | Aggregated video list from configured folders |
| `/api/stream/[fileId]` | Authenticated | Proxy Drive video with Range support |

All pages use `export const dynamic = "force-dynamic"`.

### Server vs Client Components

Pages (`page.tsx`) are server components that call `auth()` and handle redirects. Interactive UI lives in `*Client.tsx` or `components/` files marked `"use client"`. Data passes as serialisable props (dates as ISO strings).

### Auth (`src/auth.ts`, `src/lib/authz.ts`)

next-auth v5 with Google OAuth. The `drive.readonly` scope access token is stored in the JWT and exposed on the session. Admin access is controlled by `ADMIN_EMAILS` env var (comma-separated, case-insensitive). API routes follow:

```ts
const session = await auth();
if (!session?.user?.email) return 401;
if (!isAdminSession(session)) return 403;  // admin-only routes
```

### Database

SQLite via better-sqlite3 adapter. Single model: `ConfiguredFolder` (id, folderId, sourceUrl, createdAt, updatedAt). Prisma client is a singleton on `globalThis` to survive HMR.

### Google Drive Integration (`src/lib/drive.ts`)

`listFolderVideos()` paginates Drive API v3 (up to 1000/page), filtering by MIME types in `video-mime.ts`. `streamDriveFile()` proxies media downloads forwarding Range headers. `drive-url.ts` parses folder IDs from URLs or raw IDs.

### Styling

Dark theme via CSS custom properties in `globals.css` — no UI library. Key tokens: `--bg-primary` (#09090b), `--accent-primary` (#3b82f6).

## Testing Patterns

Tests use Vitest in `node` environment. API route tests follow this pattern:
1. `vi.hoisted()` to declare mocks before imports
2. `vi.mock("@/auth", ...)`, `vi.mock("@/lib/db", ...)` to isolate handlers
3. Call exported handler directly with `new Request(...)`

## Environment Variables

Validated by Zod in `src/lib/env.ts`. See `.env.example`:

- `DATABASE_URL` — SQLite path (`file:./dev.db`)
- `AUTH_SECRET` — NextAuth secret
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth credentials
- `ADMIN_EMAILS` — Comma-separated admin emails

## Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json and vitest.config.ts).
