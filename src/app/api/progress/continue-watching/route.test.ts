import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    watchProgress: {
      findMany: mocks.findMany,
    },
  },
}));

import { GET } from "@/app/api/progress/continue-watching/route";

describe("/api/progress/continue-watching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns in-progress videos grouped by folder (one per folder)", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });
    const now = new Date("2024-06-01T00:00:00Z");
    mocks.findMany.mockResolvedValue([
      { folderVideo: { driveFileId: "v1", name: "Episode 1", folderId: "f1" }, currentTime: 120, duration: 600, updatedAt: now },
      { folderVideo: { driveFileId: "v2", name: "Episode 2", folderId: "f1" }, currentTime: 60, duration: 600, updatedAt: now },
      { folderVideo: { driveFileId: "v3", name: "Movie", folderId: "f2" }, currentTime: 300, duration: 7200, updatedAt: now },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].videoId).toBe("v1");
    expect(data.items[0].folderId).toBe("f1");
    expect(data.items[1].videoId).toBe("v3");
    expect(data.items[1].folderId).toBe("f2");
  });

  it("returns empty items when no in-progress videos exist", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });
    mocks.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(data.items).toEqual([]);
  });

  it("skips rows with null folderId", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });
    mocks.findMany.mockResolvedValue([
      { folderVideo: null, currentTime: 50, duration: 600, updatedAt: new Date() },
      { folderVideo: { driveFileId: "v2", name: "Valid", folderId: "f1" }, currentTime: 50, duration: 600, updatedAt: new Date() },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(data.items).toHaveLength(1);
    expect(data.items[0].videoId).toBe("v2");
  });
});
