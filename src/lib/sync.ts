import { db } from "@/lib/db";
import { listFolderVideos } from "@/lib/drive";

export async function syncFolderVideos(accessToken: string, folderId: string): Promise<number> {
  const driveVideos = await listFolderVideos(accessToken, folderId);

  // Upsert all current videos in batches of 100
  for (let i = 0; i < driveVideos.length; i += 100) {
    const batch = driveVideos.slice(i, i + 100);
    await db.$transaction(
      batch.map((v) =>
        db.folderVideo.upsert({
          where: { folderId_driveFileId: { folderId, driveFileId: v.id } },
          create: {
            folderId,
            driveFileId: v.id,
            name: v.name,
            mimeType: v.mimeType,
            size: v.size,
            modifiedTime: v.modifiedTime ? new Date(v.modifiedTime) : null,
          },
          update: {
            name: v.name,
            mimeType: v.mimeType,
            size: v.size,
            modifiedTime: v.modifiedTime ? new Date(v.modifiedTime) : null,
          },
        }),
      ),
    );
  }

  // Delete videos no longer in Drive
  const driveIds = driveVideos.map((v) => v.id);
  await db.folderVideo.deleteMany({
    where: { folderId, driveFileId: { notIn: driveIds } },
  });

  return driveVideos.length;
}
