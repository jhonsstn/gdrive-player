import { describe, expect, it } from "vitest";

import { ALLOWED_VIDEO_MIME_TYPES, isAllowedVideoMimeType } from "@/lib/video-mime";

describe("video-mime", () => {
  it("accepts all allowed MIME types", () => {
    for (const mime of ALLOWED_VIDEO_MIME_TYPES) {
      expect(isAllowedVideoMimeType(mime)).toBe(true);
    }
  });

  it("rejects non-video MIME types", () => {
    expect(isAllowedVideoMimeType("image/png")).toBe(false);
    expect(isAllowedVideoMimeType("application/pdf")).toBe(false);
    expect(isAllowedVideoMimeType("text/plain")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isAllowedVideoMimeType(null)).toBe(false);
    expect(isAllowedVideoMimeType(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isAllowedVideoMimeType("")).toBe(false);
  });
});
