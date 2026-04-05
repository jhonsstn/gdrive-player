import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const folders = await db.configuredFolder.findMany({
    where: { archived: false },
    select: { id: true, folderId: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ folders }, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}
