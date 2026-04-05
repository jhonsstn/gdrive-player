/**
 * Parses episode display names from filenames like:
 *   "[AniDong][Doupo Cangqiong 5] - Episódio 188.mp4" -> "Doupo Cangqiong 5 - 188"
 *   "[Ep. 04] Way of Choices - 1T [Metadata].mp4" -> "Way of Choices - 1T - 04"
 *   "[Ep. 412 [476] a 414 [478] Wu Shang Shen Di - 2T" -> "Wu Shang Shen Di - 2T - 412 [476] a 414 [478]"
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
  // We use a more flexible approach here than strict bracket balancing because
  // filenames often have typos or nested unbalanced brackets like:
  // "[Ep. 412 [476] a 414 [478] Wu Shang Shen Di - 2T"
  if (name.startsWith("[Ep.")) {
    const lastIndex = name.lastIndexOf("]");
    if (lastIndex !== -1) {
      const epInfo = name.substring(4, lastIndex).trim();
      const rest = name.substring(lastIndex + 1).trim();
      if (rest) {
        return `${rest} - ${epInfo}`;
      }
      return epInfo;
    } else {
      // Fallback if no closing bracket found for [Ep.
      // e.g. "[Ep. 412 Title"
      const parts = name.substring(4).trim().split(/\s+/);
      if (parts.length > 1) {
        const ep = parts[0];
        const rest = parts.slice(1).join(" ");
        return `${rest} - ${ep}`;
      }
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
    const firstClose = name.indexOf("]");
    const secondClose = name.indexOf("]", firstClose + 1);
    if (secondClose !== -1) {
      const rest = name.substring(secondClose + 1).trim();
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
  }

  return name;
}
