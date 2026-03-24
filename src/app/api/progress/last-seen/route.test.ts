import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    userFolderLastSeen: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));

import { GET, PUT } from "@/app/api/progress/last-seen/route";

describe("/api/progress/last-seen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 for unauthenticated users", async () => {
      mocks.auth.mockResolvedValue(null);

      const request = new Request("http://localhost/api/progress/last-seen?folderIds=f1");
      const response = await GET(request as never);
      expect(response.status).toBe(401);
    });

    it("returns 400 when folderIds is missing", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });

      const request = new Request("http://localhost/api/progress/last-seen");
      const response = await GET(request as never);
      expect(response.status).toBe(400);
    });

    it("returns last-seen dates keyed by folderId", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });
      mocks.findMany.mockResolvedValue([
        { folderId: "f1", lastSeenDate: new Date("2024-06-01T00:00:00Z") },
        { folderId: "f2", lastSeenDate: new Date("2024-07-01T00:00:00Z") },
      ]);

      const request = new Request("http://localhost/api/progress/last-seen?folderIds=f1,f2");
      const response = await GET(request as never);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.lastSeen).toEqual({
        f1: "2024-06-01T00:00:00.000Z",
        f2: "2024-07-01T00:00:00.000Z",
      });
    });
  });

  describe("PUT", () => {
    it("returns 401 for unauthenticated users", async () => {
      mocks.auth.mockResolvedValue(null);

      const request = new Request("http://localhost/api/progress/last-seen", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId: "f1", videoModifiedTime: "2024-06-01T00:00:00Z" }),
      });
      const response = await PUT(request as never);
      expect(response.status).toBe(401);
    });

    it("returns 400 for missing fields", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });

      const request = new Request("http://localhost/api/progress/last-seen", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId: "f1" }),
      });
      const response = await PUT(request as never);
      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid date", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });

      const request = new Request("http://localhost/api/progress/last-seen", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId: "f1", videoModifiedTime: "not-a-date" }),
      });
      const response = await PUT(request as never);
      expect(response.status).toBe(400);
    });

    it("upserts when new date is newer than existing", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });
      mocks.findUnique.mockResolvedValue({
        lastSeenDate: new Date("2024-01-01T00:00:00Z"),
      });
      mocks.upsert.mockResolvedValue({});

      const request = new Request("http://localhost/api/progress/last-seen", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId: "f1", videoModifiedTime: "2024-06-01T00:00:00Z" }),
      });
      const response = await PUT(request as never);

      expect(response.status).toBe(200);
      expect(mocks.upsert).toHaveBeenCalledOnce();
    });

    it("skips upsert when new date is older than existing", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });
      mocks.findUnique.mockResolvedValue({
        lastSeenDate: new Date("2024-12-01T00:00:00Z"),
      });

      const request = new Request("http://localhost/api/progress/last-seen", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId: "f1", videoModifiedTime: "2024-06-01T00:00:00Z" }),
      });
      const response = await PUT(request as never);

      expect(response.status).toBe(200);
      expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it("upserts when no existing record", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "u@t.com" } });
      mocks.findUnique.mockResolvedValue(null);
      mocks.upsert.mockResolvedValue({});

      const request = new Request("http://localhost/api/progress/last-seen", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId: "f1", videoModifiedTime: "2024-06-01T00:00:00Z" }),
      });
      const response = await PUT(request as never);

      expect(response.status).toBe(200);
      expect(mocks.upsert).toHaveBeenCalledOnce();
    });
  });
});
