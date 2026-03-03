"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PlaylistPanel } from "@/components/player/PlaylistPanel";
import { VideoPlayerPane } from "@/components/player/VideoPlayerPane";

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

export function PlayerClient() {
  const [videos, setVideos] = useState<PlayerVideo[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVideos() {
      setStatusMessage("Loading videos...");

      const response = await fetch(`/api/videos?sort=${sortDirection}`);
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
  }, [sortDirection]);

  const currentIndex = useMemo(
    () => videos.findIndex((video) => video.id === currentVideoId),
    [currentVideoId, videos],
  );

  const currentVideo = currentIndex >= 0 ? videos[currentIndex] : null;

  function goNext() {
    if (currentIndex < 0 || currentIndex >= videos.length - 1) {
      return;
    }

    setCurrentVideoId(videos[currentIndex + 1]?.id ?? null);
  }

  function goPrevious() {
    if (currentIndex <= 0) {
      return;
    }

    setCurrentVideoId(videos[currentIndex - 1]?.id ?? null);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md gradient-logo flex items-center justify-center shadow-[0_2px_10px_rgba(59,130,246,0.3)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Drive Player
          </h1>
        </div>
        <Link
          href="/config"
          className="text-sm font-medium text-zinc-400 flex items-center gap-1.5 hover:text-zinc-300"
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
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Admin
        </Link>
      </header>

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
            onSelect={setCurrentVideoId}
          />
          <VideoPlayerPane
            video={currentVideo}
            canGoPrevious={currentIndex > 0}
            canGoNext={currentIndex >= 0 && currentIndex < videos.length - 1}
            onPrevious={goPrevious}
            onNext={goNext}
          />
        </div>
      </main>
    </div>
  );
}
