import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  getLatestVideoModifiedTime: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    userFolderLastSeen: {
      findMany: mocks.findMany,
    },
  },
}));

vi.mock("@/lib/drive", () => ({
  getLatestVideoModifiedTime: mocks.getLatestVideoModifiedTime,
}));

import { GET } from "@/app/api/folders/has-new/route";

describe("/api/folders/has-new", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("returns 401 when access token is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("returns 400 when folderIds is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });

    const request = new Request("http://localhost/api/folders/has-new");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
  });

  it("returns hasNew=true when latest video is newer than last seen", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([
      { folderId: "f1", lastSeenDate: new Date("2024-01-01T00:00:00Z"), watchedThrough: null },
    ]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasNew).toEqual({ f1: true });
  });

  it("returns hasNew=false when latest video is older than last seen", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([
      { folderId: "f1", lastSeenDate: new Date("2024-12-01T00:00:00Z"), watchedThrough: null },
    ]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.hasNew).toEqual({ f1: false });
  });

  it("returns hasNew=true when no last-seen record exists", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.hasNew).toEqual({ f1: true });
  });

  it("returns hasNew=false when no latest video exists", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue(null);

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.hasNew).toEqual({ f1: false });
  });

  it("returns hasNew=false when drive API throws", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([]);
    mocks.getLatestVideoModifiedTime.mockRejectedValue(new Error("Drive error"));

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.hasNew).toEqual({ f1: false });
  });

  it("returns hasNotSeen=true when no watchedThrough record exists", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([
      { folderId: "f1", lastSeenDate: new Date("2024-12-01T00:00:00Z"), watchedThrough: null },
    ]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.hasNotSeen).toEqual({ f1: true });
  });

  it("returns hasNotSeen=false when latest video is older than watchedThrough", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([
      {
        folderId: "f1",
        lastSeenDate: new Date("2024-12-01T00:00:00Z"),
        watchedThrough: new Date("2024-12-01T00:00:00Z"),
      },
    ]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.hasNotSeen).toEqual({ f1: false });
  });

  it("returns hasNotSeen=false when no videos exist", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.findMany.mockResolvedValue([]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue(null);

    const request = new Request("http://localhost/api/folders/has-new?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.hasNotSeen).toEqual({ f1: false });
  });
});
