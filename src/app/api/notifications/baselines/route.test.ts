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
    userNotificationBaseline: {
      findMany: mocks.findMany,
    },
  },
}));

import { GET } from "@/app/api/notifications/baselines/route";

describe("/api/notifications/baselines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const request = new Request("http://localhost/api/notifications/baselines?folderIds=f1");
    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("returns 400 when folderIds is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });

    const request = new Request("http://localhost/api/notifications/baselines");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
  });

  it("returns baselines keyed by folderId", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });
    mocks.findMany.mockResolvedValue([
      { folderId: "f1", baselineDate: new Date("2024-06-01T00:00:00Z") },
      { folderId: "f2", baselineDate: new Date("2024-07-01T00:00:00Z") },
    ]);

    const request = new Request("http://localhost/api/notifications/baselines?folderIds=f1,f2");
    const response = await GET(request as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.baselines).toEqual({
      f1: "2024-06-01T00:00:00.000Z",
      f2: "2024-07-01T00:00:00.000Z",
    });
  });

  it("returns empty baselines when no records exist", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });
    mocks.findMany.mockResolvedValue([]);

    const request = new Request("http://localhost/api/notifications/baselines?folderIds=f1");
    const response = await GET(request as never);
    const data = await response.json();

    expect(data.baselines).toEqual({});
  });
});
