import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Fetch all seasons to know which folders belong to a series
  const seasons = await db.season.findMany({
    include: { series: true },
    orderBy: { seasonNumber: "asc" },
  });

  const folderIdsInSeries = new Set(seasons.map((s) => s.folderId));

  // Standalone folders: not archived and not part of any series
  const allFolders = await db.configuredFolder.findMany({
    where: { archived: false },
    select: { id: true, folderId: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const folders = allFolders.filter((f) => !folderIdsInSeries.has(f.folderId));

  // Build series list with season details
  const folderNameMap = new Map(allFolders.map((f) => [f.folderId, f.name]));

  const seriesMap = new Map<string, {
    id: string;
    name: string;
    seasons: { seasonNumber: number; folderId: string; folderName: string | null }[];
  }>();

  for (const season of seasons) {
    // Skip seasons whose folder is archived (not in allFolders)
    if (!folderNameMap.has(season.folderId) && !folderIdsInSeries.has(season.folderId)) continue;

    if (!seriesMap.has(season.seriesId)) {
      seriesMap.set(season.seriesId, {
        id: season.series.id,
        name: season.series.name,
        seasons: [],
      });
    }

    seriesMap.get(season.seriesId)!.seasons.push({
      seasonNumber: season.seasonNumber,
      folderId: season.folderId,
      folderName: folderNameMap.get(season.folderId) ?? null,
    });
  }

  const series = Array.from(seriesMap.values());

  return NextResponse.json({ folders, series }, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}
