import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { folderVideoIds, watched } = body as {
    folderVideoIds?: string[];
    watched?: boolean;
  };

  if (!Array.isArray(folderVideoIds) || folderVideoIds.length === 0 || typeof watched !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userEmail = session.user.email;

  const ops = folderVideoIds.map((folderVideoId) =>
    db.watchProgress.upsert({
      where: { userEmail_folderVideoId: { userEmail, folderVideoId } },
      create: { userEmail, folderVideoId, currentTime: watched ? 1 : 0, duration: 1, watched },
      update: { currentTime: watched ? 1 : 0, watched },
    }),
  );

  for (let i = 0; i < ops.length; i += 100) {
    await db.$transaction(ops.slice(i, i + 100));
  }

  if (watched) {
    const folderVideos = await db.folderVideo.findMany({
      where: { id: { in: folderVideoIds } },
      select: { folderId: true, modifiedTime: true },
    });

    // Group by folderId and find latest modifiedTime per folder
    const byFolder = new Map<string, Date>();
    for (const fv of folderVideos) {
      if (!fv.folderId || !fv.modifiedTime) continue;
      const current = byFolder.get(fv.folderId);
      if (!current || fv.modifiedTime > current) {
        byFolder.set(fv.folderId, fv.modifiedTime);
      }
    }

    for (const [folderId, latestModified] of byFolder) {
      const existingLastSeen = await db.userFolderLastSeen.findUnique({
        where: { userEmail_folderId: { userEmail, folderId } },
      });
      if (!existingLastSeen?.watchedThrough || latestModified > existingLastSeen.watchedThrough) {
        await db.userFolderLastSeen.upsert({
          where: { userEmail_folderId: { userEmail, folderId } },
          create: { userEmail, folderId, lastSeenDate: latestModified, watchedThrough: latestModified },
          update: { lastSeenDate: latestModified, watchedThrough: latestModified },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, markedCount: folderVideoIds.length });
}
