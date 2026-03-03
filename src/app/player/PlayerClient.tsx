"use client";

import { useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { PlaylistPanel } from "@/components/player/PlaylistPanel";
import { VideoPlayerPane } from "@/components/player/VideoPlayerPane";
import { useWatchProgress } from "@/hooks/useWatchProgress";

type SortDirection = "asc" | "desc";

type PlayerVideo = {
  id: string;
  name: string;
  mimeType: string;
  sourceUrl: string;
  folderId: string;
};

type VideosApiResponse = {
  videos: PlayerVideo[];
  sort: SortDirection;
  error?: string;
};

type PlayerClientProps = {
  folderId: string;
  userImage?: string | null;
  userName?: string | null;
  isAdmin?: boolean;
};

export function PlayerClient({
  folderId,
  userImage,
  userName,
  isAdmin = false,
}: PlayerClientProps) {
  const [videos, setVideos] = useState<PlayerVideo[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVideos() {
      setStatusMessage("Loading videos...");

      const response = await fetch(`/api/videos?sort=${sortDirection}&folderId=${encodeURIComponent(folderId)}`);
      const payload = (await response.json()) as VideosApiResponse;

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setVideos([]);
        setCurrentVideoId(null);
        setStatusMessage(payload.error ?? "Failed to load videos");
        return;
      }

      setVideos(payload.videos);
      setCurrentVideoId((current) => {
        if (current && payload.videos.some((video) => video.id === current)) {
          return current;
        }

        return payload.videos[0]?.id ?? null;
      });
      setStatusMessage(payload.videos.length === 0 ? "No videos found." : null);
    }

    void loadVideos();

    return () => {
      cancelled = true;
    };
  }, [sortDirection, folderId]);

  const videoIds = useMemo(() => videos.map((v) => v.id), [videos]);

  const { recordTime, flush, getInitialTime, isWatched } =
    useWatchProgress(videoIds);

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
    <div className="min-h-screen flex flex-col">
      <AppHeader userImage={userImage} userName={userName} showAdminLink={isAdmin} />

      <main className="flex-1 p-8 max-w-[1200px] w-full mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold tracking-tight">My Videos</h2>
          <button
            type="button"
            onClick={() =>
              setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
            }
            className="inline-flex items-center justify-center text-sm font-medium rounded-md border border-zinc-800 bg-zinc-900 text-zinc-50 cursor-pointer transition-all duration-200 hover:bg-zinc-800 hover:border-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 gap-2 py-1.5 px-3"
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
          <div className="p-4 rounded-md bg-zinc-900 border border-zinc-800 mb-6 text-center text-zinc-400">
            {statusMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-[minmax(280px,340px)_1fr] gap-6 items-start">
          <PlaylistPanel
            videos={videos}
            currentVideoId={currentVideoId}
            onSelect={handleSelect}
            isWatched={isWatched}
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
      </main>
    </div>
  );
}
