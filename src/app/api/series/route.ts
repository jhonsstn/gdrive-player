import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const seriesList = await db.series.findMany({
    include: {
      seasons: {
        orderBy: { seasonNumber: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Enrich seasons with folder metadata. Config needs archived seasons visible
  // so admins can unarchive them from the series list.
  const folderIds = seriesList.flatMap((s) => s.seasons.map((sn) => sn.folderId));

  const folders =
    folderIds.length > 0
      ? await db.configuredFolder.findMany({
          where: { folderId: { in: folderIds } },
          select: { id: true, folderId: true, name: true, archived: true },
        })
      : [];

  const folderMap = new Map(folders.map((f) => [f.folderId, f]));

  const series = seriesList.map((s) => ({
    id: s.id,
    name: s.name,
    seasons: s.seasons.map((sn) => {
      const folder = folderMap.get(sn.folderId);
      return {
        id: sn.id,
        seasonNumber: sn.seasonNumber,
        folderId: sn.folderId,
        folderName: folder?.name ?? null,
        folderConfigId: folder?.id ?? null,
        archived: folder?.archived ?? false,
      };
    }),
  }));

  return NextResponse.json(
    { series },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  );
}
