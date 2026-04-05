/**
 * Helper to find the matching closing bracket for an opening bracket at a given index.
 */
function getMatchingBracketIndex(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "[") depth++;
    else if (s[i] === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parses episode display names from filenames like:
 *   "[AniDong][Doupo Cangqiong 5] - Episódio 188.mp4" -> "Doupo Cangqiong 5 - 188"
 *   "[Ep. 04] Way of Choices - 1T [Metadata].mp4" -> "Way of Choices - 1T - 04"
 *
 * Falls back to the original filename (without extension) if the pattern doesn't match.
 */
export function parseEpisodeName(filename: string): string {
  // Remove extension
  let name = filename.replace(/\.[^.]+$/, "");

  // 1. Remove trailing metadata blocks like [DonghuaNoSekai] [1080p] [PT-BR]
  // We do this first so we can focus on the core title and episode prefix
  while (true) {
    const lastBracketMatch = name.match(/\s*\[([^\]]+)\]$/);
    if (!lastBracketMatch) break;
    
    // Don't remove it if it looks like it might be the only thing left or important
    // But usually these tags at the end are metadata
    name = name.substring(0, name.lastIndexOf(lastBracketMatch[0])).trim();
  }

  // 2. Handle [Ep. XXX] prefix
  if (name.startsWith("[Ep.")) {
    const closingIndex = getMatchingBracketIndex(name, 0);
    if (closingIndex !== -1) {
      const epInfo = name.substring(4, closingIndex).trim();
      const rest = name.substring(closingIndex + 1).trim();
      if (rest) {
        return `${rest} - ${epInfo}`;
      }
      return epInfo; // Fallback if only [Ep. XXX] exists
    }
  }

  // 3. Handle original pattern: [Group][Title] - Label Episode
  // Example: [AniDong][Doupo Cangqiong 5] - Episódio 188
  const originalMatch = name.match(/^\[[^\]]+\]\[([^\]]+)\]\s*-\s*(?:.+?\s+)?(\d+)/);
  if (originalMatch) {
    return `${originalMatch[1]} - ${originalMatch[2]}`;
  }

  // 4. Handle simple [Group][Title] without episode at the end
  const simpleGroupMatch = name.match(/^\[[^\]]+\]\[([^\]]+)\]/);
  if (simpleGroupMatch) {
    const rest = name.substring(name.indexOf("]", name.indexOf("]") + 1) + 1).trim();
    if (rest) {
      // If there's more after the brackets, it might be an episode label
      const epMatch = rest.match(/^(?:-\s*)?(?:.+?\s+)?(\d+)/);
      if (epMatch) {
        return `${simpleGroupMatch[1]} - ${epMatch[1]}`;
      }
      return `${simpleGroupMatch[1]} ${rest}`.trim();
    }
    return simpleGroupMatch[1];
  }

  return name;
}
