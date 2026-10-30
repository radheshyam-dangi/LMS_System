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

  // 3. Detect advisory / logical / consultative intent
  const hasAdvisoryIntent =
    /(?:why|how|what|which|where|when|who|suggest|recommend|advice|advise|idea|review|analyze|analysis|evaluate|evaluation|critique|feedback|gap|pros and cons|compare|difference|overview|summary|summarize|explain|tell me|opinion|rationale|logic|guidance|guide|prerequisite|best practice|should i|could we)\b/i.test(
      lower,
    );

  // 4. Detect direct mutation command intent (e.g. "Add lesson Kafka in Module 1", "Delete Module 2", "Can you add one more module inside...")
  const hasDirectMutationIntent =
    /(?:^|\b)(?:can\s+you\s+|could\s+you\s+|please\s+|i\s+want\s+to\s+|i\s+would\s+like\s+to\s+|we\s+need\s+to\s+)?(?:add|insert|append|attach|embed|put|delete|remove|drop|rename|replace|create|make|update|modify|edit)\s+(?:a\s+|an\s+|the\s+|one\s+|\d+\s+)?(?:new\s+|more\s+)?(?:lesson|module|assignment|task|question|quiz|video|resource|doc)s?\b/i.test(
      lower,
    ) ||
    /(?:^|\b)(?:please\s+)?(?:upgrade|restructure|rebuild|revise|modify|refactor)\s+(?:the\s+)?(?:curriculum|learning\s+path|course|syllabus)\b/i.test(
      lower,
    ) ||
    /\b(?:delete|remove|drop|discard|omit|trash|erase)\s+(?:the\s+|a\s+|an\s+|this\s+|that\s+)?(?:lesson|module|assignment|task|question|quiz|video|resource)s?\b/i.test(
      lower,
    ) ||
    /\b(?:lesson|module|assignment|task|question|quiz|video|resource)s?\s*(?:[0-9]+)?\s*.*?\b(?:delete|remove|drop|discard|erase|trash)\b/i.test(
      lower,
    ) ||
    /\b(?:still\s+visible\s+)?(?:remove|delete|drop)\s+(?:it|this|that|them)\b/i.test(
      lower,
    );

  return {
    cleanQuery: cleaned,
    normalizedQuery: lower,
    hasAdvisoryIntent,
    hasDirectMutationIntent,
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
    // 1. Remove database IDs, UUIDs, and internal identifiers (e.g. "- ID: 0ba216e6-...", "ID: ...", "(ID: ...)")
    .replace(/\s*[-–—]?\s*\(?\b(?:ID|id|UUID|uuid)\s*[:=]\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b\)?/gi, '')
    // 2. Remove standalone UUIDs that might have leaked into text
    .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '')
    // 3. Remove trailing/hanging "- ID:" or "- ID" leftovers if any
    .replace(/\s*[-–—]\s*(?:ID|id)\s*[:=]?\s*$/gm, '')
    // 4. Remove emojis, pictograms, and special symbol glyphs
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
    // 9. Clean up slash delimiters (e.g. "Skills / Focus" -> "Skills, Focus" or " / " -> ", ")
    .replace(/\s+\/\s+/g, ', ')
    // 10. Clean up double/multiple commas created by delimiter replacements
    .replace(/,\s*,+/g, ',')
    // 11. Clean up stray leading/trailing commas on lines
    .replace(/^,\s+/gm, '')
    .replace(/,\s*$/gm, '')
    // 12. Normalize multiple consecutive inline spaces
    .replace(/[ \t]{2,}/g, ' ')
    // 13. Normalize multiple consecutive blank lines to at most two
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

