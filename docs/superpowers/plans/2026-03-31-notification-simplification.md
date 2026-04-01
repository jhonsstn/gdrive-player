# Notification Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-threshold notification system (UserNotificationBaseline + UserFolderLastSeen) with a single `lastSeenDate` threshold that auto-clears "New" when the user enters a folder.

**Architecture:** Drop `UserNotificationBaseline` entirely. `UserFolderLastSeen.lastSeenDate` is set to the folder's latest video modifiedTime on folder entry. The `GET /api/folders/has-new` endpoint gains a `hasUnwatched` field (derived from WatchProgress). The notification bell uses this same endpoint instead of the separate notifications API. Per-video NEW/NOT SEEN badges are removed from the playlist.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, React 19, Prisma 7 + better-sqlite3, SWR, Vitest.

---

### Task 1: Drop UserNotificationBaseline from Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`
- Run migration

- [ ] **Step 1: Remove the model from schema.prisma**

Open `prisma/schema.prisma`. Delete the entire `UserNotificationBaseline` model block:

```prisma
// DELETE this entire block:
model UserNotificationBaseline {
  id          Int      @id @default(autoincrement())
  userEmail   String
  folderId    String
  baselineDate DateTime
  updatedAt   DateTime @updatedAt

  @@unique([userEmail, folderId])
}
```

Save the file.

- [ ] **Step 2: Run the migration**

```bash
pnpm prisma migrate dev --name drop-notification-baseline
```

Expected output: `The following migration(s) have been applied: .../drop-notification-baseline`

- [ ] **Step 3: Regenerate the Prisma client**

```bash
pnpm prisma generate
```

Expected output: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "chore: drop UserNotificationBaseline table from schema"
```

---

### Task 2: Extend GET /api/folders/has-new to return hasUnwatched

**Files:**
- Modify: `src/app/api/folders/has-new/route.ts`
- Modify: `src/app/api/folders/has-new/route.test.ts`

- [ ] **Step 1: Write failing tests for hasUnwatched**

Open `src/app/api/folders/has-new/route.test.ts`. Add a `watchProgress` mock to the existing mock setup, and add the new test cases at the end of the describe block:

Replace the top of the file (mocks + vi.mock blocks) with:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  watchProgressFindMany: vi.fn(),
  getLatestVideoModifiedTime: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    userFolderLastSeen: {
      findMany: mocks.findMany,
    },
    watchProgress: {
      findMany: mocks.watchProgressFindMany,
    },
  },
}));

vi.mock("@/lib/drive", () => ({
  getLatestVideoModifiedTime: mocks.getLatestVideoModifiedTime,
}));

import { GET } from "@/app/api/folders/has-new/route";
```

Then update `beforeEach` to also clear `watchProgressFindMany` and add a default empty return:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  mocks.watchProgressFindMany.mockResolvedValue([]);
});
```

Add these new test cases at the end of the describe block (before the closing `}`):

```typescript
  it("returns hasUnwatched=true when folder has in-progress videos", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([
      { folderId: "f1", lastSeenDate: new Date("2024-12-01T00:00:00Z") },
    ]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");
    mocks.watchProgressFindMany.mockResolvedValue([{ folderId: "f1" }]);

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.hasNew).toEqual({ f1: false });
    expect(data.hasUnwatched).toEqual({ f1: true });
  });

  it("returns hasUnwatched=false when no in-progress videos", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([
      { folderId: "f1", lastSeenDate: new Date("2024-12-01T00:00:00Z") },
    ]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");
    mocks.watchProgressFindMany.mockResolvedValue([]);

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.hasUnwatched).toEqual({ f1: false });
  });

  it("returns hasUnwatched in response for all existing tests (smoke check)", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data).toHaveProperty("hasUnwatched");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/app/api/folders/has-new/route.test.ts
```

Expected: FAIL — `hasUnwatched` is not in the response yet.

- [ ] **Step 3: Implement hasUnwatched in the route**

Replace `src/app/api/folders/has-new/route.ts` with:

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getLatestVideoModifiedTime } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderIdsParam = searchParams.get("folderIds");
  if (!folderIdsParam) {
    return NextResponse.json({ error: "Missing folderIds" }, { status: 400 });
  }

  const folderIds = folderIdsParam.split(",").filter(Boolean);
  const userEmail = session.user.email;
  const accessToken = session.accessToken;

  const [rows, unwatchedRows] = await Promise.all([
    db.userFolderLastSeen.findMany({
      where: { userEmail, folderId: { in: folderIds } },
    }),
    db.watchProgress.findMany({
      where: { userEmail, folderId: { in: folderIds }, watched: false },
      select: { folderId: true },
      distinct: ["folderId"],
    }),
  ]);

  const lastSeenMap = new Map(rows.map((r) => [r.folderId, r.lastSeenDate]));
  const unwatchedFolderIds = new Set(
    unwatchedRows.map((r) => r.folderId).filter((id): id is string => id !== null),
  );

  const results = await Promise.all(
    folderIds.map(async (folderId) => {
      try {
        const latestTime = await getLatestVideoModifiedTime(accessToken, folderId);
        if (!latestTime) return [folderId, false] as const;

        const lastSeen = lastSeenMap.get(folderId);
        if (!lastSeen) return [folderId, true] as const;

        return [folderId, new Date(latestTime) > lastSeen] as const;
      } catch {
        return [folderId, false] as const;
      }
    }),
  );

  const hasNew: Record<string, boolean> = Object.fromEntries(results);
  const hasUnwatched: Record<string, boolean> = Object.fromEntries(
    folderIds.map((folderId) => [folderId, unwatchedFolderIds.has(folderId)]),
  );

  return NextResponse.json({ hasNew, hasUnwatched });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/app/api/folders/has-new/route.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/folders/has-new/route.ts src/app/api/folders/has-new/route.test.ts
git commit -m "feat: extend has-new endpoint to return hasUnwatched per folder"
```

---

### Task 3: Remove last-seen update from PUT /api/progress

**Files:**
- Modify: `src/app/api/progress/route.ts`
- Modify: `src/app/api/progress/route.test.ts` (if it tests the last-seen update)

- [ ] **Step 1: Check existing progress route tests**

```bash
pnpm test src/app/api/progress/route.test.ts
```

Expected: All currently passing.

- [ ] **Step 2: Remove the lastSeen upsert block from PUT /api/progress**

Open `src/app/api/progress/route.ts`. Delete lines 83–114 (the `if (watched && folderId && videoModifiedTime)` block that upserts `UserFolderLastSeen`). Also remove `videoModifiedTime` from the destructured `body` since it's no longer used in this route.

The PUT handler should end after the `watchProgress.upsert` call:

```typescript
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const videoIds = searchParams.get("videoIds");
  if (!videoIds) {
    return NextResponse.json({ error: "Missing videoIds" }, { status: 400 });
  }

  const ids = videoIds.split(",").filter(Boolean);
  const rows = await db.watchProgress.findMany({
    where: { userEmail: session.user.email, videoId: { in: ids } },
  });

  const progress: Record<string, { currentTime: number; duration: number; watched: boolean }> = {};
  for (const row of rows) {
    progress[row.videoId] = {
      currentTime: row.currentTime,
      duration: row.duration,
      watched: row.watched,
    };
  }

  return NextResponse.json({ progress }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { videoId, currentTime, duration, folderId, videoName } = body as {
    videoId?: string;
    currentTime?: number;
    duration?: number;
    folderId?: string;
    videoName?: string;
  };

  if (!videoId || currentTime == null || !duration || duration <= 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const watched = currentTime / duration >= 0.9;

  await db.watchProgress.upsert({
    where: {
      userEmail_videoId: {
        userEmail: session.user.email,
        videoId,
      },
    },
    create: {
      userEmail: session.user.email,
      videoId,
      currentTime,
      duration,
      watched,
      folderId: folderId ?? null,
      videoName: videoName ?? null,
    },
    update: {
      currentTime,
      duration,
      watched,
      ...(folderId ? { folderId } : {}),
      ...(videoName ? { videoName } : {}),
    },
  });

  return NextResponse.json({ ok: true, watched });
}

// sendBeacon only sends POST requests
export { PUT as POST };
```

- [ ] **Step 3: Run tests**

```bash
pnpm test src/app/api/progress/route.test.ts
```

Expected: All tests PASS (any test that checked for lastSeen upsert side-effect can be removed — verify and delete those assertions if present).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/progress/route.ts src/app/api/progress/route.test.ts
git commit -m "refactor: remove lastSeen upsert from progress route — folder entry handles it now"
```

---

### Task 4: Simplify useWatchProgress — remove isNew, isNotSeen, baselines

**Files:**
- Modify: `src/hooks/useWatchProgress.ts`

- [ ] **Step 1: Rewrite useWatchProgress.ts**

Replace the entire file with the simplified version:

```typescript
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { useWatchProgressBatch, invalidateAfterProgressUpdate } from "@/hooks/api";

export type VideoMeta = Record<string, { folderId: string; modifiedTime: string | null; name: string }>;

const FLUSH_INTERVAL_MS = 5_000;
const WATCHED_THRESHOLD = 0.9;
const EMPTY_PROGRESS: Record<string, { currentTime: number; duration: number; watched: boolean }> = {};

export function useWatchProgress(videoIds: string[], videoMeta: VideoMeta) {
  const { data: progressData, mutate: mutateProgress } = useWatchProgressBatch(videoIds);
  const progressMap = useMemo(() => progressData?.progress ?? EMPTY_PROGRESS, [progressData]);

  const bufferRef = useRef<{
    videoId: string;
    currentTime: number;
    duration: number;
    folderId?: string;
    videoName?: string;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushBuffer = useCallback(async () => {
    const buf = bufferRef.current;
    if (!buf) return;

    const { videoId, currentTime, duration, folderId, videoName } = buf;
    bufferRef.current = null;

    const watched = duration > 0 && currentTime / duration >= WATCHED_THRESHOLD;

    // Optimistically update local SWR cache
    void mutateProgress(
      (prev) => {
        if (!prev) return prev;
        return {
          progress: {
            ...prev.progress,
            [videoId]: { currentTime, duration, watched },
          },
        };
      },
      { revalidate: false },
    );

    try {
      await fetch("/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, currentTime, duration, folderId, videoName }),
      });

      invalidateAfterProgressUpdate();
    } catch {
      // Silently ignore — the optimistic update still holds
    }
  }, [mutateProgress]);

  // Periodic flush
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void flushBuffer();
    }, FLUSH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [flushBuffer]);

  // beforeunload — sendBeacon for reliable save on tab close
  useEffect(() => {
    function handleBeforeUnload() {
      const buf = bufferRef.current;
      if (!buf) return;
      navigator.sendBeacon(
        "/api/progress",
        new Blob([JSON.stringify(buf)], { type: "application/json" }),
      );
      bufferRef.current = null;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const recordTime = useCallback(
    (videoId: string, currentTime: number, duration: number) => {
      const meta = videoMeta[videoId];
      bufferRef.current = {
        videoId,
        currentTime,
        duration,
        folderId: meta?.folderId,
        videoName: meta?.name,
      };
    },
    [videoMeta],
  );

  const flush = useCallback(() => {
    void flushBuffer();
  }, [flushBuffer]);

  const getInitialTime = useCallback(
    (videoId: string): number => {
      const entry = progressMap[videoId];
      if (!entry) return 0;
      if (entry.watched) return 0;
      return entry.currentTime;
    },
    [progressMap],
  );

  const isWatched = useCallback(
    (videoId: string): boolean => {
      return progressMap[videoId]?.watched ?? false;
    },
    [progressMap],
  );

  return { recordTime, flush, getInitialTime, isWatched };
}
```

- [ ] **Step 2: Run typecheck to catch any consumers that still use isNew/isNotSeen**

```bash
pnpm typecheck 2>&1 | head -40
```

Expected: Errors in `PlayerClient.tsx` referencing `isNew` and `isNotSeen`. These will be fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWatchProgress.ts
git commit -m "refactor: remove isNew, isNotSeen, baselines from useWatchProgress"
```

---

### Task 5: Remove isNew/isNotSeen from PlaylistPanel

**Files:**
- Modify: `src/components/player/PlaylistPanel.tsx`

- [ ] **Step 1: Remove isNew/isNotSeen props and badge logic from PlaylistPanel**

Replace `src/components/player/PlaylistPanel.tsx` with:

```typescript
"use client";

import { useEffect, useRef } from "react";

import { parseEpisodeName } from "@/lib/episode-name";

type PlaylistVideo = {
  id: string;
  name: string;
  mimeType: string;
  sourceUrl: string;
  folderId: string;
};

type PlaylistPanelProps = {
  videos: PlaylistVideo[];
  currentVideoId: string | null;
  onSelect: (videoId: string) => void;
  isWatched?: (videoId: string) => boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
};

export function PlaylistPanel({
  videos,
  currentVideoId,
  onSelect,
  isWatched,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: PlaylistPanelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, isLoadingMore]);

  return (
    <div className="w-full">
      <aside className="no-scrollbar flex max-h-[60vh] flex-col rounded-xl border border-zinc-800 bg-zinc-900 py-4 shadow-sm lg:h-[calc(100vh-12rem)] lg:max-h-none">
        <div className="mb-4 px-6">
          <h3 className="text-base font-semibold text-zinc-400">Playlist</h3>
        </div>

        {videos.length === 0 ? <p className="px-6 text-zinc-400">No videos available.</p> : null}

        <div className="flex-1 overflow-y-auto px-4">
          <div className="flex flex-col gap-2">
            {videos.map((video, index) => {
              const active = video.id === currentVideoId;
              const watched = isWatched?.(video.id) ?? false;

              return (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => onSelect(video.id)}
                  className={`group flex w-full min-h-[48px] cursor-pointer items-center gap-4 rounded-xl border-none p-3 sm:p-4 text-left transition-all duration-300 ${
                    active
                      ? "bg-zinc-800 shadow-md"
                      : "bg-transparent hover:bg-zinc-800/80"
                  }`}
                >
                  <div className={`flex shrink-0 items-center justify-center tabular-nums text-xl font-bold tracking-tight transition-colors duration-300 ${
                    active ? "text-blue-500" : "text-zinc-700 group-hover:text-zinc-500"
                  }`}>
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <span className={`block truncate font-semibold transition-colors duration-300 ${
                      active ? "text-blue-500" : "text-zinc-100 group-hover:text-white"
                    }`}>
                      {parseEpisodeName(video.name)}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-3 pl-2">
                    {active && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-blue-500">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    )}
                    {watched && !active ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-emerald-500/50"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="py-3 text-center text-xs text-zinc-500">
              {isLoadingMore ? "Loading…" : ""}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/player/PlaylistPanel.tsx
git commit -m "refactor: remove NEW/NOT SEEN per-video badges from PlaylistPanel"
```

---

### Task 6: Update PlayerClient — remove isNew/isNotSeen, add folder-entry lastSeen effect

**Files:**
- Modify: `src/app/player/PlayerClient.tsx`

- [ ] **Step 1: Update PlayerClient.tsx**

Replace `src/app/player/PlayerClient.tsx` with:

```typescript
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mutate as globalMutate } from "swr";

import { AppHeader } from "@/components/AppHeader";
import { PlaylistPanel } from "@/components/player/PlaylistPanel";
import { VideoPlayerPane } from "@/components/player/VideoPlayerPane";
import { useWatchProgress, type VideoMeta } from "@/hooks/useWatchProgress";
import { SortButton } from "@/components/ui/SortButton";
import { useVideos } from "@/hooks/api";

type SortDirection = "asc" | "desc";

type PlayerClientProps = {
  folderId: string;
  folderName?: string | null;
  userImage?: string | null;
  userName?: string | null;
  isAdmin?: boolean;
  initialVideoId?: string;
};

export function PlayerClient({
  folderId,
  folderName,
  userImage,
  userName,
  isAdmin = false,
  initialVideoId,
}: PlayerClientProps) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const {
    videos,
    isLoading,
    error,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useVideos(folderId, sortDirection);

  const statusMessage = error
    ? "Failed to load videos"
    : !isLoading && videos.length === 0
      ? "No videos found."
      : null;

  // Derive effective video ID synchronously — no useEffect gap
  const currentVideoId = useMemo(() => {
    if (videos.length === 0) return null;
    if (selectedVideoId && videos.some((v) => v.id === selectedVideoId)) return selectedVideoId;
    if (initialVideoId && videos.some((v) => v.id === initialVideoId)) return initialVideoId;
    return videos[0]?.id ?? null;
  }, [videos, selectedVideoId, initialVideoId]);

  const videoIds = useMemo(() => videos.map((v) => v.id), [videos]);

  const videoMeta: VideoMeta = useMemo(() => {
    const meta: VideoMeta = {};
    for (const v of videos) {
      meta[v.id] = { folderId: v.folderId, modifiedTime: v.modifiedTime, name: v.name };
    }
    return meta;
  }, [videos]);

  const { recordTime, flush, getInitialTime, isWatched } = useWatchProgress(
    videoIds,
    videoMeta,
  );

  // On folder entry: set lastSeenDate to latest video modifiedTime
  // This clears the "New" badge for this folder
  const latestVideoTime = useMemo(() => {
    if (videos.length === 0) return null;
    return videos.reduce<string | null>((latest, v) => {
      if (!v.modifiedTime) return latest;
      if (!latest || v.modifiedTime > latest) return v.modifiedTime;
      return latest;
    }, null);
  }, [videos]);

  const hasUpdatedLastSeen = useRef(false);
  useEffect(() => {
    if (!latestVideoTime || hasUpdatedLastSeen.current) return;
    hasUpdatedLastSeen.current = true;

    void fetch("/api/progress/last-seen", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ folderId, videoModifiedTime: latestVideoTime }),
    });

    // Revalidate has-new cache so bell count updates
    void globalMutate(
      (key: unknown) =>
        typeof key === "string" && key.startsWith("/api/folders/has-new"),
      undefined,
      { revalidate: true },
    );
  }, [folderId, latestVideoTime]);

  const currentIndex = useMemo(
    () => videos.findIndex((video) => video.id === currentVideoId),
    [currentVideoId, videos],
  );

  const currentVideo = currentIndex >= 0 ? videos[currentIndex] : null;

  function goNext() {
    if (currentIndex < 0 || currentIndex >= videos.length - 1) {
      return;
    }

    flush();
    setSelectedVideoId(videos[currentIndex + 1]?.id ?? null);
  }

  function goPrevious() {
    if (currentIndex <= 0) {
      return;
    }

    flush();
    setSelectedVideoId(videos[currentIndex - 1]?.id ?? null);
  }

  function handleSelect(videoId: string) {
    flush();
    setSelectedVideoId(videoId);
  }

  function handleTimeUpdate(currentTime: number, duration: number) {
    if (currentVideo) {
      recordTime(currentVideo.id, currentTime, duration);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader userImage={userImage} userName={userName} showAdminLink={isAdmin} />

      <main className="mx-auto w-full max-w-[1366px] flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{folderName ?? "My Videos"}</h2>
          <SortButton
            direction={sortDirection}
            onToggle={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
          />
        </div>

        {statusMessage ? (
          <div className="mb-6 rounded-md border border-zinc-800 bg-zinc-900 p-4 text-center text-zinc-400">
            {statusMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(320px,420px)_1fr] lg:items-start xl:grid-cols-[minmax(360px,480px)_1fr]">
            <div className="flex h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 px-4 py-3">
                <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
              </div>
              <div className="flex-1 overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b border-zinc-800/50 px-4 py-3"
                  >
                    <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-zinc-800" />
                    <div className="h-3 flex-1 animate-pulse rounded bg-zinc-800" />
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="flex gap-2 border-b border-zinc-800 px-4 py-3">
                <div className="h-7 w-16 animate-pulse rounded bg-zinc-800" />
                <div className="h-7 w-16 animate-pulse rounded bg-zinc-800" />
              </div>
              <div className="h-125 min-h-100 bg-black" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(320px,420px)_1fr] lg:items-start xl:grid-cols-[minmax(360px,480px)_1fr]">
            <PlaylistPanel
              videos={videos}
              currentVideoId={currentVideoId}
              onSelect={handleSelect}
              isWatched={isWatched}
              hasMore={hasMore}
              onLoadMore={loadMore}
              isLoadingMore={isLoadingMore}
            />
            <div className="order-first lg:order-none">
              <VideoPlayerPane
                video={currentVideo}
                canGoPrevious={currentIndex >= 0 && currentIndex < videos.length - 1}
                canGoNext={currentIndex > 0}
                onPrevious={goNext}
                onNext={goPrevious}
                initialTime={currentVideo ? getInitialTime(currentVideo.id) : undefined}
                onTimeUpdate={handleTimeUpdate}
                onEnded={goPrevious}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | head -40
```

Expected: Errors only in files not yet updated (AppHeader, FolderSelectionClient). No errors in PlayerClient or PlaylistPanel.

- [ ] **Step 3: Commit**

```bash
git add src/app/player/PlayerClient.tsx
git commit -m "feat: set lastSeenDate on folder entry to auto-clear New notification"
```

---

### Task 7: Update hooks/api.ts — remove notification hooks, update useFoldersHasNew type

**Files:**
- Modify: `src/hooks/api.ts`

- [ ] **Step 1: Update hooks/api.ts**

Replace `src/hooks/api.ts` with:

```typescript
import useSWR, { mutate as globalMutate } from "swr";
import useSWRInfinite from "swr/infinite";

type Folder = {
  id: string;
  folderId: string;
  name: string | null;
};

type ContinueWatchingItem = {
  videoId: string;
  videoName: string | null;
  folderId: string;
  currentTime: number;
  duration: number;
  updatedAt: string;
};

type PlayerVideo = {
  id: string;
  name: string;
  mimeType: string;
  sourceUrl: string;
  folderId: string;
  modifiedTime: string | null;
};

type ProgressEntry = {
  currentTime: number;
  duration: number;
  watched: boolean;
};

type SortDirection = "asc" | "desc";

// ── Folders ──

export function useFolders() {
  return useSWR<{ folders: Folder[] }>("/api/folders", {
    dedupingInterval: 5 * 60 * 1000,
  });
}

// ── Has New (Drive API — revalidate on focus) ──

export function useFoldersHasNew(folderIds: string[]) {
  const key = folderIds.length > 0
    ? `/api/folders/has-new?folderIds=${folderIds.join(",")}`
    : null;

  return useSWR<{ hasNew: Record<string, boolean>; hasUnwatched: Record<string, boolean> }>(key, {
    dedupingInterval: 60 * 1000,
    revalidateOnFocus: true,
  });
}

// ── Continue Watching ──

export function useContinueWatching() {
  return useSWR<{ items: ContinueWatchingItem[] }>("/api/progress/continue-watching", {
    dedupingInterval: 30 * 1000,
    revalidateOnFocus: true,
  });
}

// ── Videos (paginated via useSWRInfinite) ──

export function useVideos(folderId: string, sort: SortDirection) {
  const { data, error, isLoading, size, setSize, isValidating } = useSWRInfinite<{
    videos: PlayerVideo[];
    sort: SortDirection;
    nextPageToken?: string;
  }>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.nextPageToken) return null;

      const params = new URLSearchParams({ sort, folderId });

      if (previousPageData?.nextPageToken) {
        params.set("pageToken", previousPageData.nextPageToken);
      }

      return `/api/videos?${params.toString()}`;
    },
    {
      dedupingInterval: 2 * 60 * 1000,
      revalidateFirstPage: false,
    },
  );

  const videos = data ? data.flatMap((page) => page.videos) : [];
  const hasMore = data ? !!data[data.length - 1]?.nextPageToken : false;
  const isLoadingMore = size > 0 && data && typeof data[size - 1] === "undefined" && isValidating;

  return {
    videos,
    isLoading,
    error,
    hasMore,
    isLoadingMore: !!isLoadingMore,
    loadMore: () => setSize(size + 1),
  };
}

// ── Watch Progress (batch) ──

export function useWatchProgressBatch(videoIds: string[]) {
  const key = videoIds.length > 0
    ? `/api/progress?videoIds=${videoIds.join(",")}`
    : null;

  return useSWR<{ progress: Record<string, ProgressEntry> }>(key, {
    dedupingInterval: 30 * 1000,
  });
}

// ── Cache Invalidation ──

export function invalidateAfterProgressUpdate() {
  void globalMutate(
    (key: unknown) =>
      typeof key === "string" &&
      (key.startsWith("/api/progress/continue-watching") ||
        key.startsWith("/api/folders/has-new")),
    undefined,
    { revalidate: true },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/api.ts
git commit -m "refactor: remove notification hooks from api.ts, update useFoldersHasNew type"
```

---

### Task 8: Update NotificationPanel — remove newCount

**Files:**
- Modify: `src/components/NotificationPanel.tsx`

- [ ] **Step 1: Update NotificationPanel.tsx**

Replace `src/components/NotificationPanel.tsx` with:

```typescript
"use client";

import { useRouter } from "next/navigation";

type NewFolder = {
  folderId: string;
  folderName: string;
};

type NotificationPanelProps = {
  folders: NewFolder[];
  onClear: (folderId: string) => void;
  onClearAll: () => void;
};

export function NotificationPanel({ folders, onClear, onClearAll }: NotificationPanelProps) {
  const router = useRouter();

  if (folders.length === 0) {
    return (
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
        <div className="px-4 py-6 text-center text-sm text-zinc-500">
          No new updates
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <span className="text-sm font-medium text-zinc-300">Notifications</span>
        <button
          type="button"
          onClick={onClearAll}
          className="cursor-pointer text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Clear all
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {folders.map((folder) => (
          <div
            key={folder.folderId}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/60"
          >
            <button
              type="button"
              onClick={() => {
                onClear(folder.folderId);
                router.push(`/player/${folder.folderId}`);
              }}
              className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 border-none bg-transparent p-0 text-left"
            >
              <span className="truncate text-sm font-medium text-zinc-200">
                {folder.folderName}
              </span>
              <span className="text-xs text-amber-500/70">New content</span>
            </button>
            <button
              type="button"
              onClick={() => onClear(folder.folderId)}
              className="cursor-pointer rounded p-1 text-zinc-600 opacity-0 transition-all hover:bg-zinc-700 hover:text-zinc-300 group-hover:opacity-100"
              aria-label={`Dismiss notification for ${folder.folderName}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NotificationPanel.tsx
git commit -m "refactor: simplify NotificationPanel — remove newCount, use folder list"
```

---

### Task 9: Update AppHeader — replace useNotifications with useFolders + useFoldersHasNew

**Files:**
- Modify: `src/components/AppHeader.tsx`

- [ ] **Step 1: Update AppHeader.tsx**

Replace `src/components/AppHeader.tsx` with:

```typescript
"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useFolders, useFoldersHasNew } from "@/hooks/api";
import { NotificationPanel } from "@/components/NotificationPanel";

type AppHeaderProps = {
  userImage?: string | null;
  userName?: string | null;
  showAdminLink?: boolean;
};

export function AppHeader({ userImage, userName, showAdminLink = false }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: foldersData } = useFolders();
  const folders = useMemo(() => foldersData?.folders ?? [], [foldersData]);
  const folderIds = useMemo(() => folders.map((f) => f.folderId), [folders]);

  const { data: hasNewData, mutate: mutateHasNew } = useFoldersHasNew(folderIds);

  const newFolders = useMemo(() => {
    if (!hasNewData?.hasNew) return [];
    return folders.filter((f) => hasNewData.hasNew[f.folderId]);
  }, [folders, hasNewData]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }

    if (menuOpen || notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen, notifOpen]);

  function handleClear(folderId: string) {
    // Optimistically remove from new list
    void mutateHasNew(
      (prev) => {
        if (!prev) return prev;
        return { ...prev, hasNew: { ...prev.hasNew, [folderId]: false } };
      },
      { revalidate: false },
    );

    // Update server — use current time so it's always newer than any video
    void fetch("/api/progress/last-seen", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ folderId, videoModifiedTime: new Date().toISOString() }),
    });

    setNotifOpen(false);
  }

  function handleClearAll() {
    const allNewFolderIds = newFolders.map((f) => f.folderId);

    void mutateHasNew(
      (prev) => {
        if (!prev) return prev;
        const updated = { ...prev.hasNew };
        for (const id of allNewFolderIds) updated[id] = false;
        return { ...prev, hasNew: updated };
      },
      { revalidate: false },
    );

    const now = new Date().toISOString();
    for (const folderId of allNewFolderIds) {
      void fetch("/api/progress/last-seen", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId, videoModifiedTime: now }),
      });
    }

    setNotifOpen(false);
  }

  const notifFolders = newFolders.map((f) => ({
    folderId: f.folderId,
    folderName: f.name ?? f.folderId,
  }));

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-8 py-4">
      <div className="flex items-center gap-3 overflow-hidden">
        <Link
          href="/player"
          className="gradient-logo flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white shadow-[0_2px_10px_rgba(59,130,246,0.3)] transition-transform hover:scale-105"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </Link>
        <Link href="/player" className="truncate text-lg font-semibold tracking-tight transition-colors hover:text-blue-400 sm:text-xl">
          GDrivePlayer
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {showAdminLink ? (
          <Link
            href="/config"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Admin settings"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </Link>
        ) : null}

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {newFolders.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-zinc-900">
                {newFolders.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <NotificationPanel
              folders={notifFolders}
              onClear={handleClear}
              onClearAll={handleClearAll}
            />
          )}
        </div>

        <div className="relative h-8 w-8" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label="User menu"
            aria-expanded={menuOpen}
          >
            {userImage ? (
              <Image
                src={userImage}
                alt={userName ?? "User avatar"}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full border border-zinc-700 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-500"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
            )}
          </button>

          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
              {userName ? (
                <div className="truncate border-b border-zinc-800 px-4 py-2 text-sm text-zinc-400">
                  {userName}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AppHeader.tsx
git commit -m "feat: AppHeader uses has-new endpoint for notification bell, replaces notifications API"
```

---

### Task 10: Update FolderSelectionClient — use single has-new endpoint for both badges

**Files:**
- Modify: `src/app/player/FolderSelectionClient.tsx`

- [ ] **Step 1: Update FolderSelectionClient.tsx**

Replace the import line and the two data hooks near the top. Change:

```typescript
import { useFolders, useFoldersHasNew, useContinueWatching, useNotifications } from "@/hooks/api";
```

To:

```typescript
import { useFolders, useFoldersHasNew, useContinueWatching } from "@/hooks/api";
```

Then replace the `hasNewData` block and `notifData` block (lines 30–44 in the original) with:

```typescript
  const { data: hasNewData } = useFoldersHasNew(folderIds);

  const newFolderIds = useMemo(() => {
    if (!hasNewData?.hasNew) return new Set<string>();
    return new Set(
      Object.entries(hasNewData.hasNew)
        .filter(([, v]) => v)
        .map(([k]) => k),
    );
  }, [hasNewData]);

  const notSeenFolderIds = useMemo(() => {
    if (!hasNewData?.hasUnwatched) return new Set<string>();
    return new Set(
      Object.entries(hasNewData.hasUnwatched)
        .filter(([, v]) => v)
        .map(([k]) => k),
    );
  }, [hasNewData]);
```

Remove the `useNotifications` call and the `newFolderIds` block derived from `notifData`.

The folder badge render (lines 209–213) already uses `newFolderIds` and `notSeenFolderIds` correctly, so no changes needed there.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | head -40
```

Expected: Clean (no errors referencing removed hooks).

- [ ] **Step 3: Commit**

```bash
git add src/app/player/FolderSelectionClient.tsx
git commit -m "refactor: FolderSelectionClient uses single has-new endpoint for New and Not seen badges"
```

---

### Task 11: Delete notification API routes and dead code

**Files:**
- Delete: `src/app/api/notifications/route.ts`
- Delete: `src/app/api/notifications/clear/route.ts`
- Delete: `src/app/api/notifications/baselines/route.ts`
- Modify: `src/lib/drive.ts` (remove `countVideosSince`)

- [ ] **Step 1: Delete the notification route files**

```bash
rm src/app/api/notifications/route.ts
rm src/app/api/notifications/clear/route.ts
rm src/app/api/notifications/baselines/route.ts
rmdir src/app/api/notifications/clear src/app/api/notifications/baselines src/app/api/notifications 2>/dev/null || true
```

- [ ] **Step 2: Remove countVideosSince from drive.ts**

Open `src/lib/drive.ts`. Find and delete the `countVideosSince` function entirely. It was only called from the now-deleted notifications route.

- [ ] **Step 3: Run typecheck and tests**

```bash
pnpm typecheck 2>&1 | head -40
pnpm test
```

Expected: No type errors. All tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete notification API routes and remove unused countVideosSince"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: No errors.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Manual smoke test checklist**

Verify in the browser (dev server `pnpm dev`):

1. Open app fresh — bell shows count of folders with new content
2. Click a folder — bell count decreases for that folder immediately (SWR revalidates)
3. Re-open app — folder no longer shows "New" badge
4. Watch a video 90%+ in a folder — folder shows "Not seen" badge if it had in-progress videos
5. "Clear all" in notification panel — bell goes to 0, all New badges clear
6. Per-folder "Clear" X button — removes that folder from notification panel

- [ ] **Step 6: Final commit if any lint fixes were needed**

```bash
git add -A
git commit -m "fix: address any lint issues from final verification"
```
