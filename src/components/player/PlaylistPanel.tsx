"use client";

import { useEffect, useRef } from "react";

import { parseEpisodeName } from "@/lib/episode-name";
import { Badge } from "@/components/ui/Badge";

type PlaylistVideo = {
  id: string;
  name: string;
  mimeType: string;
  sourceUrl: string;
  folderId: string;
};

type PlaylistPanelProps = {
  videos: PlaylistVideo[];
  currentVideoId: string | null;
  onSelect: (videoId: string) => void;
  isWatched?: (videoId: string) => boolean;
  isNew?: (videoId: string) => boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
};

export function PlaylistPanel({
  videos,
  currentVideoId,
  onSelect,
  isWatched,
  isNew,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: PlaylistPanelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, isLoadingMore]);

  return (
    <div className="w-full">
      <aside className="no-scrollbar flex max-h-[60vh] flex-col rounded-xl border border-zinc-800 bg-zinc-900 py-4 shadow-sm lg:h-[calc(100vh-12rem)] lg:max-h-none">
        <div className="mb-4 px-6">
        <h3 className="text-base font-semibold text-zinc-400">Playlist</h3>
      </div>

      {videos.length === 0 ? <p className="px-6 text-zinc-400">No videos available.</p> : null}

      <div className="flex-1 overflow-y-auto px-4">
        <div className="flex flex-col gap-2">
          {videos.map((video, index) => {
            const active = video.id === currentVideoId;
            const watched = isWatched?.(video.id) ?? false;
            const newVideo = !watched && (isNew?.(video.id) ?? false);

            return (
              <button
                key={video.id}
                type="button"
                onClick={() => onSelect(video.id)}
                className={`group flex w-full min-h-[48px] cursor-pointer items-center gap-4 rounded-xl border-none p-3 sm:p-4 text-left transition-all duration-300 ${
                  active
                    ? "bg-zinc-800 shadow-md"
                    : "bg-transparent hover:bg-zinc-800/80"
                }`}
              >
                <div className={`flex shrink-0 items-center justify-center text-2xl font-black tabular-nums tracking-tighter transition-colors duration-300 ${
                  active ? "text-blue-500" : "text-zinc-700 group-hover:text-zinc-500"
                }`}>
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  <span className={`block truncate font-semibold transition-colors duration-300 ${
                    active ? "text-blue-500" : "text-zinc-100 group-hover:text-white"
                  }`}>
                    {parseEpisodeName(video.name)}
                  </span>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-3 pl-2">
                  {active && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-blue-500">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  )}
                  {watched && !active ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-emerald-500/50"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : newVideo ? (
                    <Badge>NEW</Badge>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
        {hasMore && (
          <div ref={sentinelRef} className="py-3 text-center text-xs text-zinc-500">
            {isLoadingMore ? "Loading…" : ""}
          </div>
        )}
      </div>
    </aside>
    </div>
  );
}
