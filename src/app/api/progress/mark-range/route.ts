import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sortByNaturalName, type SortDirection } from "@/lib/sort";

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { anchorFolderVideoId, direction, watched, sort } = body as {
    anchorFolderVideoId?: string;
    direction?: "above" | "below";
    watched?: boolean;
    sort?: SortDirection;
  };

  if (
    typeof anchorFolderVideoId !== "string" ||
    (direction !== "above" && direction !== "below") ||
    typeof watched !== "boolean" ||
    (sort !== "asc" && sort !== "desc")
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userEmail = session.user.email;

  // 1. Look up the anchor video to get the folderId
  const anchor = await db.folderVideo.findUnique({
    where: { id: anchorFolderVideoId },
    select: { id: true, folderId: true, name: true },
  });

  if (!anchor) {
    return NextResponse.json({ error: "Anchor video not found" }, { status: 404 });
  }

  // 2. Get all videos in the same folder
  const allVideos = await db.folderVideo.findMany({
    where: { folderId: anchor.folderId },
    select: { id: true, name: true, modifiedTime: true },
  });

  // 3. Sort them the same way the client does
  const sorted = sortByNaturalName(allVideos, sort);

  // 4. Find the anchor index and slice above/below
  const anchorIdx = sorted.findIndex((v) => v.id === anchor.id);
  if (anchorIdx < 0) {
    return NextResponse.json({ error: "Anchor not found in folder" }, { status: 404 });
  }

  const slice = direction === "above" ? sorted.slice(0, anchorIdx) : sorted.slice(anchorIdx + 1);
  const folderVideoIds = slice.map((v) => v.id);

  if (folderVideoIds.length === 0) {
    return NextResponse.json({ ok: true, markedCount: 0 });
  }

  // 5. Bulk upsert WatchProgress
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

  // 6. Update UserFolderLastSeen when marking as watched
  if (watched) {
    const modifiedTimes = slice
      .map((v) => v.modifiedTime)
      .filter((t): t is Date => t !== null);

    if (modifiedTimes.length > 0) {
      const latestModified = modifiedTimes.reduce((a, b) => (a > b ? a : b));

      const existingLastSeen = await db.userFolderLastSeen.findUnique({
        where: { userEmail_folderId: { userEmail, folderId: anchor.folderId } },
      });
      if (!existingLastSeen?.watchedThrough || latestModified > existingLastSeen.watchedThrough) {
        await db.userFolderLastSeen.upsert({
          where: { userEmail_folderId: { userEmail, folderId: anchor.folderId } },
          create: { userEmail, folderId: anchor.folderId, lastSeenDate: latestModified, watchedThrough: latestModified },
          update: { lastSeenDate: latestModified, watchedThrough: latestModified },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, markedCount: folderVideoIds.length });
}
