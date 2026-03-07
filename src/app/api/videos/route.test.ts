import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  listFolderVideos: vi.fn(),
  listFolderVideosPage: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    configuredFolder: {
      findMany: mocks.findMany,
    },
  },
}));

vi.mock("@/lib/drive", () => ({
  DriveRequestError: class DriveRequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  listFolderVideos: mocks.listFolderVideos,
  listFolderVideosPage: mocks.listFolderVideosPage,
}));

import { GET } from "@/app/api/videos/route";

describe("/api/videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/videos"));

    expect(response.status).toBe(401);
  });

  it("aggregates folders and filters non-video mime types", async () => {
    mocks.auth.mockResolvedValue({
      user: { email: "user@example.com" },
      accessToken: "token",
    });

    mocks.findMany.mockResolvedValue([
      { folderId: "folder_1", sourceUrl: "https://drive.google.com/drive/folders/folder_1" },
      { folderId: "folder_2", sourceUrl: "https://drive.google.com/drive/folders/folder_2" },
    ]);

    mocks.listFolderVideos
      .mockResolvedValueOnce([
        {
          id: "v2",
          name: "Video 2",
          mimeType: "video/mp4",
          size: null,
          folderId: "folder_1",
        },
        {
          id: "img",
          name: "Image 1",
          mimeType: "image/png",
          size: null,
          folderId: "folder_1",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "v10",
          name: "Video 10",
          mimeType: "video/webm",
          size: null,
          folderId: "folder_2",
        },
      ]);

    const response = await GET(new Request("http://localhost/api/videos?sort=asc"));

    expect(response.status).toBe(200);
    expect(mocks.listFolderVideos).toHaveBeenCalledTimes(2);

    const payload = (await response.json()) as {
      videos: Array<{ id: string; mimeType: string; sourceUrl: string }>;
    };

    expect(payload.videos.map((video) => video.id)).toEqual(["v2", "v10"]);
    expect(payload.videos.every((video) => video.mimeType.startsWith("video/"))).toBe(true);
    expect(payload.videos.map((video) => video.sourceUrl)).toEqual([
      "https://drive.google.com/drive/folders/folder_1",
      "https://drive.google.com/drive/folders/folder_2",
    ]);
  });

  it("filters by folderId when query param is provided", async () => {
    mocks.auth.mockResolvedValue({
      user: { email: "user@example.com" },
      accessToken: "token",
    });

    mocks.findMany.mockResolvedValue([
      { folderId: "folder_1", sourceUrl: "https://drive.google.com/drive/folders/folder_1" },
    ]);

    mocks.listFolderVideosPage.mockResolvedValueOnce({
      videos: [
        {
          id: "v1",
          name: "Video 1",
          mimeType: "video/mp4",
          size: null,
          folderId: "folder_1",
        },
      ],
      nextPageToken: undefined,
    });

    const response = await GET(new Request("http://localhost/api/videos?folderId=folder_1"));

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { folderId: "folder_1" },
      orderBy: { createdAt: "asc" },
    });

    const payload = (await response.json()) as {
      videos: Array<{ id: string }>;
    };

    expect(payload.videos).toHaveLength(1);
    expect(payload.videos[0]?.id).toBe("v1");
  });
});
