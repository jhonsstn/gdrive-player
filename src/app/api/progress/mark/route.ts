import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { folderVideoId, watched } = body as {
    folderVideoId?: string;
    watched?: boolean;
  };

  if (!folderVideoId || typeof watched !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userEmail = session.user.email;

  const existing = await db.watchProgress.findUnique({
    where: { userEmail_folderVideoId: { userEmail, folderVideoId } },
  });

  const duration = existing?.duration || 1;
  const currentTime = watched ? duration : 0;

  await db.watchProgress.upsert({
    where: { userEmail_folderVideoId: { userEmail, folderVideoId } },
    create: { userEmail, folderVideoId, currentTime, duration, watched },
    update: { currentTime, watched },
  });

  if (watched) {
    const fv = await db.folderVideo.findUnique({
      where: { id: folderVideoId },
      select: { folderId: true, modifiedTime: true },
    });
    if (fv?.folderId && fv.modifiedTime) {
      const existingLastSeen = await db.userFolderLastSeen.findUnique({
        where: { userEmail_folderId: { userEmail, folderId: fv.folderId } },
      });
      if (!existingLastSeen?.watchedThrough || fv.modifiedTime > existingLastSeen.watchedThrough) {
        await db.userFolderLastSeen.upsert({
          where: { userEmail_folderId: { userEmail, folderId: fv.folderId } },
          create: {
            userEmail,
            folderId: fv.folderId,
            lastSeenDate: fv.modifiedTime,
            watchedThrough: fv.modifiedTime,
          },
          update: { lastSeenDate: fv.modifiedTime, watchedThrough: fv.modifiedTime },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, watched });
}
