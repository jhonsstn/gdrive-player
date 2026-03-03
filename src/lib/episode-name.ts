/**
 * Parses episode display names from filenames like:
 *   "[AniDong][Doupo Cangqiong 5] - Episódio 188.mp4"
 * Result: "Doupo Cangqiong 5 - 188"
 *
 * Falls back to the original filename (without extension) if the pattern doesn't match.
 */
export function parseEpisodeName(filename: string): string {
  const match = filename.match(/^\[[^\]]*\]\[([^\]]+)\]\s*-\s*\S+\s+(\d+)/);

  if (match) {
    return `${match[1]} - ${match[2]}`;
  }

  return filename.replace(/\.[^.]+$/, "");
}
