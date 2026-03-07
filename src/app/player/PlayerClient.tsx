"use client";

import { useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { PlaylistPanel } from "@/components/player/PlaylistPanel";
import { VideoPlayerPane } from "@/components/player/VideoPlayerPane";
import { useWatchProgress, type VideoMeta } from "@/hooks/useWatchProgress";

type SortDirection = "asc" | "desc";

type PlayerVideo = {
  id: string;
  name: string;
  mimeType: string;
  sourceUrl: string;
  folderId: string;
  modifiedTime: string | null;
};

type VideosApiResponse = {
  videos: PlayerVideo[];
  sort: SortDirection;
  nextPageToken?: string;
  error?: string;
};

type PlayerClientProps = {
  folderId: string;
  folderName?: string | null;
  userImage?: string | null;
  userName?: string | null;
  isAdmin?: boolean;
};

export function PlayerClient({
  folderId,
  folderName,
  userImage,
  userName,
  isAdmin = false,
}: PlayerClientProps) {
  const [videos, setVideos] = useState<PlayerVideo[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadVideos() {
      setIsLoading(true);
      setNextPageToken(undefined);

      const response = await fetch(
        `/api/videos?sort=${sortDirection}&folderId=${encodeURIComponent(folderId)}`,
      );
      const payload = (await response.json()) as VideosApiResponse;

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setVideos([]);
        setCurrentVideoId(null);
        setIsLoading(false);
        setStatusMessage(payload.error ?? "Failed to load videos");
        return;
      }

      setVideos(payload.videos);
      setNextPageToken(payload.nextPageToken);
      setCurrentVideoId((current) => {
        if (current && payload.videos.some((video) => video.id === current)) {
          return current;
        }

        return payload.videos[0]?.id ?? null;
      });
      setIsLoading(false);
      setStatusMessage(payload.videos.length === 0 ? "No videos found." : null);
    }

    void loadVideos();

    return () => {
      cancelled = true;
    };
  }, [sortDirection, folderId]);

  async function loadMore() {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const response = await fetch(
        `/api/videos?sort=${sortDirection}&folderId=${encodeURIComponent(folderId)}&pageToken=${encodeURIComponent(nextPageToken)}`,
      );
      const payload = (await response.json()) as VideosApiResponse;

      if (response.ok) {
        setVideos((prev) => [...prev, ...payload.videos]);
        setNextPageToken(payload.nextPageToken);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  const videoIds = useMemo(() => videos.map((v) => v.id), [videos]);

  const videoMeta: VideoMeta = useMemo(() => {
    const meta: VideoMeta = {};
    for (const v of videos) {
      meta[v.id] = { folderId: v.folderId, modifiedTime: v.modifiedTime };
    }
    return meta;
  }, [videos]);

  const { recordTime, flush, getInitialTime, isWatched, isNew } = useWatchProgress(
    videoIds,
    videoMeta,
  );

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
    setCurrentVideoId(videos[currentIndex + 1]?.id ?? null);
  }

  function goPrevious() {
    if (currentIndex <= 0) {
      return;
    }

    flush();
    setCurrentVideoId(videos[currentIndex - 1]?.id ?? null);
  }

  function handleSelect(videoId: string) {
    flush();
    setCurrentVideoId(videoId);
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
          <button
            type="button"
            onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
              className={`transition-transform duration-200 ${sortDirection === "desc" ? "rotate-180" : ""}`}
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
            Sort {sortDirection === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        {statusMessage ? (
          <div className="mb-6 rounded-md border border-zinc-800 bg-zinc-900 p-4 text-center text-zinc-400">
            {statusMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-[minmax(280px,360px)_1fr] items-start gap-6">
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
              <div className="h-[calc(100vh-16rem)] min-h-[400px] bg-black" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(280px,360px)_1fr] items-start gap-6">
            <PlaylistPanel
              videos={videos}
              currentVideoId={currentVideoId}
              onSelect={handleSelect}
              isWatched={isWatched}
              isNew={isNew}
              hasMore={!!nextPageToken}
              onLoadMore={loadMore}
              isLoadingMore={isLoadingMore}
            />
            <VideoPlayerPane
              video={currentVideo}
              canGoPrevious={currentIndex > 0}
              canGoNext={currentIndex >= 0 && currentIndex < videos.length - 1}
              onPrevious={goPrevious}
              onNext={goNext}
              initialTime={currentVideo ? getInitialTime(currentVideo.id) : undefined}
              onTimeUpdate={handleTimeUpdate}
              onEnded={goNext}
            />
          </div>
        )}
      </main>
    </div>
  );
}
