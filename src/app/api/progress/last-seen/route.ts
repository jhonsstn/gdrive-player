import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderIds = searchParams.get("folderIds");
  if (!folderIds) {
    return NextResponse.json({ error: "Missing folderIds" }, { status: 400 });
  }

  const ids = folderIds.split(",").filter(Boolean);
  const rows = await db.userFolderLastSeen.findMany({
    where: { userEmail: session.user.email, folderId: { in: ids } },
  });

  const lastSeen: Record<string, string> = {};
  for (const row of rows) {
    lastSeen[row.folderId] = row.lastSeenDate.toISOString();
  }

  return NextResponse.json({ lastSeen }, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { folderId, videoModifiedTime } = body as {
    folderId?: string;
    videoModifiedTime?: string;
  };

  if (!folderId || !videoModifiedTime) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const newDate = new Date(videoModifiedTime);
  if (isNaN(newDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const existing = await db.userFolderLastSeen.findUnique({
    where: {
      userEmail_folderId: {
        userEmail: session.user.email,
        folderId,
      },
    },
  });

  if (!existing || newDate > existing.lastSeenDate) {
    await db.userFolderLastSeen.upsert({
      where: {
        userEmail_folderId: {
          userEmail: session.user.email,
          folderId,
        },
      },
      create: {
        userEmail: session.user.email,
        folderId,
        lastSeenDate: newDate,
      },
      update: {
        lastSeenDate: newDate,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
