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

export default function PlayerPage() {
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
    <main style={{ padding: "2rem" }}>
      <h1>Player</h1>
      <p>
        <Link href="/config">Open admin config</Link>
      </p>
      <div style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={() =>
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
          }
        >
          Sort: {sortDirection === "asc" ? "Ascending" : "Descending"}
        </button>
      </div>

      {statusMessage ? <p>{statusMessage}</p> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 320px) 1fr",
          gap: "1rem",
          alignItems: "start",
        }}
      >
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
  );
}
