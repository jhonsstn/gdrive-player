import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isAdminSession: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
  getFolderName: vi.fn(),
  listFolderVideos: vi.fn(),
  folderVideoFindMany: vi.fn(),
  folderVideoUpdate: vi.fn(),
  folderVideoCreate: vi.fn(),
  folderVideoDeleteMany: vi.fn(),
  seasonUpdateMany: vi.fn(),
  lastSeenUpdateMany: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/authz", () => ({
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    configuredFolder: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
      delete: mocks.delete,
    },
    folderVideo: {
      findMany: mocks.folderVideoFindMany,
      update: mocks.folderVideoUpdate,
      create: mocks.folderVideoCreate,
      deleteMany: mocks.folderVideoDeleteMany,
    },
    season: { updateMany: mocks.seasonUpdateMany },
    userFolderLastSeen: { updateMany: mocks.lastSeenUpdateMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/drive", () => ({
  getFolderName: mocks.getFolderName,
  listFolderVideos: mocks.listFolderVideos,
  DriveRequestError: class DriveRequestError extends Error {
    constructor(
      message: string,
      public readonly status: number,
    ) {
      super(message);
    }
  },
}));

import { Prisma } from "@prisma/client";
import { DriveRequestError } from "@/lib/drive";
import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/config/folders/route";

describe("/api/config/folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listFolderVideos.mockResolvedValue([]);
    mocks.folderVideoFindMany.mockResolvedValue([]);
    mocks.folderVideoUpdate.mockResolvedValue({});
    mocks.folderVideoCreate.mockResolvedValue({});
    mocks.folderVideoDeleteMany.mockResolvedValue({ count: 0 });
    mocks.seasonUpdateMany.mockResolvedValue({ count: 0 });
    mocks.lastSeenUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("returns 403 for non-admin users", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.isAdminSession.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("creates a folder with name for admin users", async () => {
    mocks.auth.mockResolvedValue({
      user: { email: "admin@example.com" },
      accessToken: "test-token",
    });
    mocks.isAdminSession.mockReturnValue(true);
    mocks.getFolderName.mockResolvedValue("My Videos Folder");
    mocks.create.mockResolvedValue({
      id: "cfg_1",
      folderId: "1AbCdEfGhIjKlMnOpQr",
      name: "My Videos Folder",
      sourceUrl: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await POST(
      new Request("http://localhost/api/config/folders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.getFolderName).toHaveBeenCalledWith("test-token", "1AbCdEfGhIjKlMnOpQr");
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        sourceUrl: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr",
        folderId: "1AbCdEfGhIjKlMnOpQr",
        name: "My Videos Folder",
      },
    });
  });

  describe("PATCH /api/config/folders", () => {
    const adminSession = {
      user: { email: "admin@example.com" },
      accessToken: "test-token",
    };

    const existingFolder = {
      id: "cfg_1",
      folderId: "oldFolderDriveId",
      name: "Old Folder",
      sourceUrl: "https://drive.google.com/drive/folders/oldFolderDriveId",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newSourceUrl = "https://drive.google.com/drive/folders/newFolderDriveId";

    function makeRequest(body: unknown) {
      return new Request("http://localhost/api/config/folders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("returns 401 when not authenticated", async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await PATCH(makeRequest({ id: "cfg_1", sourceUrl: newSourceUrl }));

      expect(response.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
      mocks.isAdminSession.mockReturnValue(false);

      const response = await PATCH(makeRequest({ id: "cfg_1", sourceUrl: newSourceUrl }));

      expect(response.status).toBe(403);
    });

    it("returns 400 when id is missing", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);

      const response = await PATCH(makeRequest({ sourceUrl: newSourceUrl }));

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/id/i);
    });

    it("returns 400 when sourceUrl is missing", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);

      const response = await PATCH(makeRequest({ id: "cfg_1" }));

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/sourceUrl/i);
    });

    it("returns 400 for invalid Drive URL", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);

      const response = await PATCH(makeRequest({ id: "cfg_1", sourceUrl: "bad url !@#" }));

      expect(response.status).toBe(400);
    });

    it("returns 404 when folder not found", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue(null);

      const response = await PATCH(makeRequest({ id: "cfg_1", sourceUrl: newSourceUrl }));

      expect(response.status).toBe(404);
    });

    it("returns 400 when new URL points to the same folder", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue(existingFolder);

      const response = await PATCH(
        makeRequest({
          id: "cfg_1",
          sourceUrl: "https://drive.google.com/drive/folders/oldFolderDriveId",
        }),
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/same folder/i);
    });

    it("returns 409 when target folder is already configured", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue(existingFolder);
      mocks.getFolderName.mockResolvedValue("New Folder");
      const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "0.0.0",
      });
      mocks.transaction.mockRejectedValue(uniqueError);

      const response = await PATCH(makeRequest({ id: "cfg_1", sourceUrl: newSourceUrl }));

      expect(response.status).toBe(409);
    });

    it("migrates folder and updates all related records", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue(existingFolder);
      mocks.getFolderName.mockResolvedValue("New Folder");

      const updatedFolder = {
        ...existingFolder,
        folderId: "newFolderDriveId",
        sourceUrl: newSourceUrl,
        name: "New Folder",
      };

      mocks.transaction.mockImplementation(async (ops: unknown[]) => {
        return Promise.all(ops.map((op) => (op instanceof Promise ? op : Promise.resolve(op))));
      });
      mocks.update.mockResolvedValue(updatedFolder);

      const response = await PATCH(makeRequest({ id: "cfg_1", sourceUrl: newSourceUrl }));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { folder: typeof updatedFolder };
      expect(body.folder.folderId).toBe("newFolderDriveId");
      expect(mocks.getFolderName).toHaveBeenCalledWith("test-token", "newFolderDriveId");
      expect(mocks.transaction).toHaveBeenCalled();
    });

    it("remaps copied videos in place so watch progress keeps its relation", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue(existingFolder);
      mocks.getFolderName.mockResolvedValue("New Folder");
      mocks.folderVideoFindMany.mockResolvedValue([
        {
          id: "stable-catalog-id",
          folderId: "oldFolderDriveId",
          driveFileId: "old-video-id",
          name: "Episode 01.mp4",
          mimeType: "video/mp4",
          size: "1000",
          _count: { watchProgress: 1 },
        },
      ]);
      mocks.listFolderVideos
        .mockResolvedValueOnce([
          {
            id: "old-video-id",
            name: "Episode 01.mp4",
            mimeType: "video/mp4",
            size: "1000",
            modifiedTime: "2026-01-01T00:00:00.000Z",
            sha256Checksum: "same-content",
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "new-video-id",
            name: "Episode 01.mp4",
            mimeType: "video/mp4",
            size: "1000",
            modifiedTime: "2026-02-01T00:00:00.000Z",
            sha256Checksum: "same-content",
          },
        ]);
      mocks.update.mockResolvedValue({
        ...existingFolder,
        folderId: "newFolderDriveId",
        sourceUrl: newSourceUrl,
      });
      mocks.transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));

      const response = await PATCH(makeRequest({ id: "cfg_1", sourceUrl: newSourceUrl }));

      expect(response.status).toBe(200);
      expect(mocks.folderVideoUpdate).toHaveBeenCalledWith({
        where: { id: "stable-catalog-id" },
        data: expect.objectContaining({
          folderId: "newFolderDriveId",
          driveFileId: "new-video-id",
        }),
      });
      expect(mocks.seasonUpdateMany).toHaveBeenCalledWith({
        where: { folderId: "oldFolderDriveId" },
        data: { folderId: "newFolderDriveId" },
      });
      expect(mocks.folderVideoDeleteMany).toHaveBeenCalledWith({
        where: { id: { in: [] } },
      });
    });

    it("stops before deleting a video with unmatched watch history", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue(existingFolder);
      mocks.getFolderName.mockResolvedValue("New Folder");
      mocks.folderVideoFindMany.mockResolvedValue([
        {
          id: "stable-catalog-id",
          folderId: "oldFolderDriveId",
          driveFileId: "old-video-id",
          name: "Unmatched.mp4",
          mimeType: "video/mp4",
          size: "1000",
          _count: { watchProgress: 1 },
        },
      ]);
      mocks.listFolderVideos.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: "different-video-id",
          name: "Different.mp4",
          mimeType: "video/mp4",
          size: "2000",
          modifiedTime: null,
        },
      ]);

      const response = await PATCH(makeRequest({ id: "cfg_1", sourceUrl: newSourceUrl }));
      const body = (await response.json()) as { migration: { unmatchedWithHistory: number } };

      expect(response.status).toBe(409);
      expect(body.migration.unmatchedWithHistory).toBe(1);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.folderVideoDeleteMany).not.toHaveBeenCalled();
    });

    it("does not migrate when the target folder cannot be inspected", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue(existingFolder);
      mocks.getFolderName.mockRejectedValue(new DriveRequestError("Drive API error", 403));

      const response = await PATCH(makeRequest({ id: "cfg_1", sourceUrl: newSourceUrl }));

      expect(response.status).toBe(403);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid JSON body", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);

      const response = await PATCH(
        new Request("http://localhost/api/config/folders", {
          method: "PATCH",
          body: "not-json",
        }),
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/invalid json/i);
    });
  });

  describe("PUT /api/config/folders", () => {
    const adminSession = { user: { email: "admin@example.com" }, accessToken: "test-token" };

    function makeRequest(body: unknown) {
      return new Request("http://localhost/api/config/folders", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("returns 401 when not authenticated", async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await PUT(makeRequest({ id: "cfg_1", archived: true }));

      expect(response.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);

      const response = await PUT(makeRequest({ archived: true }));

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/id/i);
    });

    it("returns 400 when archived is not a boolean", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);

      const response = await PUT(makeRequest({ id: "cfg_1", archived: "yes" }));

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/archived/i);
    });

    it("returns 400 when neither archived nor name is provided", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);

      const response = await PUT(makeRequest({ id: "cfg_1" }));

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/archived or name/i);
    });

    it("renames a folder successfully", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      const updatedFolder = {
        id: "cfg_1",
        folderId: "f1",
        archived: false,
        name: "My Custom Name",
        sourceUrl: "url",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mocks.update.mockResolvedValue(updatedFolder);

      const response = await PUT(makeRequest({ id: "cfg_1", name: "My Custom Name" }));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { folder: typeof updatedFolder };
      expect(body.folder.name).toBe("My Custom Name");
      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: "cfg_1" },
        data: { name: "My Custom Name" },
      });
    });

    it("trims whitespace from name", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      const updatedFolder = {
        id: "cfg_1",
        folderId: "f1",
        archived: false,
        name: "Trimmed Name",
        sourceUrl: "url",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mocks.update.mockResolvedValue(updatedFolder);

      await PUT(makeRequest({ id: "cfg_1", name: "  Trimmed Name  " }));

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: "cfg_1" },
        data: { name: "Trimmed Name" },
      });
    });

    it("returns 400 when name is empty string", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);

      const response = await PUT(makeRequest({ id: "cfg_1", name: "   " }));

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/name/i);
    });

    it("returns 404 when folder not found on rename", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: "P2025",
          clientVersion: "0.0.0",
        }),
      );

      const response = await PUT(makeRequest({ id: "nonexistent", name: "New Name" }));

      expect(response.status).toBe(404);
    });

    it("archives a folder successfully", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      const updatedFolder = {
        id: "cfg_1",
        folderId: "f1",
        archived: true,
        name: null,
        sourceUrl: "url",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mocks.update.mockResolvedValue(updatedFolder);

      const response = await PUT(makeRequest({ id: "cfg_1", archived: true }));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { folder: typeof updatedFolder };
      expect(body.folder.archived).toBe(true);
      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: "cfg_1" },
        data: { archived: true },
      });
    });

    it("returns 404 when folder not found", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: "P2025",
          clientVersion: "0.0.0",
        }),
      );

      const response = await PUT(makeRequest({ id: "nonexistent", archived: false }));

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/config/folders", () => {
    const adminSession = { user: { email: "admin@example.com" }, accessToken: "test-token" };

    function makeRequest(body: unknown) {
      return new Request("http://localhost/api/config/folders", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("returns 401 when not authenticated", async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await DELETE(makeRequest({ id: "cfg_1" }));

      expect(response.status).toBe(401);
    });

    it("returns 400 when id is missing", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);

      const response = await DELETE(makeRequest({}));

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/id/i);
    });

    it("deletes folder and related videos successfully", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue({
        id: "cfg_1",
        folderId: "folder_drive_id",
        name: "My Folder",
      });
      mocks.delete.mockResolvedValue({});

      const response = await DELETE(makeRequest({ id: "cfg_1" }));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
      expect(mocks.delete).toHaveBeenCalledWith({ where: { id: "cfg_1" } });
    });

    it("returns 200 even when folder is not found via findUnique (delete handles it)", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue(null);
      mocks.delete.mockResolvedValue({});

      const response = await DELETE(makeRequest({ id: "cfg_1" }));

      expect(response.status).toBe(200);
    });

    it("returns 404 when configuredFolder.delete throws P2025", async () => {
      mocks.auth.mockResolvedValue(adminSession);
      mocks.isAdminSession.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue(null);
      mocks.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: "P2025",
          clientVersion: "0.0.0",
        }),
      );

      const response = await DELETE(makeRequest({ id: "nonexistent" }));

      expect(response.status).toBe(404);
    });
  });
});
