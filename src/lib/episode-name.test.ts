import { describe, expect, it } from "vitest";

import { parseEpisodeName } from "@/lib/episode-name";

describe("parseEpisodeName", () => {
  it("parses bracketed episode pattern", () => {
    expect(parseEpisodeName("[AniDong][Doupo Cangqiong 5] - Episódio 188.mp4")).toBe(
      "Doupo Cangqiong 5 - 188",
    );
  });

  it("handles different episode labels", () => {
    expect(parseEpisodeName("[SubGroup][My Show] - Episode 42.mkv")).toBe("My Show - 42");
  });

  it("handles [Ep. XX] Title [Metadata] pattern", () => {
    expect(parseEpisodeName("[Ep. 04] Way of Choices - 1T [DonghuaNoSekai] [816p] [PT-BR].mp4")).toBe(
      "Way of Choices - 1T - 04",
    );
  });

  it("handles balanced multiple episode ranges", () => {
    expect(parseEpisodeName("[Ep. 412 [476]  a 414 [478]] Wu Shang Shen Di - 2T [DonghuaNoSekai] [1080p] [PT-BR].mp4")).toBe(
      "Wu Shang Shen Di - 2T - 412 [476]  a 414 [478]",
    );
  });

  it("handles [Ep. XXX a YYY] Title pattern", () => {
    expect(parseEpisodeName("[Ep. 331 a 332] 100.000 Years of Refining Qi - 1T [DonghuaNoSekai] [1080p] [PT-BR].mp4")).toBe(
      "100.000 Years of Refining Qi - 1T - 331 a 332",
    );
  });

  it("handles unbalanced brackets in [Ep. XX] prefix (from image)", () => {
    expect(parseEpisodeName("[Ep. 412 [476] a 414 [478] Wu Shang Shen Di - 2T [Metadata].mp4")).toBe(
      "Wu Shang Shen Di - 2T - 412 [476] a 414 [478",
    );
  });

  it("handles already cleaned names or standard patterns", () => {
    expect(parseEpisodeName("Wu Shang Shen Di - 2T - 403 (467) a 405 (469).mp4")).toBe(
      "Wu Shang Shen Di - 2T - 403 (467) a 405 (469)",
    );
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
