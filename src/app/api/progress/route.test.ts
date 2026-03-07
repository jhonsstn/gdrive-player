import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
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
  },
}));

import { GET, PUT } from "@/app/api/progress/route";

describe("/api/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 for unauthenticated users", async () => {
      mocks.auth.mockResolvedValue(null);

      const request = new Request("http://localhost/api/progress?videoIds=a,b");
      const response = await GET(request as never);

      expect(response.status).toBe(401);
    });

    it("returns 400 when videoIds is missing", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@test.com" } });

      const request = new Request("http://localhost/api/progress");
      const response = await GET(request as never);

      expect(response.status).toBe(400);
    });

    it("returns progress map keyed by videoId", async () => {
      mocks.auth.mockResolvedValue({ user: { email: "user@test.com" } });
      mocks.findMany.mockResolvedValue([
        {
          videoId: "vid1",
          currentTime: 120,
          duration: 600,
          watched: false,
        },
        {
          videoId: "vid2",
          currentTime: 570,
          duration: 600,
          watched: true,
        },
      ]);

      const request = new Request("http://localhost/api/progress?videoIds=vid1,vid2");
      const response = await GET(request as never);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.progress).toEqual({
        vid1: { currentTime: 120, duration: 600, watched: false },
        vid2: { currentTime: 570, duration: 600, watched: true },
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
          videoId: "vid1",
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
        body: JSON.stringify({ videoId: "vid1" }),
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
          videoId: "vid1",
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
          userEmail_videoId: { userEmail: "user@test.com", videoId: "vid1" },
        },
        create: {
          userEmail: "user@test.com",
          videoId: "vid1",
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
          videoId: "vid1",
          currentTime: 50,
          duration: 100,
        }),
      });
      const response = await PUT(request as never);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.watched).toBe(false);
    });
  });
});
