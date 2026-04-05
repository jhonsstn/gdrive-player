"use client";

import { useEffect, useRef, useState } from "react";

import { parseEpisodeName } from "@/lib/episode-name";
import { DropdownMenu } from "@/components/ui/DropdownMenu";

type PlaylistVideo = {
  id: string;
  name: string;
  mimeType: string;
  sourceUrl: string;
  folderId: string;
  modifiedTime: string | null;
  folderVideoId: string | null;
};

type PlaylistPanelProps = {
  videos: PlaylistVideo[];
  currentVideoId: string | null;
  onSelect: (videoId: string) => void;
  isWatched?: (videoId: string) => boolean;
  onToggleWatched?: (videoId: string, watched: boolean) => void;
  isMarkingVideo?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
};

function PlaylistItem({ 
  video, 
  active, 
  watched, 
  onSelect, 
  onToggleWatched, 
  isMarkingVideo 
}: { 
  video: PlaylistVideo; 
  active: boolean; 
  watched: boolean; 
  onSelect: (id: string) => void; 
  onToggleWatched?: (id: string, w: boolean) => void;
  isMarkingVideo?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  const handleMouseEnter = () => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const textWidth = textRef.current.scrollWidth;
      
      if (textWidth > containerWidth) {
        const distance = containerWidth - textWidth;
        containerRef.current.style.setProperty("--marquee-distance", `${distance}px`);
        setShouldAnimate(true);
      } else {
        setShouldAnimate(false);
      }
    }
  };

  return (
    <div
      className={`group flex w-full min-h-[48px] items-center gap-2 rounded-xl transition-all duration-300 animate-marquee-hover ${
        active ? "bg-zinc-800 shadow-md" : "hover:bg-zinc-800/80"
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShouldAnimate(false)}
    >
      <button
        type="button"
        onClick={() => onSelect(video.id)}
        className="flex flex-1 cursor-pointer items-center gap-4 border-none p-3 sm:p-4 text-left min-w-0"
      >
        <div className="flex-1 min-w-0 pr-2 pl-2">
          <div ref={containerRef} className="relative overflow-hidden mask-fade-right">
            <span 
              ref={textRef}
              className={`marquee-content inline-block whitespace-nowrap font-semibold transition-colors duration-300 ${
                active ? "text-blue-500" : "text-zinc-100 group-hover:text-white"
              } ${shouldAnimate ? "" : "truncate block"}`}
            >
              {parseEpisodeName(video.name)}
            </span>
          </div>
          {video.modifiedTime && (
            <span className="mt-0.5 block truncate text-xs font-medium text-zinc-500 transition-colors duration-300 group-hover:text-zinc-400">
              {new Date(video.modifiedTime).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          )}
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
          ) : null}
        </div>
      </button>

      <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
        <DropdownMenu
          trigger={
            <div className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-zinc-700 text-zinc-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="1.5"></circle>
                <circle cx="12" cy="6" r="1.5"></circle>
                <circle cx="12" cy="18" r="1.5"></circle>
              </svg>
            </div>
          }
          items={[
            {
              label: (isMarkingVideo && active) ? "Saving…" : watched ? "Mark as unwatched" : "Mark as watched",
              onClick: () => {
                if (!isMarkingVideo && onToggleWatched) {
                  onToggleWatched(video.id, !watched);
                }
              },
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {watched ? (
                    <><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></>
                  ) : (
                    <polyline points="20 6 9 17 4 12"></polyline>
                  )}
                </svg>
              )
            }
          ]}
          align="right"
        />
      </div>
    </div>
  );
}

export function PlaylistPanel({
  videos,
  currentVideoId,
  onSelect,
  isWatched,
  onToggleWatched,
  isMarkingVideo,
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
            {videos.map((video) => (
              <PlaylistItem
                key={video.id}
                video={video}
                active={video.id === currentVideoId}
                watched={isWatched?.(video.id) ?? false}
                onSelect={onSelect}
                onToggleWatched={onToggleWatched}
                isMarkingVideo={isMarkingVideo}
              />
            ))}
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
