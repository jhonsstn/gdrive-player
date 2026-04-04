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

  const lastSeenMap = new Map(rows.map((r) => [r.folderId, r]));

  const results = await Promise.all(
    folderIds.map(async (folderId) => {
      try {
        const latestTime = await getLatestVideoModifiedTime(accessToken, folderId);
        if (!latestTime) return [folderId, { hasNew: false, hasNotSeen: false, isEmpty: true }] as const;

        const row = lastSeenMap.get(folderId);
        const latestDate = new Date(latestTime);

        const hasNew = !row ? true : latestDate > row.lastSeenDate;
        const hasNotSeen = !row?.watchedThrough ? true : latestDate > row.watchedThrough;

        return [folderId, { hasNew, hasNotSeen, isEmpty: false }] as const;
      } catch {
        return [folderId, { hasNew: false, hasNotSeen: false, isEmpty: false }] as const;
      }
    }),
  );

  const hasNew: Record<string, boolean> = {};
  const hasNotSeen: Record<string, boolean> = {};
  const isEmpty: Record<string, boolean> = {};
  for (const [folderId, { hasNew: n, hasNotSeen: s, isEmpty: e }] of results) {
    hasNew[folderId] = n;
    hasNotSeen[folderId] = s;
    isEmpty[folderId] = e;
  }

  return NextResponse.json({ hasNew, hasNotSeen, isEmpty });
}
