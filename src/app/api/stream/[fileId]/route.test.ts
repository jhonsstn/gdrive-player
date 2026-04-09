import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  streamDriveFile: vi.fn(),
  getStreamPassthroughHeaders: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/drive", () => ({
  DriveRequestError: class DriveRequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  streamDriveFile: mocks.streamDriveFile,
  getStreamPassthroughHeaders: mocks.getStreamPassthroughHeaders,
}));

import { GET } from "@/app/api/stream/[fileId]/route";

describe("/api/stream/[fileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/stream/file123"),
      { params: Promise.resolve({ fileId: "file123" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 401 when access token is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" } });

    const response = await GET(
      new Request("http://localhost/api/stream/file123"),
      { params: Promise.resolve({ fileId: "file123" }) },
    );

    expect(response.status).toBe(401);
    const body = await response.json() as { error: string };
    expect(body.error).toMatch(/access token/i);
  });

  it("falls back to application/octet-stream when content-type is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" }, accessToken: "token" });
    mocks.streamDriveFile.mockResolvedValue(new Response("data", { status: 200 }));
    mocks.getStreamPassthroughHeaders.mockReturnValue(new Headers()); // no content-type

    const response = await GET(
      new Request("http://localhost/api/stream/file123"),
      { params: Promise.resolve({ fileId: "file123" }) },
    );

    expect(response.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("returns Drive error status when streamDriveFile throws DriveRequestError", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "user@example.com" }, accessToken: "token" });

    const { DriveRequestError: MockDriveRequestError } = await import("@/lib/drive");
    mocks.streamDriveFile.mockRejectedValue(new MockDriveRequestError("Not Found", 404));

    const response = await GET(
      new Request("http://localhost/api/stream/file123"),
      { params: Promise.resolve({ fileId: "file123" }) },
    );

    expect(response.status).toBe(404);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Not Found");
  });

  it("forwards range request and returns partial content", async () => {
    mocks.auth.mockResolvedValue({
      user: { email: "user@example.com" },
      accessToken: "token",
    });

    mocks.streamDriveFile.mockResolvedValue(
      new Response("chunk", {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-range": "bytes 0-4/10",
          "accept-ranges": "bytes",
        },
      }),
    );

    mocks.getStreamPassthroughHeaders.mockReturnValue(
      new Headers({
        "content-type": "video/mp4",
        "content-range": "bytes 0-4/10",
        "accept-ranges": "bytes",
      }),
    );

    const response = await GET(
      new Request("http://localhost/api/stream/file123", {
        headers: { range: "bytes=0-4" },
      }),
      { params: Promise.resolve({ fileId: "file123" }) },
    );

    expect(mocks.streamDriveFile).toHaveBeenCalledWith("token", "file123", "bytes=0-4");
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-4/10");
    expect(await response.text()).toBe("chunk");
  });
});
