import { parseEpisodeName } from "@/lib/episode-name";

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
};

export function PlaylistPanel({
  videos,
  currentVideoId,
  onSelect,
  isWatched,
  isNew,
}: PlaylistPanelProps) {
  return (
    <aside className="flex h-[calc(100vh-12rem)] flex-col rounded-xl border border-zinc-800 bg-zinc-900 py-4 shadow-sm">
      <div className="mb-4 px-6">
        <h3 className="text-base font-semibold text-zinc-400">Playlist</h3>
      </div>

      {videos.length === 0 ? <p className="px-6 text-zinc-400">No videos available.</p> : null}

      <div className="flex-1 overflow-y-auto px-4">
        <div className="flex flex-col gap-1">
          {videos.map((video) => {
            const active = video.id === currentVideoId;
            const watched = isWatched?.(video.id) ?? false;
            const newVideo = !watched && (isNew?.(video.id) ?? false);

            return (
              <button
                key={video.id}
                type="button"
                onClick={() => onSelect(video.id)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-md border-none px-4 py-3 text-left transition-all duration-200 ${
                  active
                    ? "bg-zinc-800 font-semibold text-blue-500"
                    : "bg-transparent font-normal text-zinc-50 hover:bg-zinc-800"
                }`}
              >
                <div className="flex min-w-6 items-center justify-center">
                  {active ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="text-zinc-500"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                      <line x1="7" y1="2" x2="7" y2="22"></line>
                      <line x1="17" y1="2" x2="17" y2="22"></line>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <line x1="2" y1="7" x2="7" y2="7"></line>
                      <line x1="2" y1="17" x2="7" y2="17"></line>
                      <line x1="17" y1="17" x2="22" y2="17"></line>
                      <line x1="17" y1="7" x2="22" y2="7"></line>
                    </svg>
                  )}
                </div>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {parseEpisodeName(video.name)}
                </span>
                {watched ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto shrink-0 text-emerald-500"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : newVideo ? (
                  <span className="ml-auto shrink-0 rounded bg-blue-400/10 px-1.5 py-0.5 text-xs font-semibold text-blue-400">
                    NEW
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
