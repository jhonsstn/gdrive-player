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

  return NextResponse.json({ items });
}
