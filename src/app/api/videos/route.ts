import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DriveRequestError, listFolderVideos } from "@/lib/drive";
import { isAllowedVideoMimeType } from "@/lib/video-mime";
import { parseSortDirection, sortByNaturalName } from "@/lib/sort";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Missing Google Drive access token" },
      { status: 401 },
    );
  }

  const accessToken = session.accessToken;
  const sortDirection = parseSortDirection(
    new URL(request.url).searchParams.get("sort"),
  );

  const folders = await db.configuredFolder.findMany({
    orderBy: { createdAt: "asc" },
  });

  try {
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
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    throw error;
  }
}
