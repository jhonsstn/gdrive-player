import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  folderFindMany: vi.fn(),
  upsert: vi.fn(),
  getLatestVideoModifiedTime: vi.fn(),
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
      upsert: mocks.upsert,
    },
  },
}));

vi.mock("@/lib/drive", () => ({
  getLatestVideoModifiedTime: mocks.getLatestVideoModifiedTime,
}));

import { PUT } from "@/app/api/notifications/clear/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/notifications/clear", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/notifications/clear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await PUT(makeRequest({ folderIds: ["f1"] }) as never);
    expect(response.status).toBe(401);
  });

  it("returns 401 when access token is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });

    const response = await PUT(makeRequest({ folderIds: ["f1"] }) as never);
    expect(response.status).toBe(401);
  });

  it("returns 400 when neither folderIds nor all flag provided", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });

    const response = await PUT(makeRequest({}) as never);
    expect(response.status).toBe(400);
  });

  it("clears specific folders by updating baselines", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");
    mocks.upsert.mockResolvedValue({});

    const response = await PUT(makeRequest({ folderIds: ["f1"] }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cleared).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it("clears all folders when all flag is true", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.folderFindMany.mockResolvedValue([
      { folderId: "f1" },
      { folderId: "f2" },
    ]);
    mocks.getLatestVideoModifiedTime.mockResolvedValue("2024-06-01T00:00:00Z");
    mocks.upsert.mockResolvedValue({});

    const response = await PUT(makeRequest({ all: true }) as never);
    const data = await response.json();

    expect(data.cleared).toBe(true);
    expect(mocks.folderFindMany).toHaveBeenCalledOnce();
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });

  it("skips folders where getLatestVideoModifiedTime returns null", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" }, accessToken: "tok" });
    mocks.getLatestVideoModifiedTime.mockResolvedValue(null);

    const response = await PUT(makeRequest({ folderIds: ["f1"] }) as never);
    const data = await response.json();

    expect(data.cleared).toBe(true);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
