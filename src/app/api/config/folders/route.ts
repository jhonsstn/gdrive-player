import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { parseDriveFolderId } from "@/lib/drive-url";

type FolderCreateBody = {
  sourceUrl?: string;
};

type FolderDeleteBody = {
  id?: string;
};

async function ensureAdmin() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return null;
}

export async function GET() {
  const adminError = await ensureAdmin();
  if (adminError) {
    return adminError;
  }

  const folders = await db.configuredFolder.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  const adminError = await ensureAdmin();
  if (adminError) {
    return adminError;
  }

  let body: FolderCreateBody;

  try {
    body = (await request.json()) as FolderCreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sourceUrl?.trim()) {
    return NextResponse.json(
      { error: "sourceUrl is required" },
      { status: 400 },
    );
  }

  let folderId: string;

  try {
    folderId = parseDriveFolderId(body.sourceUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid Google Drive folder URL or folder ID" },
      { status: 400 },
    );
  }

  try {
    const created = await db.configuredFolder.create({
      data: {
        sourceUrl: body.sourceUrl,
        folderId,
      },
    });

    return NextResponse.json({ folder: created }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Folder already configured" },
        { status: 409 },
      );
    }

    throw error;
  }
}

export async function DELETE(request: Request) {
  const adminError = await ensureAdmin();
  if (adminError) {
    return adminError;
  }

  let body: FolderDeleteBody;

  try {
    body = (await request.json()) as FolderDeleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await db.configuredFolder.delete({
      where: { id: body.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    throw error;
  }
}
