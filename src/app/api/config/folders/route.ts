import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { DriveRequestError, getFolderName, listFolderVideos } from "@/lib/drive";
import { parseDriveFolderId } from "@/lib/drive-url";
import { matchMigrationVideos, type MigrationVideo } from "@/lib/folder-migration";
import { syncFolderVideos } from "@/lib/sync";

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

type FolderUpdateBody = {
  id?: string;
  archived?: boolean;
  name?: string;
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

    // Sync videos in the background — non-fatal if it fails
    if (session.accessToken) {
      syncFolderVideos(session.accessToken, folderId).catch(() => {
        // Ignore sync errors; admin can manually re-sync
      });
    }

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
    return NextResponse.json({ error: "New URL points to the same folder" }, { status: 400 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing Google Drive access token" }, { status: 401 });
  }

  try {
    const oldFolderId = existing.folderId;
    // Inspect both folders before changing anything. A migration must never
    // report success if it cannot determine how existing history maps.
    const [name, oldDriveVideos, newDriveVideos, oldCatalog] = await Promise.all([
      getFolderName(session.accessToken, newFolderId),
      listFolderVideos(session.accessToken, oldFolderId),
      listFolderVideos(session.accessToken, newFolderId),
      db.folderVideo.findMany({
        where: { folderId: oldFolderId },
        include: { _count: { select: { watchProgress: true } } },
      }),
    ]);

    const oldDriveById = new Map(oldDriveVideos.map((video) => [video.id, video]));
    const sourceVideos: MigrationVideo[] = oldCatalog.map((video) => {
      const driveVideo = oldDriveById.get(video.driveFileId);
      return {
        id: video.driveFileId,
        name: driveVideo?.name ?? video.name,
        mimeType: driveVideo?.mimeType ?? video.mimeType,
        size: driveVideo?.size ?? video.size,
        md5Checksum: driveVideo?.md5Checksum ?? null,
        sha1Checksum: driveVideo?.sha1Checksum ?? null,
        sha256Checksum: driveVideo?.sha256Checksum ?? null,
      };
    });

    const migration = matchMigrationVideos(sourceVideos, newDriveVideos);
    const catalogByDriveId = new Map(oldCatalog.map((video) => [video.driveFileId, video]));
    const unmatchedWithHistory = migration.unmatchedOld.filter(
      (video) => (catalogByDriveId.get(video.id)?._count.watchProgress ?? 0) > 0,
    );

    if (unmatchedWithHistory.length > 0) {
      return NextResponse.json(
        {
          error:
            "Migration stopped because some videos with watch history could not be matched safely.",
          migration: {
            matched: migration.matches.length,
            unmatchedWithHistory: unmatchedWithHistory.length,
            videos: unmatchedWithHistory.slice(0, 20).map((video) => video.name),
          },
        },
        { status: 409 },
      );
    }

    const matchedOldIds = new Set(migration.matches.map((match) => match.oldVideo.id));
    const removableCatalogIds = oldCatalog
      .filter((video) => !matchedOldIds.has(video.driveFileId))
      .map((video) => video.id);

    const folderVideoUpdates = migration.matches.map((match) => {
      const catalogVideo = catalogByDriveId.get(match.oldVideo.id)!;
      return db.folderVideo.update({
        where: { id: catalogVideo.id },
        data: {
          folderId: newFolderId,
          driveFileId: match.newVideo.id,
          name: match.newVideo.name,
          mimeType: match.newVideo.mimeType,
          size: match.newVideo.size,
          modifiedTime: match.newVideo.modifiedTime ? new Date(match.newVideo.modifiedTime) : null,
        },
      });
    });

    const newFolderVideos = migration.unmatchedNew.map((video) =>
      db.folderVideo.create({
        data: {
          folderId: newFolderId,
          driveFileId: video.id,
          name: video.name,
          mimeType: video.mimeType,
          size: video.size,
          modifiedTime: video.modifiedTime ? new Date(video.modifiedTime) : null,
        },
      }),
    );

    const [updated] = await db.$transaction([
      db.configuredFolder.update({
        where: { id: body.id },
        data: { folderId: newFolderId, sourceUrl: body.sourceUrl, name },
      }),
      db.season.updateMany({
        where: { folderId: oldFolderId },
        data: { folderId: newFolderId },
      }),
      db.userFolderLastSeen.updateMany({
        where: { folderId: oldFolderId },
        data: { folderId: newFolderId },
      }),
      ...folderVideoUpdates,
      db.folderVideo.deleteMany({ where: { id: { in: removableCatalogIds } } }),
      ...newFolderVideos,
    ]);

    return NextResponse.json({
      folder: updated,
      migration: {
        matched: migration.matches.length,
        added: migration.unmatchedNew.length,
        removed: removableCatalogIds.length,
      },
    });
  } catch (error) {
    if (error instanceof DriveRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Target folder already configured" }, { status: 409 });
    }

    throw error;
  }
}

export async function PUT(request: Request) {
  const result = await ensureAdmin();
  if (result instanceof NextResponse) {
    return result;
  }

  let body: FolderUpdateBody;

  try {
    body = (await request.json()) as FolderUpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: { archived?: boolean; name?: string } = {};

  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "archived must be a boolean" }, { status: 400 });
    }
    data.archived = body.archived;
  }

  if (body.name !== undefined) {
    const trimmed = typeof body.name === "string" ? body.name.trim() : "";
    if (!trimmed) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    data.name = trimmed;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "archived or name is required" }, { status: 400 });
  }

  try {
    const updated = await db.configuredFolder.update({
      where: { id: body.id },
      data,
    });

    return NextResponse.json({ folder: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
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
    const folder = await db.configuredFolder.findUnique({ where: { id: body.id } });

    if (folder) {
      // Delete FolderVideo rows (WatchProgress cascades via FK)
      await db.folderVideo.deleteMany({ where: { folderId: folder.folderId } });
    }

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
