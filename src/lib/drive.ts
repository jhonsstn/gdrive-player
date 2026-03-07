import { ALLOWED_VIDEO_MIME_TYPES, isAllowedVideoMimeType } from "@/lib/video-mime";

const DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3";
const DRIVE_LIST_FIELDS = "nextPageToken,files(id,name,mimeType,size,modifiedTime)";

export type DriveVideoFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  folderId: string;
  modifiedTime: string | null;
};

export class DriveRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DriveRequestError";
  }
}

type DriveListResponse = {
  nextPageToken?: string;
  files?: Array<{
    id?: string;
    name?: string;
    mimeType?: string;
    size?: string;
    modifiedTime?: string;
  }>;
};

function makeAuthHeaders(accessToken: string, range?: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(range ? { Range: range } : {}),
  };
}

async function parseDriveErrorMessage(response: Response): Promise<string> {
  try {
    const parsed = (await response.json()) as {
      error?: { message?: string };
    };

    if (parsed.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Ignore parse failure and return fallback message below.
  }

  return `Google Drive request failed with status ${response.status}`;
}

async function listFolderPage(
  accessToken: string,
  folderId: string,
  pageToken?: string,
): Promise<DriveListResponse> {
  const search = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: DRIVE_LIST_FIELDS,
    pageSize: "1000",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  if (pageToken) {
    search.set("pageToken", pageToken);
  }

  const response = await fetch(`${DRIVE_API_BASE_URL}/files?${search.toString()}`, {
    headers: makeAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const message = await parseDriveErrorMessage(response);
    throw new DriveRequestError(message, response.status);
  }

  return (await response.json()) as DriveListResponse;
}

export async function getFolderName(accessToken: string, folderId: string): Promise<string> {
  const search = new URLSearchParams({
    fields: "name",
    supportsAllDrives: "true",
  });

  const response = await fetch(
    `${DRIVE_API_BASE_URL}/files/${encodeURIComponent(folderId)}?${search.toString()}`,
    { headers: makeAuthHeaders(accessToken) },
  );

  if (!response.ok) {
    const message = await parseDriveErrorMessage(response);
    throw new DriveRequestError(message, response.status);
  }

  const data = (await response.json()) as { name?: string };
  return data.name ?? folderId;
}

export async function listFolderVideos(
  accessToken: string,
  folderId: string,
): Promise<DriveVideoFile[]> {
  const videos: DriveVideoFile[] = [];
  let pageToken: string | undefined;

  do {
    const page = await listFolderPage(accessToken, folderId, pageToken);

    for (const file of page.files ?? []) {
      if (!file.id || !file.name || !file.mimeType) {
        continue;
      }

      if (!isAllowedVideoMimeType(file.mimeType)) {
        continue;
      }

      videos.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ?? null,
        folderId,
        modifiedTime: file.modifiedTime ?? null,
      });
    }

    pageToken = page.nextPageToken;
  } while (pageToken);

  return videos;
}

export async function listFolderVideosPage(
  accessToken: string,
  folderId: string,
  options: { pageToken?: string; pageSize?: number; sortDirection?: "asc" | "desc" },
): Promise<{ videos: DriveVideoFile[]; nextPageToken: string | undefined }> {
  const { pageToken, pageSize = 50, sortDirection = "desc" } = options;
  const mimeTypeFilter = [...ALLOWED_VIDEO_MIME_TYPES].map((m) => `mimeType='${m}'`).join(" or ");
  const search = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false and (${mimeTypeFilter})`,
    fields: DRIVE_LIST_FIELDS,
    pageSize: String(pageSize),
    orderBy: sortDirection === "asc" ? "name" : "name desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  if (pageToken) {
    search.set("pageToken", pageToken);
  }

  const response = await fetch(`${DRIVE_API_BASE_URL}/files?${search.toString()}`, {
    headers: makeAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const message = await parseDriveErrorMessage(response);
    throw new DriveRequestError(message, response.status);
  }

  const page = (await response.json()) as DriveListResponse;
  const videos: DriveVideoFile[] = [];

  for (const file of page.files ?? []) {
    if (!file.id || !file.name || !file.mimeType) continue;
    videos.push({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ?? null,
      folderId,
      modifiedTime: file.modifiedTime ?? null,
    });
  }

  return { videos, nextPageToken: page.nextPageToken };
}

export async function getLatestVideoModifiedTime(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const mimeTypeFilter = [...ALLOWED_VIDEO_MIME_TYPES].map((m) => `mimeType='${m}'`).join(" or ");
  const search = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false and (${mimeTypeFilter})`,
    orderBy: "modifiedTime desc",
    pageSize: "1",
    fields: "files(modifiedTime)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const response = await fetch(`${DRIVE_API_BASE_URL}/files?${search.toString()}`, {
    headers: makeAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const message = await parseDriveErrorMessage(response);
    throw new DriveRequestError(message, response.status);
  }

  const data = (await response.json()) as { files?: Array<{ modifiedTime?: string }> };
  return data.files?.[0]?.modifiedTime ?? null;
}

export async function streamDriveFile(
  accessToken: string,
  fileId: string,
  rangeHeader?: string | null,
): Promise<Response> {
  const response = await fetch(
    `${DRIVE_API_BASE_URL}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: makeAuthHeaders(accessToken, rangeHeader ?? undefined),
    },
  );

  if (!response.ok) {
    const message = await parseDriveErrorMessage(response);
    throw new DriveRequestError(message, response.status);
  }

  return response;
}

export function getStreamPassthroughHeaders(source: Headers): Headers {
  const passthrough = new Headers();

  const headerNames = [
    "accept-ranges",
    "cache-control",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ];

  for (const header of headerNames) {
    const value = source.get(header);
    if (value) {
      passthrough.set(header, value);
    }
  }

  return passthrough;
}
