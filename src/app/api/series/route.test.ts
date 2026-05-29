import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  seriesFindMany: vi.fn(),
  folderFindMany: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    series: {
      findMany: mocks.seriesFindMany,
    },
    configuredFolder: {
      findMany: mocks.folderFindMany,
    },
  },
}));

import { GET } from "@/app/api/series/route";

describe("/api/series", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns archived seasons for config management", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.seriesFindMany.mockResolvedValue([
      {
        id: "series_1",
        name: "Show",
        seasons: [
          {
            id: "season_1",
            seasonNumber: 1,
            folderId: "folder_active",
          },
          {
            id: "season_2",
            seasonNumber: 2,
            folderId: "folder_archived",
          },
        ],
      },
    ]);
    mocks.folderFindMany.mockResolvedValue([
      {
        id: "cfg_1",
        folderId: "folder_active",
        name: "Season 1",
        archived: false,
      },
      {
        id: "cfg_2",
        folderId: "folder_archived",
        name: "Season 2",
        archived: true,
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      series: Array<{
        seasons: Array<{
          id: string;
          folderConfigId: string | null;
          archived: boolean;
        }>;
      }>;
    };

    expect(payload.series[0]?.seasons).toEqual([
      {
        id: "season_1",
        seasonNumber: 1,
        folderId: "folder_active",
        folderName: "Season 1",
        folderConfigId: "cfg_1",
        archived: false,
      },
      {
        id: "season_2",
        seasonNumber: 2,
        folderId: "folder_archived",
        folderName: "Season 2",
        folderConfigId: "cfg_2",
        archived: true,
      },
    ]);
    expect(mocks.folderFindMany).toHaveBeenCalledWith({
      where: { folderId: { in: ["folder_active", "folder_archived"] } },
      select: { id: true, folderId: true, name: true, archived: true },
    });
  });
});
