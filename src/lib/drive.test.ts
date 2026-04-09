import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  DriveRequestError,
  getFolderName,
  getLatestVideoModifiedTime,
  getStreamPassthroughHeaders,
  listFolderVideos,
  listFolderVideosPage,
  streamDriveFile,
} from "@/lib/drive";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("drive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getFolderName", () => {
    it("returns the folder name from Drive API", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ name: "My Folder" }));

      const name = await getFolderName("token", "folder123");
      expect(name).toBe("My Folder");
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch.mock.calls[0][0]).toContain("folder123");
    });

    it("falls back to folderId when name is missing", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      const name = await getFolderName("token", "folder123");
      expect(name).toBe("folder123");
    });

    it("throws DriveRequestError on failure", async () => {
      mockFetch.mockResolvedValue(errorResponse(403, "Forbidden"));

      await expect(getFolderName("token", "folder123")).rejects.toThrow(DriveRequestError);
    });
  });

  describe("listFolderVideos", () => {
    it("returns video files filtered by MIME type", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          files: [
            { id: "v1", name: "video.mp4", mimeType: "video/mp4", size: "1000", modifiedTime: "2024-01-01T00:00:00Z" },
            { id: "d1", name: "doc.pdf", mimeType: "application/pdf", size: "500" },
            { id: "v2", name: "clip.webm", mimeType: "video/webm", size: "2000", modifiedTime: "2024-01-02T00:00:00Z" },
          ],
        }),
      );

      const videos = await listFolderVideos("token", "folder1");
      expect(videos).toHaveLength(2);
      expect(videos[0]).toEqual({
        id: "v1",
        name: "video.mp4",
        mimeType: "video/mp4",
        size: "1000",
        folderId: "folder1",
        modifiedTime: "2024-01-01T00:00:00Z",
      });
      expect(videos[1].id).toBe("v2");
    });

    it("skips files missing required fields", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          files: [
            { id: "v1", name: "video.mp4", mimeType: "video/mp4" },
            { name: "no-id.mp4", mimeType: "video/mp4" },
            { id: "v3", mimeType: "video/mp4" },
          ],
        }),
      );

      const videos = await listFolderVideos("token", "folder1");
      expect(videos).toHaveLength(1);
      expect(videos[0].id).toBe("v1");
    });

    it("paginates through multiple pages", async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({
            files: [{ id: "v1", name: "a.mp4", mimeType: "video/mp4" }],
            nextPageToken: "page2",
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            files: [{ id: "v2", name: "b.mp4", mimeType: "video/mp4" }],
          }),
        );

      const videos = await listFolderVideos("token", "folder1");
      expect(videos).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws DriveRequestError on API failure", async () => {
      mockFetch.mockResolvedValue(errorResponse(401, "Unauthorized"));

      await expect(listFolderVideos("token", "folder1")).rejects.toThrow(DriveRequestError);
    });
  });

  describe("streamDriveFile", () => {
    it("sends authorization header", async () => {
      mockFetch.mockResolvedValue(new Response("video-data", { status: 200 }));

      await streamDriveFile("my-token", "file123");
      expect(mockFetch.mock.calls[0][1].headers).toHaveProperty("Authorization", "Bearer my-token");
    });

    it("forwards range header when provided", async () => {
      mockFetch.mockResolvedValue(new Response("partial", { status: 206 }));

      await streamDriveFile("token", "file123", "bytes=0-999");
      expect(mockFetch.mock.calls[0][1].headers).toHaveProperty("Range", "bytes=0-999");
    });

    it("throws DriveRequestError on failure", async () => {
      mockFetch.mockResolvedValue(errorResponse(404, "Not Found"));

      await expect(streamDriveFile("token", "file123")).rejects.toThrow(DriveRequestError);
    });
  });

  describe("getStreamPassthroughHeaders", () => {
    it("copies allowed headers", () => {
      const source = new Headers({
        "content-type": "video/mp4",
        "content-length": "12345",
        "content-range": "bytes 0-999/12345",
        "accept-ranges": "bytes",
        "cache-control": "no-cache",
        etag: '"abc"',
        "last-modified": "Wed, 01 Jan 2024 00:00:00 GMT",
      });

      const result = getStreamPassthroughHeaders(source);
      expect(result.get("content-type")).toBe("video/mp4");
      expect(result.get("content-length")).toBe("12345");
      expect(result.get("content-range")).toBe("bytes 0-999/12345");
      expect(result.get("accept-ranges")).toBe("bytes");
      expect(result.get("cache-control")).toBe("no-cache");
      expect(result.get("etag")).toBe('"abc"');
      expect(result.get("last-modified")).toBe("Wed, 01 Jan 2024 00:00:00 GMT");
    });

    it("excludes non-allowed headers", () => {
      const source = new Headers({
        "content-type": "video/mp4",
        "x-custom": "should-not-pass",
        server: "google",
      });

      const result = getStreamPassthroughHeaders(source);
      expect(result.get("content-type")).toBe("video/mp4");
      expect(result.get("x-custom")).toBeNull();
      expect(result.get("server")).toBeNull();
    });

    it("handles missing headers gracefully", () => {
      const source = new Headers();
      const result = getStreamPassthroughHeaders(source);
      expect([...result.entries()]).toHaveLength(0);
    });
  });

  describe("listFolderVideosPage", () => {
    it("returns videos and nextPageToken", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          files: [
            { id: "v1", name: "video.mp4", mimeType: "video/mp4", size: "1000", modifiedTime: "2024-01-01T00:00:00Z" },
          ],
          nextPageToken: "next_token",
        }),
      );

      const { videos, nextPageToken } = await listFolderVideosPage("token", "folder_page_1", {});
      expect(videos).toHaveLength(1);
      expect(videos[0]).toEqual({
        id: "v1",
        name: "video.mp4",
        mimeType: "video/mp4",
        size: "1000",
        folderId: "folder_page_1",
        modifiedTime: "2024-01-01T00:00:00Z",
      });
      expect(nextPageToken).toBe("next_token");
    });

    it("returns cached result on second call with same params", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ files: [{ id: "v1", name: "video.mp4", mimeType: "video/mp4" }] }),
      );

      await listFolderVideosPage("token", "folder_page_2", { pageSize: 10 });
      await listFolderVideosPage("token", "folder_page_2", { pageSize: 10 });

      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it("uses different cache keys for different sort directions", async () => {
      mockFetch.mockImplementation(() => Promise.resolve(jsonResponse({ files: [] })));

      await listFolderVideosPage("token", "folder_page_3", { sortDirection: "asc" });
      await listFolderVideosPage("token", "folder_page_3", { sortDirection: "desc" });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("includes pageToken in request URL when provided", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ files: [] }));

      await listFolderVideosPage("token", "folder_page_4", { pageToken: "my_page_token" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("pageToken=my_page_token");
    });

    it("skips files missing required fields", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          files: [
            { id: "v1", name: "video.mp4", mimeType: "video/mp4" },
            { name: "no-id.mp4", mimeType: "video/mp4" },
            { id: "v3", mimeType: "video/mp4" },
          ],
        }),
      );

      const { videos } = await listFolderVideosPage("token", "folder_page_5", {});
      expect(videos).toHaveLength(1);
      expect(videos[0].id).toBe("v1");
    });

    it("throws DriveRequestError on API failure", async () => {
      mockFetch.mockResolvedValue(errorResponse(500, "Server Error"));

      await expect(listFolderVideosPage("token", "folder_page_6", {})).rejects.toThrow(DriveRequestError);
    });
  });

  describe("getLatestVideoModifiedTime", () => {
    it("returns the most recently modified video time", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ files: [{ modifiedTime: "2024-06-01T00:00:00Z" }] }),
      );

      const result = await getLatestVideoModifiedTime("token", "folder_latest_1");
      expect(result).toBe("2024-06-01T00:00:00Z");
    });

    it("returns null when no files are found", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ files: [] }));

      const result = await getLatestVideoModifiedTime("token", "folder_latest_2");
      expect(result).toBeNull();
    });

    it("returns cached result on second call", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ files: [{ modifiedTime: "2024-01-01T00:00:00Z" }] }),
      );

      await getLatestVideoModifiedTime("token", "folder_latest_3");
      await getLatestVideoModifiedTime("token", "folder_latest_3");

      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it("throws DriveRequestError on API failure", async () => {
      mockFetch.mockResolvedValue(errorResponse(403, "Forbidden"));

      await expect(getLatestVideoModifiedTime("token", "folder_latest_4")).rejects.toThrow(DriveRequestError);
    });
  });
});
