import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { syncFolderVideos } from "@/lib/sync";

export async function POST() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const folders = await db.configuredFolder.findMany({
    select: { folderId: true },
  });

  // Clean up old invalid progress rows that are blocking migration
  await db.watchProgress.deleteMany({
    where: { folderVideoId: null },
  });

  let totalSynced = 0;
  for (const folder of folders) {
    try {
      totalSynced += await syncFolderVideos(session.accessToken, folder.folderId);
    } catch (error) {
      console.error(`Failed to sync folder ${folder.folderId}:`, error);
    }
  }

  return NextResponse.json({ ok: true, count: totalSynced });
}
