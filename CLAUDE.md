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
| `/player` | Authenticated | Folder selection + "Continue Watching" landing |
| `/player/[folderId]` | Authenticated | Browse and play videos in a specific folder |
| `/config` | Admin only | Manage configured Drive folders |
| `/api/auth/[...nextauth]` | Public | NextAuth handler |
| `/api/config/folders` | Admin | GET/POST/DELETE folder config (with name) |
| `/api/folders` | Authenticated | GET list of configured folders (id, folderId, name) |
| `/api/folders/has-new` | Authenticated | Check if any folder has unwatched new videos |
| `/api/videos` | Authenticated | Aggregated video list from configured folders |
| `/api/stream/[fileId]` | Authenticated | Proxy Drive video with Range support |
| `/api/progress` | Authenticated | GET batch watch progress; PUT/POST upsert progress |
| `/api/progress/last-seen` | Authenticated | GET/PUT per-folder last-seen timestamps |
| `/api/progress/continue-watching` | Authenticated | GET in-progress (unwatched) videos across folders |

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

SQLite via better-sqlite3 adapter. Prisma client is a singleton on `globalThis` to survive HMR. Models:

- `ConfiguredFolder` — id, folderId (unique), name (optional), sourceUrl, createdAt, updatedAt
- `WatchProgress` — userEmail + videoId (unique pair), currentTime, duration, watched, folderId, videoName, updatedAt. A video is considered watched when `currentTime / duration >= 0.9`.
- `UserFolderLastSeen` — userEmail + folderId (unique pair), lastSeenDate, updatedAt. Tracks the most recent `modifiedTime` of a watched video per folder, used to compute "NEW" badges.

### Google Drive Integration (`src/lib/drive.ts`)

`listFolderVideos()` paginates Drive API v3 (up to 1000/page), filtering by MIME types in `video-mime.ts`. `streamDriveFile()` proxies media downloads forwarding Range headers. `drive-url.ts` parses folder IDs from URLs or raw IDs.

### Watch Progress (`src/hooks/useWatchProgress.ts`)

Client-side hook used in the player. Buffers time updates in a ref and flushes to `/api/progress` every 5 seconds. On tab close, uses `navigator.sendBeacon` for a reliable final save (this is why `PUT` is aliased to `POST` on the progress route). Provides `recordTime`, `flush`, `getInitialTime`, `isWatched`, and `isNew`. "New" is computed by comparing a video's `modifiedTime` against `UserFolderLastSeen.lastSeenDate`.

### Utilities

- `src/lib/episode-name.ts` — `parseEpisodeName()` strips fansub brackets from filenames like `[Group][Show Name] - Episode 42.mp4` → `Show Name - 42`. Falls back to filename without extension.
- `src/lib/sort.ts` — video sorting logic used in the playlist.

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

## Design Context

### Users
Personal and family use — people watching their own Google Drive videos at home, in a relaxed, leisure context. The job to be done is simple: find the video and watch it with zero friction. There's no onboarding complexity; users already know what they want to watch.

### Brand Personality
**Clean, focused, effortless.** The interface should feel like it disappears — a quiet frame around the content, never competing with it. Calm confidence, not flash.

### Aesthetic Direction
- **Reference**: Mubi and Letterboxd — curated, editorial, slightly artsy dark aesthetic. Considered typography, restrained color, content-first layouts.
- **Anti-references**: Avoid the busy, badge-heavy look of Netflix or Plex. No aggressive CTAs, no metadata overload.
- **Theme**: Dark only. The zinc palette (zinc-950 base, zinc-900 panels) is established and correct — lean into it.
- **Color**: Blue accent (#3b82f6) for the one primary action; everything else recedes into neutrals. Amber/emerald status accents used sparingly and meaningfully.
- **Typography**: Inter or Geist — neutral, slightly editorial, consistent cross-platform. Tight tracking on headings, generous line-height on body. Restrained over expressive.
- **Motion**: Simple, tasteful. Subtle transitions (200–300ms) that feel smooth, not performative. No motion for motion's sake. `prefers-reduced-motion` is not enforced — transitions run always.

### Accessibility
- Best-effort: keyboard navigation, sufficient color contrast, screen reader basics (aria-labels on icon-only buttons, focusable controls, visible focus rings).
- No formal WCAG standard enforced.

### Upcoming Surfaces
- **Notification center**: In-app alerts/badges for new content. Should feel understated — never alarming. Use the existing amber accent for "new" signals. Panel should be overlay-style, not a full page, consistent with the quiet confidence of the rest of the UI.

### Design Principles

1. **Content is the hero.** The video player and thumbnails should dominate. Chrome (nav, controls, labels) recedes — visible when needed, invisible otherwise.

2. **One path, no detours.** Minimize clicks between login and playback. Layouts should be scannable at a glance with clear visual hierarchy.

3. **Quiet confidence.** Avoid decorative elements that don't carry meaning. Every color, shadow, and spacing choice should earn its place.

4. **Effortless state.** Loading, empty, and error states should feel calm — skeleton loaders, muted tones, no alarming red walls of text.

5. **Editorial restraint.** Prefer whitespace over density. Let items breathe. Align with the Mubi/Letterboxd sensibility: a few things presented beautifully beats many things crammed in.
