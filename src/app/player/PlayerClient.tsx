"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mutate as globalMutate } from "swr";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { PlaylistPanel } from "@/components/player/PlaylistPanel";
import { VideoPlayerPane } from "@/components/player/VideoPlayerPane";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { useWatchProgress, type VideoMeta } from "@/hooks/useWatchProgress";
import { SortButton } from "@/components/ui/SortButton";
import { useVideos, invalidateAfterProgressUpdate } from "@/hooks/api";

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
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isMarkingVideo, setIsMarkingVideo] = useState(false);

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
      meta[v.id] = { folderVideoId: v.folderVideoId };
    }
    return meta;
  }, [videos]);

  const { recordTime, flush, getInitialTime, isWatched, mutateProgress } = useWatchProgress(
    videoIds,
    videoMeta,
  );

  async function handleToggleWatched(videoId: string, watched: boolean) {
    if (isMarkingVideo) return;
    
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    const folderVideoId = video.folderVideoId;
    if (!folderVideoId) {
      toast.error("Video not synced yet. Sync the folder first.");
      return;
    }

    setIsMarkingVideo(true);

    const promise = (async () => {
      // 1. Optimistic update
      void mutateProgress(
        (prev: { progress: Record<string, { currentTime: number; duration: number; watched: boolean }> } | undefined) => ({
          progress: {
            ...(prev?.progress ?? {}),
            [folderVideoId]: { currentTime: watched ? 1 : 0, duration: 1, watched },
          },
        }),
        { revalidate: false },
      );

      // 2. Server update
      const res = await fetch("/api/progress/mark", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderVideoId, watched }),
      });

      if (!res.ok) {
        await mutateProgress();
        throw new Error("Failed to update");
      }

      // 3. Revalidate
      await invalidateAfterProgressUpdate(folderId);

      return res;
    })();

    toast.promise(promise, {
      loading: watched ? "Marking as watched..." : "Marking as unwatched...",
      success: watched ? "Marked as watched" : "Marked as unwatched",
      error: "Failed to update video",
      finally: () => setIsMarkingVideo(false),
    });
  }

  async function handleMarkRange(videoId: string, direction: "above" | "below", watched: boolean) {
    if (isMarkingVideo) return;

    const video = videos.find((v) => v.id === videoId);
    if (!video?.folderVideoId) return;

    setIsMarkingVideo(true);

    const promise = (async () => {
      // 1. Optimistic update for loaded videos
      const idx = videos.findIndex((v) => v.id === videoId);
      const loadedSlice = direction === "above" ? videos.slice(0, idx) : videos.slice(idx + 1);
      const loadedFolderVideoIds = loadedSlice.map((v) => v.folderVideoId).filter((id): id is string => id !== null);

      if (loadedFolderVideoIds.length > 0) {
        const optimisticProgress: Record<string, { currentTime: number; duration: number; watched: boolean }> = {};
        for (const fvid of loadedFolderVideoIds) {
          optimisticProgress[fvid] = { currentTime: watched ? 1 : 0, duration: 1, watched };
        }
        void mutateProgress(
          (prev: { progress: Record<string, { currentTime: number; duration: number; watched: boolean }> } | undefined) => ({
            progress: { ...(prev?.progress ?? {}), ...optimisticProgress },
          }),
          { revalidate: false },
        );
      }

      // 2. Server resolves the full range (all folder videos, not just loaded pages)
      const res = await fetch("/api/progress/mark-range", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          anchorFolderVideoId: video.folderVideoId,
          direction,
          watched,
          sort: sortDirection,
        }),
      });

      if (!res.ok) {
        await mutateProgress();
        throw new Error("Failed to update");
      }

      const data = await res.json() as { markedCount: number };

      // 3. Revalidate to pick up all server-side changes
      await invalidateAfterProgressUpdate(folderId);

      return data;
    })();

    toast.promise(promise, {
      loading: watched ? "Marking videos as watched…" : "Marking videos as unwatched…",
      success: (data) => {
        const label = data.markedCount === 1 ? "1 video" : `${data.markedCount} videos`;
        return watched ? `${label} marked as watched` : `${label} marked as unwatched`;
      },
      error: "Failed to update videos",
      finally: () => setIsMarkingVideo(false),
    });
  }

  async function handleMarkAll(watched: boolean) {
    if (isMarkingAll) return;

    setIsMarkingAll(true);

    const promise = (async () => {
      // 1. Optimistic update of local SWR cache for immediate UI feedback
      const optimisticProgress: Record<string, { currentTime: number; duration: number; watched: boolean }> = {};
      for (const video of videos) {
        if (video.folderVideoId) {
          optimisticProgress[video.folderVideoId] = {
            currentTime: watched ? 1 : 0,
            duration: 1,
            watched,
          };
        }
      }

      void mutateProgress(
        (prev: { progress: Record<string, { currentTime: number; duration: number; watched: boolean }> } | undefined) => ({
          progress: { ...(prev?.progress ?? {}), ...optimisticProgress },
        }),
        { revalidate: false },
      );

      // 2. Perform the server update
      const res = await fetch("/api/progress/mark-all", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId, watched }),
      });

      if (!res.ok) {
        // Revalidate to restore correct state on error
        await mutateProgress();
        throw new Error("Failed to update");
      }

      // 3. Wait for all caches to revalidate to ensure UI is in sync with server
      await invalidateAfterProgressUpdate(folderId);

      return res;
    })();

    toast.promise(promise, {
      loading: watched ? "Marking all as watched..." : "Marking all as unwatched...",
      success: watched ? "All videos marked as watched" : "All videos marked as unwatched",
      error: "Failed to update videos",
      finally: () => setIsMarkingAll(false),
    });
  }

  // On folder entry: set lastSeenDate to latest video modifiedTime.
  // This clears the "New" badge for this folder.
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

    // Revalidate has-new cache so bell count updates (no data clear — keep existing values visible during re-fetch)
    void globalMutate(
      (key: unknown) =>
        typeof key === "string" && key.startsWith("/api/folders/has-new"),
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
          <div className="flex items-center gap-3">
            <DropdownMenu
              trigger={
                <div className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-zinc-800 text-zinc-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="1.5"></circle>
                    <circle cx="12" cy="6" r="1.5"></circle>
                    <circle cx="12" cy="18" r="1.5"></circle>
                  </svg>
                </div>
              }
              items={[
                {
                  label: isMarkingAll ? "Marking…" : "Mark all as watched",
                  onClick: () => { if (!isMarkingAll) void handleMarkAll(true); },
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                },
                {
                  label: isMarkingAll ? "Marking…" : "Mark all as unwatched",
                  onClick: () => { if (!isMarkingAll) void handleMarkAll(false); },
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                }
              ]}
              align="left"
            />
            <h2 className="text-xl font-semibold tracking-tight">{folderName ?? "My Videos"}</h2>
          </div>
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
              onToggleWatched={handleToggleWatched}
              onMarkAbove={(videoId, watched) => void handleMarkRange(videoId, "above", watched)}
              onMarkBelow={(videoId, watched) => void handleMarkRange(videoId, "below", watched)}
              isMarkingVideo={isMarkingVideo}
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
                isWatched={currentVideo ? isWatched(currentVideo.id) : false}
                onToggleWatched={(watched) => {
                  if (currentVideo) handleToggleWatched(currentVideo.id, watched);
                }}
                onMarkAbove={(watched) => {
                  if (currentVideo) void handleMarkRange(currentVideo.id, "above", watched);
                }}
                onMarkBelow={(watched) => {
                  if (currentVideo) void handleMarkRange(currentVideo.id, "below", watched);
                }}
                canMarkAbove={currentIndex > 0}
                canMarkBelow={currentIndex >= 0 && currentIndex < videos.length - 1}
                isMarkingVideo={isMarkingVideo}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
