const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;

function isValidDriveId(value: string): boolean {
  return DRIVE_ID_PATTERN.test(value);
}

function extractFolderIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const foldersIndex = segments.lastIndexOf("folders");

  if (foldersIndex === -1 || foldersIndex === segments.length - 1) {
    return null;
  }

  return segments[foldersIndex + 1] ?? null;
}

function extractFolderIdFromDriveUrl(raw: string): string | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(raw);
  } catch {
    return null;
  }

  if (parsedUrl.hostname !== "drive.google.com") {
    return null;
  }

  const fromPath = extractFolderIdFromPath(parsedUrl.pathname);
  if (fromPath) {
    return fromPath;
  }

  const fromQuery = parsedUrl.searchParams.get("id");
  if (fromQuery) {
    return fromQuery;
  }

  return null;
}

export function tryParseDriveFolderId(input: string): string | null {
  const normalized = input.trim();
  if (!normalized) {
    return null;
  }

  const maybeId = isValidDriveId(normalized)
    ? normalized
    : extractFolderIdFromDriveUrl(normalized);

  if (!maybeId) {
    return null;
  }

  return isValidDriveId(maybeId) ? maybeId : null;
}

export function parseDriveFolderId(input: string): string {
  const folderId = tryParseDriveFolderId(input);

  if (!folderId) {
    throw new Error("Invalid Google Drive folder URL or folder ID");
  }

  return folderId;
}
