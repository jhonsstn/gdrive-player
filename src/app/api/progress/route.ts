import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const videoIds = searchParams.get("videoIds");
  if (!videoIds) {
    return NextResponse.json({ error: "Missing videoIds" }, { status: 400 });
  }

  const ids = videoIds.split(",").filter(Boolean);
  const rows = await db.watchProgress.findMany({
    where: { userEmail: session.user.email, videoId: { in: ids } },
  });

  const progress: Record<string, { currentTime: number; duration: number; watched: boolean }> = {};
  for (const row of rows) {
    progress[row.videoId] = {
      currentTime: row.currentTime,
      duration: row.duration,
      watched: row.watched,
    };
  }

  return NextResponse.json({ progress }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { videoId, currentTime, duration, folderId, videoName } = body as {
    videoId?: string;
    currentTime?: number;
    duration?: number;
    folderId?: string;
    videoName?: string;
  };

  if (!videoId || currentTime == null || !duration || duration <= 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const watched = currentTime / duration >= 0.9;

  await db.watchProgress.upsert({
    where: {
      userEmail_videoId: {
        userEmail: session.user.email,
        videoId,
      },
    },
    create: {
      userEmail: session.user.email,
      videoId,
      currentTime,
      duration,
      watched,
      folderId: folderId ?? null,
      videoName: videoName ?? null,
    },
    update: {
      currentTime,
      duration,
      watched,
      ...(folderId ? { folderId } : {}),
      ...(videoName ? { videoName } : {}),
    },
  });

  return NextResponse.json({ ok: true, watched });
}

// sendBeacon only sends POST requests
export { PUT as POST };
