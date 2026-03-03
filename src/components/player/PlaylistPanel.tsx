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
};

export function PlaylistPanel({
  videos,
  currentVideoId,
  onSelect,
  isWatched,
}: PlaylistPanelProps) {
  return (
    <aside className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-sm flex flex-col h-[calc(100vh-12rem)] py-4">
      <div className="px-6 mb-4">
        <h3 className="text-base font-semibold text-zinc-400">
          Playlist
        </h3>
      </div>

      {videos.length === 0 ? (
        <p className="px-6 text-zinc-400">No videos available.</p>
      ) : null}

      <div className="overflow-y-auto flex-1 px-4">
        <div className="flex flex-col gap-1">
          {videos.map((video) => {
            const active = video.id === currentVideoId;
            const watched = isWatched?.(video.id) ?? false;

            return (
              <button
                key={video.id}
                type="button"
                onClick={() => onSelect(video.id)}
                className={`text-left py-3 px-4 rounded-md border-none flex items-center gap-3 transition-all duration-200 cursor-pointer w-full ${
                  active
                    ? "bg-zinc-800 text-blue-500 font-semibold"
                    : "bg-transparent text-zinc-50 font-normal hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center justify-center min-w-[24px]">
                  {active ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
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
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {parseEpisodeName(video.name)}
                </span>
                {watched && (
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
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
