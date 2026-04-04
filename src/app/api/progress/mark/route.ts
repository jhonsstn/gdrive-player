import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { videoId, watched, folderId, videoName, videoModifiedTime } = body as {
    videoId?: string;
    watched?: boolean;
    folderId?: string;
    videoName?: string;
    videoModifiedTime?: string;
  };

  if (!videoId || typeof watched !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userEmail = session.user.email;
  
  const existing = await db.watchProgress.findUnique({
    where: {
      userEmail_videoId: { userEmail, videoId },
    },
  });

  const duration = existing?.duration || 1;
  const currentTime = watched ? duration : 0;

  await db.watchProgress.upsert({
    where: {
      userEmail_videoId: { userEmail, videoId },
    },
    create: {
      userEmail,
      videoId,
      currentTime,
      duration,
      watched,
      folderId: folderId ?? null,
      videoName: videoName ?? null,
    },
    update: {
      currentTime,
      watched,
      ...(folderId ? { folderId } : {}),
      ...(videoName ? { videoName } : {}),
    },
  });

  if (watched && folderId && videoModifiedTime) {
    const newWatchedDate = new Date(videoModifiedTime);
    if (!isNaN(newWatchedDate.getTime())) {
      const existingLastSeen = await db.userFolderLastSeen.findUnique({
        where: { userEmail_folderId: { userEmail, folderId } },
      });
      if (!existingLastSeen?.watchedThrough || newWatchedDate > existingLastSeen.watchedThrough) {
        await db.userFolderLastSeen.upsert({
          where: { userEmail_folderId: { userEmail, folderId } },
          create: {
            userEmail,
            folderId,
            lastSeenDate: newWatchedDate,
            watchedThrough: newWatchedDate,
          },
          update: { watchedThrough: newWatchedDate },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, watched });
}
