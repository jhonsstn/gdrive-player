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
