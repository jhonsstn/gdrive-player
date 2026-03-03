import { describe, expect, it } from "vitest";

import { parseEpisodeName } from "@/lib/episode-name";

describe("parseEpisodeName", () => {
  it("parses bracketed episode pattern", () => {
    expect(
      parseEpisodeName("[AniDong][Doupo Cangqiong 5] - Episódio 188.mp4"),
    ).toBe("Doupo Cangqiong 5 - 188");
  });

  it("handles different episode labels", () => {
    expect(
      parseEpisodeName("[SubGroup][My Show] - Episode 42.mkv"),
    ).toBe("My Show - 42");
  });

  it("falls back to filename without extension for non-matching names", () => {
    expect(parseEpisodeName("random-video.mp4")).toBe("random-video");
  });

  it("falls back for names with no brackets", () => {
    expect(parseEpisodeName("My Video File.webm")).toBe("My Video File");
  });

  it("handles names with no extension", () => {
    expect(parseEpisodeName("no-extension")).toBe("no-extension");
  });
});
