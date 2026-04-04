import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DriveRequestError, listFolderVideos, listFolderVideosPage } from "@/lib/drive";
import { isAllowedVideoMimeType } from "@/lib/video-mime";
import { parseSortDirection, sortByNaturalName } from "@/lib/sort";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing Google Drive access token" }, { status: 401 });
  }

  const accessToken = session.accessToken;
  const url = new URL(request.url);
  const sortDirection = parseSortDirection(url.searchParams.get("sort"));
  const filterFolderId = url.searchParams.get("folderId");
  const pageToken = url.searchParams.get("pageToken") ?? undefined;
  const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? 50), 200);

  const folders = filterFolderId
    ? await db.configuredFolder.findMany({
        where: { folderId: filterFolderId },
        orderBy: { createdAt: "asc" },
      })
    : await db.configuredFolder.findMany({
        orderBy: { createdAt: "asc" },
      });

  try {
    if (filterFolderId && folders.length === 1) {
      const folder = folders[0]!;
      const { videos: pageVideos, nextPageToken } = await listFolderVideosPage(
        accessToken,
        folder.folderId,
        { pageToken, pageSize, sortDirection },
      );

      const driveFileIds = pageVideos.map((v) => v.id);
      const folderVideoRows = await db.folderVideo.findMany({
        where: { folderId: folder.folderId, driveFileId: { in: driveFileIds } },
        select: { id: true, driveFileId: true },
      });
      const folderVideoMap = new Map(folderVideoRows.map((fv) => [fv.driveFileId, fv.id]));

      const videos = pageVideos.map((video) => ({
        ...video,
        folderId: folder.folderId,
        sourceUrl: folder.sourceUrl,
        folderVideoId: folderVideoMap.get(video.id) ?? null,
      }));
      return NextResponse.json({ videos, sort: sortDirection, nextPageToken });
    }

    const groupedVideos = await Promise.all(
      folders.map(async (folder) => ({
        folder,
        videos: await listFolderVideos(accessToken, folder.folderId),
      })),
    );

    const allDriveVideos = groupedVideos.flatMap(({ folder, videos }) =>
      videos
        .filter((video) => isAllowedVideoMimeType(video.mimeType))
        .map((video) => ({ ...video, folderId: folder.folderId, sourceUrl: folder.sourceUrl })),
    );

    // Batch lookup folderVideoId for all videos
    const lookups = await Promise.all(
      folders.map((folder) =>
        db.folderVideo.findMany({
          where: { folderId: folder.folderId },
          select: { id: true, driveFileId: true },
        }),
      ),
    );
    const folderVideoMap = new Map(lookups.flat().map((fv) => [fv.driveFileId, fv.id]));

    const videos = sortByNaturalName(
      allDriveVideos.map((video) => ({
        ...video,
        folderVideoId: folderVideoMap.get(video.id) ?? null,
      })),
      sortDirection,
    );

    return NextResponse.json({ videos, sort: sortDirection });
  } catch (error) {
    if (error instanceof DriveRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
