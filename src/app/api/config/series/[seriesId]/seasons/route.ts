import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";

type RouteParams = { params: Promise<{ seriesId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { seriesId } = await params;

  let body: { folderId?: string; seasonNumber?: number };

  try {
    body = (await request.json()) as { folderId?: string; seasonNumber?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.folderId?.trim()) {
    return NextResponse.json({ error: "folderId is required" }, { status: 400 });
  }

  if (typeof body.seasonNumber !== "number" || !Number.isInteger(body.seasonNumber) || body.seasonNumber < 1) {
    return NextResponse.json({ error: "seasonNumber must be a positive integer" }, { status: 400 });
  }

  const series = await db.series.findUnique({ where: { id: seriesId } });

  if (!series) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  // Verify the folder exists as a ConfiguredFolder
  const folder = await db.configuredFolder.findFirst({ where: { folderId: body.folderId } });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  try {
    const season = await db.season.create({
      data: {
        seriesId,
        folderId: body.folderId,
        seasonNumber: body.seasonNumber,
      },
    });

    return NextResponse.json({ season }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Folder already in a series or season number already used" },
        { status: 409 },
      );
    }

    throw error;
  }
}
