import { db } from "@/lib/db";
import { listFolderVideos } from "@/lib/drive";

const SYNC_FRESHNESS_MS = 2 * 60 * 1000; // 2 minutes

export async function syncFolderVideos(
  accessToken: string,
  folderId: string,
  options?: { skipFreshnessCheck?: boolean },
): Promise<number> {
  // Skip sync if folder was synced recently
  if (!options?.skipFreshnessCheck) {
    const latest = await db.folderVideo.findFirst({
      where: { folderId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    if (latest && Date.now() - latest.updatedAt.getTime() < SYNC_FRESHNESS_MS) {
      const count = await db.folderVideo.count({ where: { folderId } });
      return count;
    }
  }

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

type SyncResult = { folderId: string; success: boolean; count?: number; error?: string };

export async function syncAllFolders(
  accessToken: string,
  folderIds: string[],
  concurrency = 5,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (let i = 0; i < folderIds.length; i += concurrency) {
    const chunk = folderIds.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      chunk.map((folderId) => syncFolderVideos(accessToken, folderId)),
    );
    for (let j = 0; j < chunk.length; j++) {
      const result = settled[j]!;
      if (result.status === "fulfilled") {
        results.push({ folderId: chunk[j]!, success: true, count: result.value });
      } else {
        results.push({ folderId: chunk[j]!, success: false, error: String(result.reason) });
      }
    }
  }

  return results;
}
