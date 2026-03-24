import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { countVideosSince, getLatestVideoModifiedTime } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const userEmail = session.user.email;
  const accessToken = session.accessToken;

  const folders = await db.configuredFolder.findMany();
  if (folders.length === 0) {
    return NextResponse.json({ notifications: [] });
  }

  const folderIds = folders.map((f) => f.folderId);
  const baselines = await db.userNotificationBaseline.findMany({
    where: { userEmail, folderId: { in: folderIds } },
  });
  const baselineMap = new Map(baselines.map((b) => [b.folderId, b.baselineDate]));

  const notifications: Array<{ folderId: string; folderName: string; newCount: number }> = [];

  await Promise.all(
    folders.map(async (folder) => {
      try {
        const baseline = baselineMap.get(folder.folderId);

        if (!baseline) {
          // First visit — initialize baseline to current latest, show 0 new
          const latestTime = await getLatestVideoModifiedTime(accessToken, folder.folderId);
          if (latestTime) {
            await db.userNotificationBaseline.create({
              data: {
                userEmail,
                folderId: folder.folderId,
                baselineDate: new Date(latestTime),
              },
            });
          }
          return;
        }

        const newCount = await countVideosSince(accessToken, folder.folderId, baseline);
        if (newCount > 0) {
          notifications.push({
            folderId: folder.folderId,
            folderName: folder.name ?? folder.folderId,
            newCount,
          });
        }
      } catch {
        // Skip folders that fail
      }
    }),
  );

  return NextResponse.json({ notifications });
}
