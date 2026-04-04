import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { getFolderName } from "@/lib/drive";
import { parseDriveFolderId } from "@/lib/drive-url";

type FolderCreateBody = {
  sourceUrl?: string;
};

type FolderDeleteBody = {
  id?: string;
};

type FolderMigrateBody = {
  id?: string;
  sourceUrl?: string;
};

type AdminSession = Awaited<ReturnType<typeof auth>> & { accessToken: string };

async function ensureAdmin(): Promise<NextResponse | AdminSession> {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return session as unknown as AdminSession;
}

export async function GET() {
  const result = await ensureAdmin();
  if (result instanceof NextResponse) {
    return result;
  }

  const folders = await db.configuredFolder.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  const result = await ensureAdmin();
  if (result instanceof NextResponse) {
    return result;
  }

  const session = result;

  let body: FolderCreateBody;

  try {
    body = (await request.json()) as FolderCreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sourceUrl?.trim()) {
    return NextResponse.json({ error: "sourceUrl is required" }, { status: 400 });
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

  let name: string | null = null;

  if (session.accessToken) {
    try {
      name = await getFolderName(session.accessToken, folderId);
    } catch {
      // Non-fatal — folder will be created without a name.
    }
  }

  try {
    const created = await db.configuredFolder.create({
      data: {
        sourceUrl: body.sourceUrl,
        folderId,
        name,
      },
    });

    return NextResponse.json({ folder: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Folder already configured" }, { status: 409 });
    }

    throw error;
  }
}

export async function PATCH(request: Request) {
  const result = await ensureAdmin();
  if (result instanceof NextResponse) {
    return result;
  }

  const session = result;

  let body: FolderMigrateBody;

  try {
    body = (await request.json()) as FolderMigrateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (!body.sourceUrl?.trim()) {
    return NextResponse.json({ error: "sourceUrl is required" }, { status: 400 });
  }

  let newFolderId: string;

  try {
    newFolderId = parseDriveFolderId(body.sourceUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid Google Drive folder URL or folder ID" },
      { status: 400 },
    );
  }

  const existing = await db.configuredFolder.findUnique({ where: { id: body.id } });

  if (!existing) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (existing.folderId === newFolderId) {
    return NextResponse.json(
      { error: "New URL points to the same folder" },
      { status: 400 },
    );
  }

  let name: string | null = null;

  if (session.accessToken) {
    try {
      name = await getFolderName(session.accessToken, newFolderId);
    } catch {
      // Non-fatal — folder will be updated without a new name.
    }
  }

  try {
    const oldFolderId = existing.folderId;

    const [updated] = await db.$transaction([
      db.configuredFolder.update({
        where: { id: body.id },
        data: { folderId: newFolderId, sourceUrl: body.sourceUrl, name },
      }),
      db.watchProgress.updateMany({
        where: { folderId: oldFolderId },
        data: { folderId: newFolderId },
      }),
      db.userFolderLastSeen.updateMany({
        where: { folderId: oldFolderId },
        data: { folderId: newFolderId },
      }),
    ]);

    return NextResponse.json({ folder: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Target folder already configured" }, { status: 409 });
    }

    throw error;
  }
}

export async function DELETE(request: Request) {
  const result = await ensureAdmin();
  if (result instanceof NextResponse) {
    return result;
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    throw error;
  }
}
