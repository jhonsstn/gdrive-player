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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-secondary)",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, var(--accent-primary), #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 10px rgba(59, 130, 246, 0.3)",
            }}
          >
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
          <h1 style={{ margin: 0, fontSize: "1.25rem", letterSpacing: "-0.01em" }}>
            Drive Player
          </h1>
        </div>
        <Link
          href="/config"
          style={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
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

      <main
        style={{
          flex: 1,
          padding: "2rem",
          maxWidth: "var(--max-w)",
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h2 style={{ margin: 0 }}>My Videos</h2>
          <button
            type="button"
            onClick={() =>
              setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
            }
            style={{ display: "flex", gap: "0.5rem", padding: "0.4rem 0.75rem" }}
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
              style={{
                transform: sortDirection === "desc" ? "rotate(180deg)" : "none",
                transition: "transform 0.2s ease",
              }}
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
            Sort {sortDirection === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        {statusMessage ? (
          <div
            style={{
              padding: "1rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              marginBottom: "1.5rem",
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            {statusMessage}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 340px) 1fr",
            gap: "1.5rem",
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
    </div>
  );
}
