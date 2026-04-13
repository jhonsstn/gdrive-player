import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";

import { SeriesPlayerClient } from "./SeriesPlayerClient";

export const dynamic = "force-dynamic";

type SeriesPageProps = {
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<{ season?: string; videoId?: string }>;
};

export default async function SeriesPlayerPage({ params, searchParams }: SeriesPageProps) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/");
  }

  const { seriesId } = await params;
  const { season: seasonParam, videoId: initialVideoId } = await searchParams;

  const series = await db.series.findUnique({
    where: { id: seriesId },
    include: {
      seasons: {
        orderBy: { seasonNumber: "asc" },
      },
    },
  });

  if (!series || series.seasons.length === 0) {
    redirect("/player");
  }

  // Resolve folder names for each season
  const folderIds = series.seasons.map((s) => s.folderId);
  const folders = await db.configuredFolder.findMany({
    where: { folderId: { in: folderIds }, archived: false },
    select: { folderId: true, name: true },
  });
  const folderNameMap = new Map(folders.map((f) => [f.folderId, f.name]));

  const seasons = series.seasons
    .filter((s) => folderNameMap.has(s.folderId))
    .map((s) => ({
      id: s.id,
      seasonNumber: s.seasonNumber,
      folderId: s.folderId,
      folderName: folderNameMap.get(s.folderId) ?? null,
    }));

  if (seasons.length === 0) {
    redirect("/player");
  }

  const initialSeason = seasonParam ? parseInt(seasonParam, 10) : seasons[0]!.seasonNumber;

  return (
    <SeriesPlayerClient
      seriesId={seriesId}
      seriesName={series.name}
      seasons={seasons}
      initialSeasonNumber={initialSeason}
      initialVideoId={initialVideoId}
      userImage={session.user.image ?? null}
      userName={session.user.name ?? null}
      isAdmin={isAdminSession(session)}
    />
  );
}
