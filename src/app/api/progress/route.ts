import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderVideoIds = searchParams.get("folderVideoIds");
  if (!folderVideoIds) {
    return NextResponse.json({ error: "Missing folderVideoIds" }, { status: 400 });
  }

  const ids = folderVideoIds.split(",").filter(Boolean);
  const rows = await db.watchProgress.findMany({
    where: { userEmail: session.user.email, folderVideoId: { in: ids } },
  });

  const progress: Record<string, { currentTime: number; duration: number; watched: boolean }> = {};
  for (const row of rows) {
    progress[row.folderVideoId] = {
      currentTime: row.currentTime,
      duration: row.duration,
      watched: row.watched,
    };
  }

  return NextResponse.json({ progress });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { folderVideoId, currentTime, duration } = body as {
    folderVideoId?: string;
    currentTime?: number;
    duration?: number;
  };

  if (!folderVideoId || currentTime == null || !duration || duration <= 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userEmail = session.user.email;
  const watched = currentTime / duration >= 0.9;

  await db.watchProgress.upsert({
    where: { userEmail_folderVideoId: { userEmail, folderVideoId } },
    create: { userEmail, folderVideoId, currentTime, duration, watched },
    update: { currentTime, duration, watched },
  });

  // When watched, advance watchedThrough for the folder
  if (watched) {
    const fv = await db.folderVideo.findUnique({
      where: { id: folderVideoId },
      select: { folderId: true, modifiedTime: true },
    });
    if (fv?.folderId && fv.modifiedTime) {
      const existing = await db.userFolderLastSeen.findUnique({
        where: { userEmail_folderId: { userEmail, folderId: fv.folderId } },
      });
      if (!existing?.watchedThrough || fv.modifiedTime > existing.watchedThrough) {
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

// sendBeacon only sends POST requests
export { PUT as POST };
