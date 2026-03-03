"use client";

import { parseEpisodeName } from "@/lib/episode-name";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { useEffect, useRef } from "react";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  const initialTimeRef = useRef(initialTime);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onEndedRef.current = onEnded;
    initialTimeRef.current = initialTime;
  });

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !video) return;

    const player = new Plyr(videoEl, {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "settings",
        "pip",
        "fullscreen",
      ],
      autoplay: true,
      seekTime: 10,
      keyboard: { focused: true, global: true },
    });

    playerRef.current = player;

    function handleLoadedMetadata() {
      const t = initialTimeRef.current;
      if (t && t > 0) {
        player.currentTime = t;
      }
    }

    function handleTimeUpdate() {
      onTimeUpdateRef.current?.(player.currentTime, player.duration);
    }

    function handleEnded() {
      onEndedRef.current?.();
    }

    videoEl.addEventListener("loadedmetadata", handleLoadedMetadata);
    player.on("timeupdate", handleTimeUpdate);
    player.on("ended", handleEnded);

    return () => {
      videoEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
      player.off("timeupdate", handleTimeUpdate);
      player.off("ended", handleEnded);
      player.destroy();
      playerRef.current = null;
    };
  }, [video]);

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

      <div className="bg-black w-full flex justify-center content-center min-h-[400px]">
        {video ? (
          <video
            key={video.id}
            ref={videoRef}
            preload="metadata"
            className="w-full max-h-[calc(100vh-16rem)] outline-none"
          >
            <source src={`/api/stream/${video.id}`} type={video.mimeType} />
            Your browser does not support HTML5 video playback.
          </video>
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
