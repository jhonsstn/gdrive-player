import { describe, expect, it } from "vitest";

import { matchMigrationVideos, type MigrationVideo } from "@/lib/folder-migration";

function video(
  overrides: Partial<MigrationVideo> & Pick<MigrationVideo, "id" | "name">,
): MigrationVideo {
  return {
    mimeType: "video/mp4",
    size: "1000",
    ...overrides,
  };
}

describe("matchMigrationVideos", () => {
  it("matches moved files by Drive file ID", () => {
    const result = matchMigrationVideos(
      [video({ id: "same-id", name: "Old name.mp4" })],
      [video({ id: "same-id", name: "New name.mp4" })],
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.matchedBy).toBe("driveFileId");
  });

  it("matches copied files with changed IDs by checksum", () => {
    const result = matchMigrationVideos(
      [video({ id: "old-id", name: "Episode 01.mp4", sha256Checksum: "content-hash" })],
      [video({ id: "new-id", name: "Renamed episode.mp4", sha256Checksum: "content-hash" })],
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      oldVideo: { id: "old-id" },
      newVideo: { id: "new-id" },
      matchedBy: "sha256",
    });
  });

  it("falls back to a unique normalized name, size, and MIME type", () => {
    const result = matchMigrationVideos(
      [video({ id: "old-id", name: "Episode 01.MP4" })],
      [video({ id: "new-id", name: "episode 01.mp4" })],
    );

    expect(result.matches[0]?.matchedBy).toBe("metadata");
  });

  it("does not guess when duplicate metadata is ambiguous", () => {
    const oldVideos = [
      video({ id: "old-1", name: "Episode.mp4" }),
      video({ id: "old-2", name: "Episode.mp4" }),
    ];
    const newVideos = [
      video({ id: "new-1", name: "Episode.mp4" }),
      video({ id: "new-2", name: "Episode.mp4" }),
    ];

    const result = matchMigrationVideos(oldVideos, newVideos);

    expect(result.matches).toHaveLength(0);
    expect(result.unmatchedOld).toHaveLength(2);
    expect(result.unmatchedNew).toHaveLength(2);
  });
});
