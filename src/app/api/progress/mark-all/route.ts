import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { folderId, watched } = body as { folderId?: string; watched?: boolean };

  if (!folderId || typeof watched !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userEmail = session.user.email;
  const folderVideos = await db.folderVideo.findMany({ where: { folderId } });

  const ops = folderVideos.map((fv) =>
    db.watchProgress.upsert({
      where: { userEmail_folderVideoId: { userEmail, folderVideoId: fv.id } },
      create: { userEmail, folderVideoId: fv.id, currentTime: watched ? 1 : 0, duration: 1, watched },
      update: { currentTime: watched ? 1 : 0, watched },
    }),
  );

  for (let i = 0; i < ops.length; i += 100) {
    await db.$transaction(ops.slice(i, i + 100));
  }

  if (watched) {
    let latestModified: Date | null = null;
    for (const fv of folderVideos) {
      if (fv.modifiedTime && (!latestModified || fv.modifiedTime > latestModified)) {
        latestModified = fv.modifiedTime;
      }
    }

    if (latestModified) {
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
  } else {
    await db.userFolderLastSeen.updateMany({
      where: { userEmail, folderId },
      data: { watchedThrough: null },
    });
  }

  return NextResponse.json({ ok: true, markedCount: folderVideos.length });
}
