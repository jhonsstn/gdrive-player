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

  // Enrich seasons with folder names
  const folderIds = seriesList.flatMap((s) => s.seasons.map((sn) => sn.folderId));

  const folders = folderIds.length > 0
    ? await db.configuredFolder.findMany({
        where: { folderId: { in: folderIds }, archived: false },
        select: { folderId: true, name: true },
      })
    : [];

  const folderNameMap = new Map(folders.map((f) => [f.folderId, f.name]));

  const series = seriesList.map((s) => ({
    id: s.id,
    name: s.name,
    seasons: s.seasons
      .filter((sn) => folderNameMap.has(sn.folderId))
      .map((sn) => ({
        id: sn.id,
        seasonNumber: sn.seasonNumber,
        folderId: sn.folderId,
        folderName: folderNameMap.get(sn.folderId) ?? null,
      })),
  }));

  return NextResponse.json(
    { series },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  );
}
