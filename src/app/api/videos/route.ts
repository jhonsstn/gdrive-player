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
      const videos = pageVideos.map((video) => ({ ...video, sourceUrl: folder.sourceUrl }));
      return NextResponse.json({ videos, sort: sortDirection, nextPageToken });
    }

    const groupedVideos = await Promise.all(
      folders.map(async (folder) => ({
        folder,
        videos: await listFolderVideos(accessToken, folder.folderId),
      })),
    );

    const videos = sortByNaturalName(
      groupedVideos
        .flatMap(({ folder, videos }) =>
          videos.map((video) => ({
            ...video,
            sourceUrl: folder.sourceUrl,
          })),
        )
        .filter((video) => isAllowedVideoMimeType(video.mimeType)),
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
