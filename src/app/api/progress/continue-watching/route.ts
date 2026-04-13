import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.watchProgress.findMany({
    where: {
      userEmail: session.user.email,
      watched: false,
      currentTime: { gt: 0 },
    },
    include: {
      folderVideo: { select: { folderId: true, driveFileId: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Keep only the most recent per folder
  const seenFolders = new Set<string>();
  const items: {
    videoId: string;
    videoName: string;
    folderId: string;
    currentTime: number;
    duration: number;
    updatedAt: string;
    seriesId?: string;
    seriesName?: string;
    seasonNumber?: number;
  }[] = [];

  for (const row of rows) {
    const fv = row.folderVideo;
    if (!fv?.folderId || seenFolders.has(fv.folderId)) continue;
    seenFolders.add(fv.folderId);
    items.push({
      videoId: fv.driveFileId,
      videoName: fv.name,
      folderId: fv.folderId,
      currentTime: row.currentTime,
      duration: row.duration,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  // Enrich items with series metadata
  const folderIds = items.map((i) => i.folderId);

  if (folderIds.length > 0) {
    const seasons = await db.season.findMany({
      where: { folderId: { in: folderIds } },
      include: { series: { select: { id: true, name: true } } },
    });

    const seasonByFolder = new Map(seasons.map((s) => [s.folderId, s]));

    for (const item of items) {
      const season = seasonByFolder.get(item.folderId);
      if (season) {
        item.seriesId = season.series.id;
        item.seriesName = season.series.name;
        item.seasonNumber = season.seasonNumber;
      }
    }
  }

  return NextResponse.json({ items });
}
