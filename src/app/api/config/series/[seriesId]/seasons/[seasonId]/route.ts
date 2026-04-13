import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";

type RouteParams = { params: Promise<{ seriesId: string; seasonId: string }> };

async function ensureAdmin(): Promise<NextResponse | void> {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const { seriesId, seasonId } = await params;

  let body: { seasonNumber?: number };

  try {
    body = (await request.json()) as { seasonNumber?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.seasonNumber !== "number" || !Number.isInteger(body.seasonNumber) || body.seasonNumber < 1) {
    return NextResponse.json({ error: "seasonNumber must be a positive integer" }, { status: 400 });
  }

  try {
    const season = await db.season.update({
      where: { id: seasonId, seriesId },
      data: { seasonNumber: body.seasonNumber },
    });

    return NextResponse.json({ season });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Season not found" }, { status: 404 });
      }

      if (error.code === "P2002") {
        return NextResponse.json({ error: "Season number already used in this series" }, { status: 409 });
      }
    }

    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const { seriesId, seasonId } = await params;

  try {
    await db.season.delete({ where: { id: seasonId, seriesId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    throw error;
  }
}
