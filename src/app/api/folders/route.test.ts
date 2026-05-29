import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  seasonFindMany: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    configuredFolder: {
      findMany: mocks.findMany,
    },
    season: {
      findMany: mocks.seasonFindMany,
    },
  },
}));

import { GET } from "@/app/api/folders/route";

describe("/api/folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns folder list for authenticated users", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.seasonFindMany.mockResolvedValue([]);
    mocks.findMany.mockResolvedValue([
      { id: "cfg_1", folderId: "folder_1", name: "My Folder" },
      { id: "cfg_2", folderId: "folder_2", name: null },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      folders: Array<{ id: string; folderId: string; name: string | null }>;
      series: Array<unknown>;
    };

    expect(payload.folders).toEqual([
      { id: "cfg_1", folderId: "folder_1", name: "My Folder" },
      { id: "cfg_2", folderId: "folder_2", name: null },
    ]);
    expect(payload.series).toEqual([]);

    expect(mocks.findMany).toHaveBeenCalledWith({
      select: { id: true, folderId: true, name: true },
      where: { archived: false },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns series with only unarchived season folders", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.seasonFindMany.mockResolvedValue([
      {
        id: "season_1",
        seriesId: "series_1",
        folderId: "folder_active",
        seasonNumber: 1,
        series: { id: "series_1", name: "Show" },
      },
      {
        id: "season_2",
        seriesId: "series_1",
        folderId: "folder_archived",
        seasonNumber: 2,
        series: { id: "series_1", name: "Show" },
      },
    ]);
    mocks.findMany.mockResolvedValue([
      { id: "cfg_1", folderId: "folder_active", name: "Season 1" },
      { id: "cfg_3", folderId: "standalone", name: "Standalone" },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      folders: Array<{ folderId: string }>;
      series: Array<{
        id: string;
        name: string;
        seasons: Array<{ seasonNumber: number; folderId: string; folderName: string | null }>;
      }>;
    };

    expect(payload.folders).toEqual([{ id: "cfg_3", folderId: "standalone", name: "Standalone" }]);
    expect(payload.series).toEqual([
      {
        id: "series_1",
        name: "Show",
        seasons: [{ seasonNumber: 1, folderId: "folder_active", folderName: "Season 1" }],
      },
    ]);
  });

  it("omits series when all season folders are archived", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.seasonFindMany.mockResolvedValue([
      {
        id: "season_1",
        seriesId: "series_1",
        folderId: "folder_archived_1",
        seasonNumber: 1,
        series: { id: "series_1", name: "Archived Show" },
      },
      {
        id: "season_2",
        seriesId: "series_1",
        folderId: "folder_archived_2",
        seasonNumber: 2,
        series: { id: "series_1", name: "Archived Show" },
      },
    ]);
    mocks.findMany.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      folders: unknown[];
      series: unknown[];
    };

    expect(payload.folders).toEqual([]);
    expect(payload.series).toEqual([]);
  });

  it("omits empty series from the player folder list", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.seasonFindMany.mockResolvedValue([]);
    mocks.findMany.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      folders: unknown[];
      series: unknown[];
    };

    expect(payload.series).toEqual([]);
  });
});
