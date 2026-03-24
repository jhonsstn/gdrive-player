import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderIdsParam = searchParams.get("folderIds");
  if (!folderIdsParam) {
    return NextResponse.json({ error: "Missing folderIds" }, { status: 400 });
  }

  const folderIds = folderIdsParam.split(",").filter(Boolean);
  const userEmail = session.user.email;

  const rows = await db.userNotificationBaseline.findMany({
    where: { userEmail, folderId: { in: folderIds } },
  });

  const baselines: Record<string, string> = {};
  for (const row of rows) {
    baselines[row.folderId] = row.baselineDate.toISOString();
  }

  return NextResponse.json({ baselines });
}
