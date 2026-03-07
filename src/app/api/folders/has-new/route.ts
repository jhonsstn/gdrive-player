import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getLatestVideoModifiedTime } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderIdsParam = searchParams.get("folderIds");
  if (!folderIdsParam) {
    return NextResponse.json({ error: "Missing folderIds" }, { status: 400 });
  }

  const folderIds = folderIdsParam.split(",").filter(Boolean);
  const userEmail = session.user.email;
  const accessToken = session.accessToken;

  const rows = await db.userFolderLastSeen.findMany({
    where: { userEmail, folderId: { in: folderIds } },
  });

  const lastSeenMap = new Map(rows.map((r) => [r.folderId, r.lastSeenDate]));

  const results = await Promise.all(
    folderIds.map(async (folderId) => {
      try {
        const latestTime = await getLatestVideoModifiedTime(accessToken, folderId);
        if (!latestTime) return [folderId, false] as const;

        const lastSeen = lastSeenMap.get(folderId);
        if (!lastSeen) return [folderId, true] as const;

        return [folderId, new Date(latestTime) > lastSeen] as const;
      } catch {
        return [folderId, false] as const;
      }
    }),
  );

  const hasNew: Record<string, boolean> = Object.fromEntries(results);
  return NextResponse.json({ hasNew });
}
