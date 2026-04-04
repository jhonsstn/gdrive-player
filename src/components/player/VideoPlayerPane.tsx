"use client";

import { parseEpisodeName } from "@/lib/episode-name";
import "video.js/dist/video-js.css";
import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";

type VideoEntry = {
  id: string;
  name: string;
  mimeType: string;
  folderId: string;
  modifiedTime: string | null;
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
  isWatched?: boolean;
  onToggleWatched?: (watched: boolean) => void;
};

type VjsPlayer = {
  currentTime: { (): number; (t: number): VjsPlayer };
  duration: () => number;
  paused: () => boolean;
  play: () => Promise<void> | undefined;
  pause: () => void;
  src: (sources: { src: string; type: string }) => void;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
  dispose: () => void;
  isDisposed: () => boolean;
  controlBar: {
    getChild: (name: string) => { show: () => void; hide: () => void } | undefined;
  };
};

type VjsFactory = (el: HTMLVideoElement, opts?: Record<string, unknown>) => VjsPlayer;

type VjsStatic = {
  getComponent: (name: string) => new (...args: unknown[]) => Record<string, unknown>;
  registerComponent: (name: string, comp: unknown) => void;
};

function registerNextButton(
  vjsAny: VjsStatic,
  nextSvg: string,
  onNextRef: React.RefObject<() => void>,
) {
  const VjsButton = vjsAny.getComponent("Button");

  class NextButton extends VjsButton {
    constructor(p: unknown, options: unknown) {
      super(p, options);
      const self = this as unknown as { controlText: (t: string) => void; hide: () => void; el: () => HTMLElement };
      self.controlText("Next");
      self.hide();
      const btnEl = self.el();
      if (btnEl) {
        const icon = btnEl.querySelector(".vjs-icon-placeholder");
        if (icon) icon.innerHTML = nextSvg;
      }
    }
    handleClick() {
      onNextRef.current();
    }
    buildCSSClass() {
      const parentClass = (VjsButton.prototype as unknown as { buildCSSClass: () => string }).buildCSSClass.call(this);
      return `vjs-next-button ${parentClass}`;
    }
  }

  vjsAny.registerComponent("NextButton", NextButton);
}

export function VideoPlayerPane({
  video,
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
  initialTime,
  onTimeUpdate,
  onEnded,
  isWatched,
  onToggleWatched,
}: VideoPlayerPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VjsPlayer | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  const initialTimeRef = useRef(initialTime);
  const onNextRef = useRef(onNext);
  const nextShownRef = useRef(false);
  const videoIdRef = useRef(video?.id);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onEndedRef.current = onEnded;
    initialTimeRef.current = initialTime;
    onNextRef.current = onNext;
    videoIdRef.current = video?.id;
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
        player.currentTime(Math.min(player.duration() || Infinity, player.currentTime() + 10));
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

  // Create the player once when the container mounts
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    async function initPlayer(targetContainer: HTMLDivElement) {
      try {
        const vjsModule = await import("video.js");
        const vjsRaw = typeof vjsModule === "function"
          ? vjsModule
          : ((vjsModule as unknown as { default: unknown }).default ??
            vjsModule);
        const videojs = vjsRaw as unknown as VjsFactory;

        // Register custom NextButton component (idempotent)
        const vjsAny = vjsRaw as unknown as VjsStatic;
        const nextSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>`;
        registerNextButton(vjsAny, nextSvg, onNextRef);

        if (disposed) return;

        const videoEl = document.createElement("video");
        videoEl.className = "video-js vjs-big-play-centered";
        videoEl.preload = "metadata";
        targetContainer.appendChild(videoEl);

        const player = videojs(videoEl, {
          controls: true,
          autoplay: false,
          preload: "metadata",
          fluid: false,
          fill: true,
          playbackRates: [0.5, 1, 1.25, 1.5, 2],
          controlBar: {
            pictureInPictureToggle: true,
            fullscreenToggle: true,
            volumePanel: { inline: true },
            children: [
              "playToggle",
              "volumePanel",
              "currentTimeDisplay",
              "timeDivider",
              "durationDisplay",
              "progressControl",
              "playbackRateMenuButton",
              "NextButton",
              "pictureInPictureToggle",
              "fullscreenToggle",
            ],
          },
        } as Record<string, unknown>);

        playerRef.current = player;

        // Load initial source if a video is already selected
        if (videoIdRef.current) {
          player.src({ src: `/api/stream/${videoIdRef.current}`, type: "video/mp4" });
        }

        player.on("loadedmetadata", function handleLoadedMetadata() {
          const t = initialTimeRef.current;
          if (t && t > 0) {
            player.currentTime(t);
          }
        });

        player.on("timeupdate", function handleTimeUpdate() {
          const ct = player.currentTime();
          const dur = player.duration();
          onTimeUpdateRef.current?.(ct, dur);

          if (dur > 0) {
            const past90 = ct / dur >= 0.9;
            if (past90 !== nextShownRef.current) {
              nextShownRef.current = past90;
              const nextBtn = player.controlBar.getChild("NextButton");
              if (nextBtn) {
                if (past90) nextBtn.show();
                else nextBtn.hide();
              }
            }
          }
        });

        player.on("ended", function handleEnded() {
          onEndedRef.current?.();
        });

        document.addEventListener("keydown", handleKeyDown);
      } catch (error) {
        console.error("Failed to initialize Video.js", error);
      }
    }

    void initPlayer(container);

    return () => {
      disposed = true;
      nextShownRef.current = false;
      document.removeEventListener("keydown", handleKeyDown);
      if (playerRef.current) {
        if (!playerRef.current.isDisposed()) {
          playerRef.current.dispose();
        }
        playerRef.current = null;
      }
      container.innerHTML = "";
    };
  }, [handleKeyDown]);

  // Swap source when video changes (keeps player alive, preserves fullscreen)
  const videoId = video?.id ?? null;
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed() || !videoId) return;

    nextShownRef.current = false;
    const nextBtn = player.controlBar.getChild("NextButton");
    if (nextBtn) nextBtn.hide();

    player.src({ src: `/api/stream/${videoId}`, type: "video/mp4" });
  }, [videoId]);

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-0 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-800 px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {video && onToggleWatched && (
            <DropdownMenu
              trigger={
                <div className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-zinc-700 text-zinc-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="1.5"></circle>
                    <circle cx="12" cy="6" r="1.5"></circle>
                    <circle cx="12" cy="18" r="1.5"></circle>
                  </svg>
                </div>
              }
              items={[
                {
                  label: isWatched ? "Mark as unwatched" : "Mark as watched",
                  onClick: () => onToggleWatched(!isWatched),
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{isWatched ? <><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></> : <polyline points="20 6 9 17 4 12"></polyline>}</svg>
                }
              ]}
              align="left"
            />
          )}
          <h2 className="overflow-hidden text-base font-semibold tracking-tight text-ellipsis whitespace-nowrap">
            {video ? parseEpisodeName(video.name) : "Select a video"}
          </h2>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            title="Previous video"
            className="gap-1"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
            <span className="hidden">Prev</span>
          </Button>
          <Button
            variant="secondary"
            onClick={onNext}
            disabled={!canGoNext}
            title="Next video"
            className="gap-1"
          >
            <span className="hidden">Next</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </Button>
        </div>
      </div>

      <div className="w-full bg-black">
        {video ? (
          <div ref={containerRef} className="h-125 min-h-100 w-full" />
        ) : (
          <div className="flex w-full flex-col items-center justify-center text-zinc-500">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-4 opacity-50"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <p>Select a video from the playlist to start playback</p>
          </div>
        )}
      </div>
    </section>
  );
}
