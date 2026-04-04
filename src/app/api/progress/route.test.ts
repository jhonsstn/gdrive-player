import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  folderVideoFindUnique: vi.fn(),
  lastSeenFindUnique: vi.fn(),
  lastSeenUpsert: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    watchProgress: {
      findMany: mocks.findMany,
      upsert: mocks.upsert,
    },
    folderVideo: {
      findUnique: mocks.folderVideoFindUnique,
    },
    userFolderLastSeen: {
      findUnique: mocks.lastSeenFindUnique,
      upsert: mocks.lastSeenUpsert,
    },
  },
}));

import { GET, PUT } from "@/app/api/progress/route";

describe("/api/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.folderVideoFindUnique.mockResolvedValue(null);
    mocks.lastSeenFindUnique.mockResolvedValue(null);
    mocks.lastSeenUpsert.mockResolvedValue({});
  });

  describe("GET", () => {
    it("returns 401 for unauthenticated users", async () => {
      mocks.auth.mockResolvedValue(null);

      const request = new Request("http://localhost/api/progress?folderVideoIds=a,b");
      const response = await GET(request as never);

      expect(response.status).toBe(401);
    });

    it("returns 400 when videoIds is missing", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@test.com" } });

      const request = new Request("http://localhost/api/progress");
      const response = await GET(request as never);

      expect(response.status).toBe(400);
    });

    it("returns progress map keyed by folderVideoId", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@test.com" } });
      mocks.findMany.mockResolvedValue([
        {
          folderVideoId: "fvid1",
          currentTime: 120,
          duration: 600,
          watched: false,
        },
        {
          folderVideoId: "fvid2",
          currentTime: 570,
          duration: 600,
          watched: true,
        },
      ]);

      const request = new Request("http://localhost/api/progress?folderVideoIds=fvid1,fvid2");
      const response = await GET(request as never);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.progress).toEqual({
        fvid1: { currentTime: 120, duration: 600, watched: false },
        fvid2: { currentTime: 570, duration: 600, watched: true },
      });
    });
  });

  describe("PUT", () => {
    it("returns 401 for unauthenticated users", async () => {
      mocks.auth.mockResolvedValue(null);

      const request = new Request("http://localhost/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folderVideoId: "fvid1",
          currentTime: 10,
          duration: 100,
        }),
      });
      const response = await PUT(request as never);

      expect(response.status).toBe(401);
    });

    it("returns 400 for missing fields", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@test.com" } });

      const request = new Request("http://localhost/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderVideoId: "fvid1" }),
      });
      const response = await PUT(request as never);

      expect(response.status).toBe(400);
    });

    it("upserts with watched=true at 90%", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@test.com" } });
      mocks.upsert.mockResolvedValue({});

      const request = new Request("http://localhost/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folderVideoId: "fvid1",
          currentTime: 90,
          duration: 100,
        }),
      });
      const response = await PUT(request as never);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.watched).toBe(true);
      expect(mocks.upsert).toHaveBeenCalledWith({
        where: {
          userEmail_folderVideoId: { userEmail: "user@test.com", folderVideoId: "fvid1" },
        },
        create: {
          userEmail: "user@test.com",
          folderVideoId: "fvid1",
          currentTime: 90,
          duration: 100,
          watched: true,
        },
        update: { currentTime: 90, duration: 100, watched: true },
      });
    });

    it("upserts with watched=false below 90%", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@test.com" } });
      mocks.upsert.mockResolvedValue({});

      const request = new Request("http://localhost/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folderVideoId: "fvid1",
          currentTime: 50,
          duration: 100,
        }),
      });
      const response = await PUT(request as never);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.watched).toBe(false);
    });

    it("advances watchedThrough when video is watched and FolderVideo has modifiedTime", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@test.com" } });
      mocks.upsert.mockResolvedValue({});
      mocks.folderVideoFindUnique.mockResolvedValue({
        folderId: "folder1",
        modifiedTime: new Date("2024-06-01T00:00:00Z"),
      });
      mocks.lastSeenFindUnique.mockResolvedValue(null);

      const request = new Request("http://localhost/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folderVideoId: "fvid1",
          currentTime: 90,
          duration: 100,
        }),
      });
      const response = await PUT(request as never);

      expect(response.status).toBe(200);
      expect(mocks.lastSeenUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            watchedThrough: new Date("2024-06-01T00:00:00Z"),
          }),
        }),
      );
    });

    it("does not advance watchedThrough if existing watchedThrough is newer", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@test.com" } });
      mocks.upsert.mockResolvedValue({});
      mocks.folderVideoFindUnique.mockResolvedValue({
        folderId: "folder1",
        modifiedTime: new Date("2024-06-01T00:00:00Z"),
      });
      mocks.lastSeenFindUnique.mockResolvedValue({
        watchedThrough: new Date("2024-12-01T00:00:00Z"),
      });

      const request = new Request("http://localhost/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folderVideoId: "fvid1",
          currentTime: 90,
          duration: 100,
        }),
      });
      await PUT(request as never);

      expect(mocks.lastSeenUpsert).not.toHaveBeenCalled();
    });
  });
});
