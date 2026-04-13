import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";

type RouteParams = { params: Promise<{ seriesId: string }> };

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

  const { seriesId } = await params;

  let body: { name?: string };

  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const series = await db.series.update({
      where: { id: seriesId },
      data: { name },
    });

    return NextResponse.json({ series });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const { seriesId } = await params;

  try {
    await db.series.delete({ where: { id: seriesId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    throw error;
  }
}
