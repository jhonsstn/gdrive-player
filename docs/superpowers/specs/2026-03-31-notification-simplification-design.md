# Notification System Simplification

## Problem

The current notification system uses two separate thresholds per folder:

- `UserNotificationBaseline` — controls "NEW" badges, only cleared by explicit user action (clicking "Clear")
- `UserFolderLastSeen` — controls "NOT SEEN" badges, auto-updated when watching videos

This means watching all new episodes in a folder does not clear the "NEW" notification. Users must manually clear notifications, which feels broken.

## Design

Collapse to a **single threshold** (`UserFolderLastSeen.lastSeenDate`) plus **watch status** (`WatchProgress.watched`).

### Two folder-level states

| State | Condition | Badge | Where shown |
|-------|-----------|-------|-------------|
| **New** | Folder has videos with `modifiedTime > lastSeenDate` | Amber "New" | Folder list, notification bell |
| **Not seen** | Folder has unwatched videos, but no new content | Amber "Not seen" | Folder list only |

"New" takes priority over "Not seen" — a folder shows one or the other, never both.

**Inside a folder's video list**, only a watched checkmark is shown. No per-video "NEW" or "NOT SEEN" badges.

### When `lastSeenDate` updates

1. **On folder entry** — navigating to `/player/[folderId]` sets `lastSeenDate` to the folder's latest video `modifiedTime`. This is the primary mechanism that clears "New" status.
2. **On "Clear all"** — bulk convenience from the notification panel. Updates `lastSeenDate` for all folders with new content.
3. **On per-folder "Clear"** — from the notification panel, same as entering the folder.
4. **First visit** — if no `lastSeenDate` record exists, set it to the latest video time on first entry (prevents all videos appearing as "New" on first use).

`lastSeenDate` is **no longer updated on video watch**. Watching only updates `WatchProgress`.

### Notification bell

The bell count = number of folders where `hasNew: true`, derived from the `GET /api/folders/has-new` endpoint.

## API Changes

### Keep as-is

- `GET /api/progress` — batch watch progress
- `GET /api/folders` — folder list
- `GET /api/videos` — video list
- `GET /api/progress/last-seen` — returns lastSeenDate per folder
- `PUT /api/progress/last-seen` — upserts lastSeenDate (caller changes, endpoint stays same)

### Modify

- **`PUT /api/progress`** — remove the redundant `UserFolderLastSeen` update that currently runs on watch (lines 83-114 in current code). Watching a video only updates `WatchProgress`.
- **`GET /api/folders/has-new`** — extend response to include `hasUnwatched` per folder. Query `WatchProgress` to check if any video in the folder lacks a `watched: true` record. Response becomes `{ folderId: { hasNew: boolean, hasUnwatched: boolean } }`.

### Remove

- `GET /api/notifications` — replaced by `GET /api/folders/has-new`
- `PUT /api/notifications/clear` — replaced by `PUT /api/progress/last-seen`
- `GET /api/notifications/baselines` — no longer needed

## UI Changes

### Folder list (`FolderSelectionClient.tsx`)

- "New" badge: folder has `hasNew: true`
- "Not seen" badge: folder has `hasUnwatched: true` but `hasNew: false`
- Data comes from the extended `GET /api/folders/has-new` endpoint

### Notification bell (`AppHeader.tsx`)

- Count from `has-new` endpoint (count of folders with `hasNew: true`)
- Replace `useNotifications` hook with `useFoldersHasNew`
- "Clear all" calls `PUT /api/progress/last-seen` for each new folder

### Notification panel (`NotificationPanel.tsx`)

- Shows folders with new content from `has-new` data
- Per-folder "Clear" calls `PUT /api/progress/last-seen`
- Clicking a folder navigates to it (entry clears it)

### Playlist (`PlaylistPanel.tsx`)

- Remove "NEW" and "NOT SEEN" per-video badges
- Keep only watched checkmark

### Folder page (`/player/[folderId]`)

- On mount, call `PUT /api/progress/last-seen` with the folder's latest video `modifiedTime`
- Mutate the `has-new` SWR cache so the bell count updates immediately

## Data Model Changes

### Drop table

- `UserNotificationBaseline` — Prisma migration to remove

### Keep unchanged

- `UserFolderLastSeen` — single threshold, updated on folder entry
- `WatchProgress` — unchanged

## Hook Changes

### `useWatchProgress.ts`

- Remove: `videoMeta`, `baselinesMap`, `isNew`, `isNotSeen`, `useNotificationBaselines` fetch
- Remove: `lastSeen` update logic from flush (no longer updates on watch)
- Keep: `recordTime`, `flush`, `getInitialTime`, `isWatched`

### `src/hooks/api.ts`

- Remove: `useNotifications`, `useNotificationBaselines`
- Keep: `useFoldersHasNew` (extend to consume new response shape)

## Files to Delete

- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/clear/route.ts`
- `src/app/api/notifications/baselines/route.ts`

## Dead Code to Remove

- `countVideosSince()` from `src/lib/drive.ts`
- Baseline-related hooks from `src/hooks/api.ts`

## Testing

- Update existing tests for modified endpoints
- Key flow: enter folder -> "NEW" clears -> watch videos -> "NOT SEEN" clears
- First-visit baseline creation
- "Clear all" from notification panel
- Bell count accuracy after folder entry
