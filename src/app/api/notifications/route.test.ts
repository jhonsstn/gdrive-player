import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  folderFindMany: vi.fn(),
  baselineFindMany: vi.fn(),
  baselineCreate: vi.fn(),
  getLatestVideoModifiedTime: vi.fn(),
  countVideosSince: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    configuredFolder: {
      findMany: mocks.folderFindMany,
    },
    userNotificationBaseline: {
      findMany: mocks.baselineFindMany,
      create: mocks.baselineCreate,
    },
  },
}));

vi.mock("@/lib/drive", () => ({
  getLatestVideoModifiedTime: mocks.getLatestVideoModifiedTime,
  countVideosSince: mocks.countVideosSince,
}));

import { GET } from "@/app/api/notifications/route";

describe("/api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns 401 when access token is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns empty notifications when no folders configured", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.folderFindMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(data.notifications).toEqual([]);
  });

  it("initializes baseline for first-time folders and returns no notifications", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.folderFindMany.mockResolvedValue([
      { folderId: "f1", name: "Folder 1" },
    ]);
    mocks.baselineFindMany.mockResolvedValue([]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");
    mocks.baselineCreate.mockResolvedValue({});

    const response = await GET();
    const data = await response.json();

    expect(data.notifications).toEqual([]);
    expect(mocks.baselineCreate).toHaveBeenCalledWith({
      data: {
        userEmail: "u@t.com",
        folderId: "f1",
        baselineDate: new Date("2024-06-01T00:00:00Z"),
      },
    });
  });

  it("returns notifications for folders with new videos since baseline", async () => {
    const baseline = new Date("2024-01-01T00:00:00Z");
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.folderFindMany.mockResolvedValue([
      { folderId: "f1", name: "Anime" },
      { folderId: "f2", name: "Movies" },
    ]);
    mocks.baselineFindMany.mockResolvedValue([
      { folderId: "f1", baselineDate: baseline },
      { folderId: "f2", baselineDate: baseline },
    ]);
    mocks.countVideosSince.mockImplementation((_tok: string, folderId: string) => {
      if (folderId === "f1") return Promise.resolve(3);
      return Promise.resolve(0);
    });

    const response = await GET();
    const data = await response.json();

    expect(data.notifications).toHaveLength(1);
    expect(data.notifications[0]).toEqual({
      folderId: "f1",
      folderName: "Anime",
      newCount: 3,
    });
  });

  it("uses folderId as name when folder name is null", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.folderFindMany.mockResolvedValue([
      { folderId: "f1", name: null },
    ]);
    mocks.baselineFindMany.mockResolvedValue([
      { folderId: "f1", baselineDate: new Date("2024-01-01") },
    ]);
    mocks.countVideosSince.mockResolvedValue(2);

    const response = await GET();
    const data = await response.json();

    expect(data.notifications[0].folderName).toBe("f1");
  });

  it("skips folders that throw errors", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.folderFindMany.mockResolvedValue([
      { folderId: "f1", name: "Good" },
      { folderId: "f2", name: "Bad" },
    ]);
    mocks.baselineFindMany.mockResolvedValue([
      { folderId: "f1", baselineDate: new Date("2024-01-01") },
      { folderId: "f2", baselineDate: new Date("2024-01-01") },
    ]);
    mocks.countVideosSince.mockImplementation((_tok: string, folderId: string) => {
      if (folderId === "f2") return Promise.reject(new Error("Drive error"));
      return Promise.resolve(5);
    });

    const response = await GET();
    const data = await response.json();

    expect(data.notifications).toHaveLength(1);
    expect(data.notifications[0].folderId).toBe("f1");
  });
});
