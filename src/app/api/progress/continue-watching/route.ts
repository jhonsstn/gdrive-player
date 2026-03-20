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
      folderId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Keep only the most recent per folder
  const seenFolders = new Set<string>();
  const items: {
    videoId: string;
    videoName: string | null;
    folderId: string;
    currentTime: number;
    duration: number;
    updatedAt: string;
  }[] = [];

  for (const row of rows) {
    if (!row.folderId || seenFolders.has(row.folderId)) continue;
    seenFolders.add(row.folderId);
    items.push({
      videoId: row.videoId,
      videoName: row.videoName,
      folderId: row.folderId,
      currentTime: row.currentTime,
      duration: row.duration,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  return NextResponse.json({ items }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}
