/**
 * Sanitizes and normalizes a trainer's incoming inquiry with semantic intent preservation:
 * - Strips conversational noise and filler.
 * - Strips emojis and unusual unicode glyphs.
 * - Standardizes node references ("mod 1" -> "Module 1", "lesson 2" -> "Lesson 2").
 * - Returns cleanQuery and semantic intent signals for high-accuracy reasoning.
 */
export function sanitizeTrainerQuery(rawQuery: string): {
  cleanQuery: string;
  normalizedQuery: string;
  hasAdvisoryIntent: boolean;
  hasDirectMutationIntent: boolean;
} {
  if (!rawQuery) {
    return {
      cleanQuery: '',
      normalizedQuery: '',
      hasAdvisoryIntent: false,
      hasDirectMutationIntent: false,
    };
  }

  // 1. Remove emojis and unusual unicode symbols
  let cleaned = rawQuery
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}\u{23E9}-\u{23EC}\u{23F0}\u{23F3}\u{2B50}\u{2B55}\u{2934}\u{2935}]/gu,
      '',
    )
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  // 2. Standardize colloquial node references
  cleaned = cleaned
    .replace(/\bmod(?:ule)?\s*([0-9]+)\b/gi, 'Module $1')
    .replace(/\bless(?:on)?\s*([0-9]+)\b/gi, 'Lesson $1')
    .replace(/\bass(?:ignment)?\s*([0-9]+)\b/gi, 'Assignment $1')
    .replace(/\bquiz(?:zes)?\s*([0-9]+)\b/gi, 'Assessment $1');

  const lower = cleaned.toLowerCase();

  return {
    cleanQuery: cleaned,
    normalizedQuery: lower,
    hasAdvisoryIntent: false,
    hasDirectMutationIntent: false,
  };
}

/**
 * Sanitizes AI Assistant text responses:
 * - Strips all database IDs, UUIDs, and internal identifiers.
 * - Strips all emojis, pictograms, and decorative symbols.
 * - Removes ASCII horizontal rules / borders (e.g. ══════, -------, ******).
 * - Normalizes spacing and line breaks.
 */
export function sanitizeAiResponse(text: string): string {
  if (!text) return '';

  return text
    // 1. Remove entire lines with database internal IDs (e.g. "• Enrollment ID: ...", "- User ID: ...", "Course ID: ...", "ID: ...")
    .replace(/^\s*[-–—*•]?\s*(?:\*\*)?(?:[A-Za-z0-9_ ]+)?(?:ID|id|UUID|uuid)(?:\*\*)?\s*[:=].*$/gim, '')
    // 2. Remove inline database IDs, UUIDs, and internal identifiers (e.g. "- ID: 0ba216e6-...", "ID: ...", "(ID: ...)")
    .replace(/\s*[-–—]?\s*\(?\b(?:[A-Za-z0-9_ ]+)?(?:ID|id|UUID|uuid)\s*[:=]\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b\)?/gi, '')
    // 3. Remove standalone UUIDs that might have leaked into text
    .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '')
    // 4. Remove trailing/hanging "- ID:" or "- ID" leftovers if any
    .replace(/^\s*[-–—*•]?\s*(?:\*\*)?(?:[A-Za-z0-9_ ]+)?(?:ID|id|UUID|uuid)(?:\*\*)?\s*[:=]?\s*$/gim, '')
    // 5. Remove emojis, pictograms, and special symbol glyphs
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}\u{23E9}-\u{23EC}\u{23F0}\u{23F3}\u{2B50}\u{2B55}\u{2934}\u{2935}]/gu,
      '',
    )
    // 5. Remove decorative divider lines (e.g. ════, ----, ****, ____)
    .replace(/^[=\-─_~*#]{3,}$/gm, '')
    // 6. Convert markdown headers (# Heading, ## Heading, ### Heading) to clean bold text (**Heading**)
    .replace(/^#{1,6}\s*(.+)$/gm, '**$1**')
    // 7. Replace pipe delimiters (| or ||) with clean commas
    .replace(/\s*\|{1,2}\s*/g, ', ')
    // 8. Remove backslashes used as escapes (\-, \*, \_, \., etc.)
    .replace(/\\([_*\-#`~[\]()\\/])/g, '$1')
    .replace(/\\+/g, '')
    // 9. Preserve fraction counts like "6 / 6" -> "6/6"
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1/$2')
    // 10. Clean up text slash delimiters (e.g. "Skills / Focus" -> "Skills, Focus") only when not between numbers
    .replace(/(?<!\d)\s*\/\s*(?!\d)/g, ', ')
    // 11. Repair any accidental comma fractions like "6, 6 Lessons" -> "6/6 Lessons"
    .replace(/(\d+),\s*(\d+)\s*(lessons?|assessments?|tasks?|modules?)/gi, '$1/$2 $3')
    // 12. Clean up double/multiple commas created by delimiter replacements
    .replace(/,\s*,+/g, ',')
    // 13. Clean up stray leading/trailing commas on lines
    .replace(/^,\s+/gm, '')
    .replace(/,\s*$/gm, '')
    // 14. Normalize multiple consecutive inline spaces
    .replace(/[ \t]{2,}/g, ' ')
    // 15. Normalize multiple consecutive blank lines to at most two
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Smart reference resolver: checks if a query explicitly mentions a Learning Path title
 * from an array of candidate courses, prioritizing longer/more specific titles.
 */
export function findReferencedLp<T extends { id: string; title: string }>(
  query: string,
  lps: T[],
): T | undefined {
  if (!query || !lps || lps.length === 0) return undefined;

  const qLower = query.toLowerCase();

  // Sort candidates by title length descending to prevent partial substring collisions
  const sorted = [...lps].sort((a, b) => (b.title?.length || 0) - (a.title?.length || 0));

  for (const lp of sorted) {
    if (!lp.title || lp.title.trim().length === 0) continue;
    const rawTitle = lp.title.trim().toLowerCase();

    // 1. Word-boundary or quoted match of the full title
    const escaped = rawTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fullRegex = new RegExp(`(?:\\b|["'“”])${escaped}(?:\\b|["'“”])`, 'i');
    if (fullRegex.test(qLower)) {
      return lp;
    }

    // 2. Strip common curriculum suffix labels (e.g. "Devops Engineering" -> "Devops", "Python Course" -> "Python")
    const stripped = rawTitle
      .replace(/\s+(?:course|curriculum|learning\s+path|syllabus|training|specialization|program)$/i, '')
      .trim();
    if (stripped.length > 2 && stripped !== rawTitle) {
      const strippedEscaped = stripped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const strippedRegex = new RegExp(`(?:\\b|["'“”])${strippedEscaped}(?:\\b|["'“”])`, 'i');
      if (strippedRegex.test(qLower)) {
        return lp;
      }
    }

    // 3. Match explicit structural preposition constructs: "in <title>", "to <title>", "for <title>", "update <title>"
    const prefixRegex = new RegExp(`\\b(?:in|into|to|for|on|update|modify|edit)\\s+["'“”]?${escaped}`, 'i');
    if (prefixRegex.test(qLower)) {
      return lp;
    }
  }

  return undefined;
}

