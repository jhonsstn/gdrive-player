"use client";

type Season = {
  seasonNumber: number;
  folderId: string;
  folderName: string | null;
};

type SeasonTabsProps = {
  seasons: Season[];
  activeSeasonNumber: number;
  onSeasonChange: (seasonNumber: number) => void;
};

export function SeasonTabs({ seasons, activeSeasonNumber, onSeasonChange }: SeasonTabsProps) {
  if (seasons.length <= 1) {
    return (
      <div className="mb-4 border-b border-zinc-800 pb-3">
        <span className="text-sm font-medium text-zinc-400">Season 1</span>
      </div>
    );
  }

  return (
    <div className="mb-4 flex gap-1 border-b border-zinc-800">
      {seasons.map((season) => {
        const isActive = season.seasonNumber === activeSeasonNumber;
        return (
          <button
            key={season.seasonNumber}
            onClick={() => onSeasonChange(season.seasonNumber)}
            className={`relative px-4 pb-3 pt-1 text-sm font-medium transition-colors ${
              isActive
                ? "text-blue-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            S{season.seasonNumber}
            {isActive && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}
