import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getLatestVideoModifiedTime } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const userEmail = session.user.email;
  const accessToken = session.accessToken;

  const body = (await request.json()) as { folderIds?: string[]; all?: boolean };

  let folderIds: string[];

  if (body.all) {
    const folders = await db.configuredFolder.findMany();
    folderIds = folders.map((f) => f.folderId);
  } else if (body.folderIds && body.folderIds.length > 0) {
    folderIds = body.folderIds;
  } else {
    return NextResponse.json({ error: "Missing folderIds or all flag" }, { status: 400 });
  }

  await Promise.all(
    folderIds.map(async (folderId) => {
      try {
        const latestTime = await getLatestVideoModifiedTime(accessToken, folderId);
        if (!latestTime) return;

        await db.userNotificationBaseline.upsert({
          where: { userEmail_folderId: { userEmail, folderId } },
          create: {
            userEmail,
            folderId,
            baselineDate: new Date(latestTime),
          },
          update: {
            baselineDate: new Date(latestTime),
          },
        });
      } catch {
        // Skip folders that fail
      }
    }),
  );

  return NextResponse.json({ cleared: true });
}
