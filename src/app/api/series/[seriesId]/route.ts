import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

type RouteParams = { params: Promise<{ seriesId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { seriesId } = await params;

  const series = await db.series.findUnique({
    where: { id: seriesId },
    include: {
      seasons: {
        orderBy: { seasonNumber: "asc" },
      },
    },
  });

  if (!series) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const folderIds = series.seasons.map((sn) => sn.folderId);

  const folders = folderIds.length > 0
    ? await db.configuredFolder.findMany({
        where: { folderId: { in: folderIds } },
        select: { folderId: true, name: true, archived: true },
      })
    : [];

  const folderMap = new Map(folders.map((f) => [f.folderId, f]));

  return NextResponse.json({
    series: {
      id: series.id,
      name: series.name,
      seasons: series.seasons.map((sn) => {
        const folder = folderMap.get(sn.folderId);
        return {
          id: sn.id,
          seasonNumber: sn.seasonNumber,
          folderId: sn.folderId,
          folderName: folder?.name ?? null,
          archived: folder?.archived ?? false,
        };
      }),
    },
  });
}
