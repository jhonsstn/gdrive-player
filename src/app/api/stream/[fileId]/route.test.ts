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
