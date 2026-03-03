export const ALLOWED_VIDEO_MIME_TYPES = new Set<string>([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
  "video/mpeg",
  "video/3gpp",
  "video/3gpp2",
]);

export function isAllowedVideoMimeType(
  mimeType: string | null | undefined,
): boolean {
  if (!mimeType) {
    return false;
  }

  return ALLOWED_VIDEO_MIME_TYPES.has(mimeType);
}
