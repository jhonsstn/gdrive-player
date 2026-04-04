import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listFolderVideos } from "@/lib/drive";

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing Google Drive access token" }, { status: 401 });
  }

  const body = await request.json();
  const { folderId, watched } = body as { folderId?: string; watched?: boolean };

  if (!folderId || typeof watched !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const videos = await listFolderVideos(session.accessToken, folderId);
  const userEmail = session.user.email;

  const tx = videos.map(v => db.watchProgress.upsert({
    where: {
      userEmail_videoId: { userEmail, videoId: v.id }
    },
    create: {
      userEmail,
      videoId: v.id,
      currentTime: watched ? 1 : 0,
      duration: 1,
      watched,
      folderId,
      videoName: v.name,
    },
    update: {
      currentTime: watched ? 1 : 0,
      watched,
      folderId,
      videoName: v.name,
    }
  }));

  // Chunk to avoid Prisma limit
  for (let i = 0; i < tx.length; i += 100) {
    await db.$transaction(tx.slice(i, i + 100));
  }

  if (watched) {
    let latestModified = new Date(0);
    for (const v of videos) {
      if (v.modifiedTime) {
        const d = new Date(v.modifiedTime);
        if (!isNaN(d.getTime()) && d > latestModified) {
          latestModified = d;
        }
      }
    }
    
    if (latestModified.getTime() > 0) {
      const existingLastSeen = await db.userFolderLastSeen.findUnique({
        where: { userEmail_folderId: { userEmail, folderId } },
      });
      if (!existingLastSeen?.watchedThrough || latestModified > existingLastSeen.watchedThrough) {
        await db.userFolderLastSeen.upsert({
          where: { userEmail_folderId: { userEmail, folderId } },
          create: {
            userEmail,
            folderId,
            lastSeenDate: latestModified,
            watchedThrough: latestModified,
          },
          update: { watchedThrough: latestModified },
        });
      }
    }
  } else {
    await db.userFolderLastSeen.updateMany({
      where: { userEmail, folderId },
      data: { watchedThrough: null },
    });
  }

  return NextResponse.json({ ok: true, markedCount: videos.length });
}
