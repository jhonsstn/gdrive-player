"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PlayerClient } from "../../PlayerClient";
import { SeasonTabs } from "@/components/player/SeasonTabs";

type Season = {
  id: string;
  seasonNumber: number;
  folderId: string;
  folderName: string | null;
};

type SeriesPlayerClientProps = {
  seriesId: string;
  seriesName: string;
  seasons: Season[];
  initialSeasonNumber: number;
  initialVideoId?: string;
  userImage: string | null;
  userName: string | null;
  isAdmin: boolean;
};

export function SeriesPlayerClient({
  seriesId,
  seriesName,
  seasons,
  initialSeasonNumber,
  initialVideoId,
  userImage,
  userName,
  isAdmin,
}: SeriesPlayerClientProps) {
  const router = useRouter();
  const [activeSeasonNumber, setActiveSeasonNumber] = useState(initialSeasonNumber);

  const activeSeason = useMemo(
    () => seasons.find((s) => s.seasonNumber === activeSeasonNumber) ?? seasons[0]!,
    [seasons, activeSeasonNumber],
  );

  const handleSeasonChange = useCallback(
    (seasonNumber: number) => {
      setActiveSeasonNumber(seasonNumber);
      router.push(`/player/series/${seriesId}?season=${seasonNumber}`, { scroll: false });
    },
    [seriesId, router],
  );

  return (
    <PlayerClient
      key={activeSeason.folderId}
      folderId={activeSeason.folderId}
      folderName={activeSeason.folderName}
      title={seriesName}
      userImage={userImage}
      userName={userName}
      isAdmin={isAdmin}
      initialVideoId={activeSeasonNumber === initialSeasonNumber ? initialVideoId : undefined}
      headerExtra={
        <SeasonTabs
          seasons={seasons}
          activeSeasonNumber={activeSeasonNumber}
          onSeasonChange={handleSeasonChange}
        />
      }
    />
  );
}
