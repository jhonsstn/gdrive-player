import { describe, expect, it } from "vitest";

import { parseDriveFolderId, tryParseDriveFolderId } from "@/lib/drive-url";

describe("drive-url parser", () => {
  it("parses folder id from standard drive folder URL", () => {
    expect(
      parseDriveFolderId(
        "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr",
      ),
    ).toBe("1AbCdEfGhIjKlMnOpQr");
  });

  it("parses folder id from open id URL", () => {
    expect(
      parseDriveFolderId("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQr"),
    ).toBe("1AbCdEfGhIjKlMnOpQr");
  });

  it("accepts a direct folder id", () => {
    expect(parseDriveFolderId("1AbCdEfGhIjKlMnOpQr")).toBe(
      "1AbCdEfGhIjKlMnOpQr",
    );
  });

  it("returns null for invalid input in safe parser", () => {
    expect(tryParseDriveFolderId("https://example.com/not-drive")).toBeNull();
    expect(tryParseDriveFolderId("short")).toBeNull();
  });
});
