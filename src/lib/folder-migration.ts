export type MigrationVideo = {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime?: string | null;
  md5Checksum?: string | null;
  sha1Checksum?: string | null;
  sha256Checksum?: string | null;
};

export type MigrationVideoMatch = {
  oldVideo: MigrationVideo;
  newVideo: MigrationVideo;
  matchedBy: "driveFileId" | "sha256" | "sha1" | "md5" | "metadata";
};

export type MigrationMatchResult = {
  matches: MigrationVideoMatch[];
  unmatchedOld: MigrationVideo[];
  unmatchedNew: MigrationVideo[];
};

function normalizedName(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function matchUniqueKeys(
  oldRemaining: Map<string, MigrationVideo>,
  newRemaining: Map<string, MigrationVideo>,
  keyFor: (video: MigrationVideo) => string | null,
  matchedBy: MigrationVideoMatch["matchedBy"],
  matches: MigrationVideoMatch[],
): void {
  const oldGroups = new Map<string, MigrationVideo[]>();
  const newGroups = new Map<string, MigrationVideo[]>();

  for (const video of oldRemaining.values()) {
    const key = keyFor(video);
    if (!key) continue;
    oldGroups.set(key, [...(oldGroups.get(key) ?? []), video]);
  }

  for (const video of newRemaining.values()) {
    const key = keyFor(video);
    if (!key) continue;
    newGroups.set(key, [...(newGroups.get(key) ?? []), video]);
  }

  for (const [key, oldVideos] of oldGroups) {
    const newVideos = newGroups.get(key);
    // Never guess when either side contains duplicates.
    if (oldVideos.length !== 1 || newVideos?.length !== 1) continue;

    const oldVideo = oldVideos[0]!;
    const newVideo = newVideos[0]!;
    matches.push({ oldVideo, newVideo, matchedBy });
    oldRemaining.delete(oldVideo.id);
    newRemaining.delete(newVideo.id);
  }
}

export function matchMigrationVideos(
  oldVideos: MigrationVideo[],
  newVideos: MigrationVideo[],
): MigrationMatchResult {
  const oldRemaining = new Map(oldVideos.map((video) => [video.id, video]));
  const newRemaining = new Map(newVideos.map((video) => [video.id, video]));
  const matches: MigrationVideoMatch[] = [];

  // Moving a Drive file preserves its ID, so this is always the strongest match.
  for (const oldVideo of oldVideos) {
    const newVideo = newRemaining.get(oldVideo.id);
    if (!newVideo) continue;
    matches.push({ oldVideo, newVideo, matchedBy: "driveFileId" });
    oldRemaining.delete(oldVideo.id);
    newRemaining.delete(newVideo.id);
  }

  matchUniqueKeys(
    oldRemaining,
    newRemaining,
    (video) => video.sha256Checksum ?? null,
    "sha256",
    matches,
  );
  matchUniqueKeys(
    oldRemaining,
    newRemaining,
    (video) => video.sha1Checksum ?? null,
    "sha1",
    matches,
  );
  matchUniqueKeys(oldRemaining, newRemaining, (video) => video.md5Checksum ?? null, "md5", matches);
  matchUniqueKeys(
    oldRemaining,
    newRemaining,
    (video) => {
      if (!video.size) return null;
      return `${normalizedName(video.name)}\u0000${video.size}\u0000${video.mimeType}`;
    },
    "metadata",
    matches,
  );

  return {
    matches,
    unmatchedOld: [...oldRemaining.values()],
    unmatchedNew: [...newRemaining.values()],
  };
}
