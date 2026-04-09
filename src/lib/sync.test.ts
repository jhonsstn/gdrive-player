import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  count: vi.fn(),
  upsert: vi.fn(),
  folderVideoDeleteMany: vi.fn(),
  transaction: vi.fn(),
  listFolderVideos: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    folderVideo: {
      findFirst: mocks.findFirst,
      count: mocks.count,
      upsert: mocks.upsert,
      deleteMany: mocks.folderVideoDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/drive", () => ({
  listFolderVideos: mocks.listFolderVideos,
}));

import { syncAllFolders, syncFolderVideos } from "@/lib/sync";

describe("syncFolderVideos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    mocks.upsert.mockResolvedValue({});
    mocks.folderVideoDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("returns cached count when folder was synced recently", async () => {
    mocks.findFirst.mockResolvedValue({ updatedAt: new Date(Date.now() - 30_000) }); // 30s ago
    mocks.count.mockResolvedValue(5);

    const count = await syncFolderVideos("token", "folder1");

    expect(count).toBe(5);
    expect(mocks.listFolderVideos).not.toHaveBeenCalled();
  });

  it("syncs when folder data is stale (older than 2 minutes)", async () => {
    mocks.findFirst.mockResolvedValue({ updatedAt: new Date(Date.now() - 5 * 60 * 1000) }); // 5min ago
    mocks.listFolderVideos.mockResolvedValue([
      { id: "v1", name: "video.mp4", mimeType: "video/mp4", size: "1000", modifiedTime: "2024-01-01T00:00:00Z" },
    ]);

    const count = await syncFolderVideos("token", "folder2");

    expect(count).toBe(1);
    expect(mocks.listFolderVideos).toHaveBeenCalledWith("token", "folder2");
  });

  it("skips freshness check when skipFreshnessCheck is true", async () => {
    mocks.listFolderVideos.mockResolvedValue([]);

    await syncFolderVideos("token", "folder3", { skipFreshnessCheck: true });

    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.listFolderVideos).toHaveBeenCalledWith("token", "folder3");
  });

  it("syncs when no videos exist yet (findFirst returns null)", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.listFolderVideos.mockResolvedValue([
      { id: "v1", name: "a.mp4", mimeType: "video/mp4", size: null, modifiedTime: null },
      { id: "v2", name: "b.mp4", mimeType: "video/mp4", size: "500", modifiedTime: "2024-01-01T00:00:00Z" },
    ]);

    const count = await syncFolderVideos("token", "folder4");

    expect(count).toBe(2);
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.folderVideoDeleteMany).toHaveBeenCalledWith({
      where: { folderId: "folder4", driveFileId: { notIn: ["v1", "v2"] } },
    });
  });

  it("deletes videos that are no longer in Drive", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.listFolderVideos.mockResolvedValue([
      { id: "v2", name: "kept.mp4", mimeType: "video/mp4", size: null, modifiedTime: null },
    ]);

    await syncFolderVideos("token", "folder5");

    expect(mocks.folderVideoDeleteMany).toHaveBeenCalledWith({
      where: { folderId: "folder5", driveFileId: { notIn: ["v2"] } },
    });
  });

  it("upserts videos with null modifiedTime correctly", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.listFolderVideos.mockResolvedValue([
      { id: "v1", name: "video.mp4", mimeType: "video/mp4", size: null, modifiedTime: null },
    ]);

    await syncFolderVideos("token", "folder6");

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ modifiedTime: null }),
        update: expect.objectContaining({ modifiedTime: null }),
      }),
    );
  });
});

describe("syncAllFolders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    mocks.upsert.mockResolvedValue({});
    mocks.folderVideoDeleteMany.mockResolvedValue({ count: 0 });
    mocks.findFirst.mockResolvedValue(null);
  });

  it("returns success results for all folders", async () => {
    mocks.listFolderVideos.mockResolvedValue([]);

    const results = await syncAllFolders("token", ["f1", "f2"]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ folderId: "f1", success: true, count: 0 });
    expect(results[1]).toMatchObject({ folderId: "f2", success: true, count: 0 });
  });

  it("reports failure for folders that throw", async () => {
    mocks.listFolderVideos
      .mockRejectedValueOnce(new Error("Drive error"))
      .mockResolvedValue([]);

    const results = await syncAllFolders("token", ["bad-folder", "good-folder"]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ folderId: "bad-folder", success: false, error: expect.stringContaining("Drive error") });
    expect(results[1]).toMatchObject({ folderId: "good-folder", success: true });
  });

  it("processes folders in concurrent chunks", async () => {
    mocks.listFolderVideos.mockResolvedValue([]);

    const results = await syncAllFolders("token", ["f1", "f2", "f3", "f4", "f5", "f6"], 3);

    expect(results).toHaveLength(6);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("returns empty array for empty folder list", async () => {
    const results = await syncAllFolders("token", []);
    expect(results).toEqual([]);
  });
});
