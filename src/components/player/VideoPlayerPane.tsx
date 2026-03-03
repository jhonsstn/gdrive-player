"use client";

import { parseEpisodeName } from "@/lib/episode-name";
import "video.js/dist/video-js.css";
import { useEffect, useRef, useCallback } from "react";

type VideoEntry = {
  id: string;
  name: string;
  mimeType: string;
};

type VideoPlayerPaneProps = {
  video: VideoEntry | null;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  initialTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
};

type VjsPlayer = {
  currentTime: { (): number; (t: number): VjsPlayer };
  duration: () => number;
  paused: () => boolean;
  play: () => Promise<void> | undefined;
  pause: () => void;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
  dispose: () => void;
  isDisposed: () => boolean;
};

type VjsFactory = (
  el: HTMLVideoElement,
  opts?: Record<string, unknown>,
) => VjsPlayer;

export function VideoPlayerPane({
  video,
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
  initialTime,
  onTimeUpdate,
  onEnded,
}: VideoPlayerPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VjsPlayer | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  const initialTimeRef = useRef(initialTime);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onEndedRef.current = onEnded;
    initialTimeRef.current = initialTime;
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        player.currentTime(Math.max(0, player.currentTime() - 10));
        break;
      case "ArrowRight":
        e.preventDefault();
        player.currentTime(
          Math.min(player.duration() || Infinity, player.currentTime() + 10),
        );
        break;
      case " ":
      case "k":
        e.preventDefault();
        if (player.paused()) {
          player.play();
        } else {
          player.pause();
        }
        break;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !video) return;

    let disposed = false;

    async function setupPlayer(
      targetContainer: HTMLDivElement,
      videoId: string,
    ) {
      try {
        const vjsModule = await import("video.js");
        const videojs = (
          typeof vjsModule === "function"
            ? vjsModule
            : (vjsModule as unknown as { default: unknown }).default ??
              vjsModule
        ) as unknown as VjsFactory;

        if (disposed) return;

        const videoEl = document.createElement("video");
        videoEl.className = "video-js vjs-big-play-centered";
        videoEl.preload = "metadata";
        targetContainer.appendChild(videoEl);

        const player = videojs(videoEl, {
          controls: true,
          autoplay: true,
          preload: "metadata",
          fluid: false,
          fill: true,
          playbackRates: [0.5, 1, 1.25, 1.5, 2],
          controlBar: {
            pictureInPictureToggle: true,
            fullscreenToggle: true,
            volumePanel: { inline: true },
          },
          sources: [{ src: `/api/stream/${videoId}`, type: "video/mp4" }],
        } as Record<string, unknown>);

        playerRef.current = player;

        player.on("loadedmetadata", function handleLoadedMetadata() {
          const t = initialTimeRef.current;
          if (t && t > 0) {
            player.currentTime(t);
          }
        });

        player.on("timeupdate", function handleTimeUpdate() {
          onTimeUpdateRef.current?.(player.currentTime(), player.duration());
        });

        player.on("ended", function handleEnded() {
          onEndedRef.current?.();
        });

        document.addEventListener("keydown", handleKeyDown);
      } catch (error) {
        console.error("Failed to initialize Video.js", error);
      }
    }

    void setupPlayer(container, video.id);

    return () => {
      disposed = true;
      document.removeEventListener("keydown", handleKeyDown);
      if (playerRef.current) {
        if (!playerRef.current.isDisposed()) {
          playerRef.current.dispose();
        }
        playerRef.current = null;
      }
      container.innerHTML = "";
    };
  }, [video?.id, video, handleKeyDown]);

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-sm p-0 overflow-hidden flex flex-col">
      <div className="py-4 px-6 flex justify-between items-center border-b border-zinc-800 bg-zinc-800">
        <h2 className="text-base font-semibold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
          {video ? parseEpisodeName(video.name) : "Select a video"}
        </h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className="inline-flex items-center justify-center text-sm font-medium rounded-md border border-zinc-800 bg-zinc-900 text-zinc-50 cursor-pointer transition-all duration-200 hover:not-disabled:bg-zinc-800 hover:not-disabled:border-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-1.5 px-3 gap-1"
            title="Previous video"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="19 20 9 12 19 4 19 20"></polygon>
              <line x1="5" y1="19" x2="5" y2="5"></line>
            </svg>
            <span className="hidden">Prev</span>
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            className="inline-flex items-center justify-center text-sm font-medium rounded-md border border-zinc-800 bg-zinc-900 text-zinc-50 cursor-pointer transition-all duration-200 hover:not-disabled:bg-zinc-800 hover:not-disabled:border-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-1.5 px-3 gap-1"
            title="Next video"
          >
            <span className="hidden">Next</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-black w-full min-h-[400px] h-[calc(100vh-16rem)]">
        {video ? (
          <div ref={containerRef} className="w-full h-full" />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-500 w-full">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <p>Select a video from the playlist to start playback</p>
          </div>
        )}
      </div>
    </section>
  );
}
