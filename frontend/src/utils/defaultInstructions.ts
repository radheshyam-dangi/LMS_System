/**
 * DEFAULT ASSIGNMENT INSTRUCTIONS
 * Shown to trainees in the submit modal when the trainer has not provided
 * custom instructions. Also pre-filled in the trainer's create/edit form.
 */
export const DEFAULT_ASSIGNMENT_INSTRUCTION_TEXT =
  'Please review all prerequisite lessons carefully and note the objectives before answering the questions below. Ensure your responses are detailed, accurate, and original.';

export const DEFAULT_ASSIGNMENT_INSTRUCTIONS_LIST: string[] = [
  'Prerequisite Review: Thoroughly review preceding module lessons before beginning this assessment.',
  'Question Analysis: For Multiple Choice and Subjective tasks, carefully evaluate technical requirements and edge cases.',
  'Reasoning & Evidence: Articulate structured step-by-step reasoning, citing specific commands, patterns, or architecture.',
  'Quality Standards: Adhere to enterprise production standards, clean code paradigms, and robust error-handling.',
  'Evaluation & Feedback: Submissions undergo automated AI evaluation followed by mandatory trainer review against the grading rubric.'
];

export const DEFAULT_ASSIGNMENT_INSTRUCTIONS = `<ol class="assessment-instructions-list">
  <li><strong>Prerequisite Review:</strong> Thoroughly review preceding module lessons before beginning this assessment.</li>
  <li><strong>Question Analysis:</strong> For Multiple Choice and Subjective tasks, carefully evaluate technical requirements and edge cases.</li>
  <li><strong>Reasoning & Evidence:</strong> Articulate structured step-by-step reasoning, citing specific commands, patterns, or architecture.</li>
  <li><strong>Quality Standards:</strong> Adhere to enterprise production standards, clean code paradigms, and robust error-handling.</li>
  <li><strong>Evaluation & Feedback:</strong> Submissions undergo automated AI evaluation followed by mandatory trainer review against the grading rubric.</li>
</ol>`;

export interface ParsedInstructionItem {
  number: number;
  title: string;
  body: string;
}

/**
 * Parses any raw assignment instructions string (HTML lists, numbered plain text like
 * "1. Prerequisite Review: ... 2. Question Analysis: ...", JSON array, or newline text)
 * into a structured array of Instruction items.
 */
export function parseInstructionsToList(raw: unknown): ParsedInstructionItem[] {
  if (!raw) {
    return DEFAULT_ASSIGNMENT_INSTRUCTIONS_LIST.map((item, idx) => splitTitleAndBody(item, idx + 1));
  }

  // 1. JSON Array
  if (Array.isArray(raw)) {
    const list = raw.map(s => String(s || '').trim()).filter(Boolean);
    if (list.length > 0) {
      return list.map((item, idx) => splitTitleAndBody(item, idx + 1));
    }
  }

  const str = String(raw).trim();
  if (!str) {
    return DEFAULT_ASSIGNMENT_INSTRUCTIONS_LIST.map((item, idx) => splitTitleAndBody(item, idx + 1));
  }

  // If it's a JSON string representing an array: ["...", "..."]
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, idx: number) => splitTitleAndBody(String(item || ''), idx + 1));
      }
    } catch {}
  }

  // 2. HTML containing <li> elements
  if (/<li[^>]*>/i.test(str)) {
    const liMatches = Array.from(str.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
    if (liMatches.length > 0) {
      return liMatches.map((m, idx) => {
        let text = m[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/\s+/g, ' ')
          .trim();
        return splitTitleAndBody(text, idx + 1);
      });
    }
  }

  // Clean HTML tags if any mixed HTML is present
  const plain = str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .trim();

  // If the string is just the old single placeholder text:
  if (
    plain.toLowerCase() === DEFAULT_ASSIGNMENT_INSTRUCTION_TEXT.toLowerCase() ||
    plain.toLowerCase().includes('provide assignment instructions or description here')
  ) {
    return DEFAULT_ASSIGNMENT_INSTRUCTIONS_LIST.map((item, idx) => splitTitleAndBody(item, idx + 1));
  }

  // 3. Numbered patterns like "1. ... 2. ... 3. ..." or "1) ... 2) ..."
  // Even if on a single run-on line (as in Screenshot 1!)
  const numberRegex = /(?:^|\s+)(?:(\d+)[\.\)]\s+)/g;
  const matches = Array.from(plain.matchAll(numberRegex));

  if (matches.length >= 2) {
    const items: ParsedInstructionItem[] = [];
    for (let i = 0; i < matches.length; i++) {
      const startIdx = matches[i].index! + matches[i][0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : plain.length;
      const itemText = plain.slice(startIdx, endIdx).trim();
      const num = parseInt(matches[i][1], 10) || (i + 1);
      if (itemText) {
        items.push(splitTitleAndBody(itemText, num));
      }
    }
    if (items.length > 0) return items;
  }

  // 4. Split by newlines
  const lines = plain
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !/^instructions\s*(?:&|and)?\s*submission\s*guidelines:?$/i.test(line));

  if (lines.length >= 2) {
    return lines.map((l, idx) => {
      const cleanLine = l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*•]\s*/, '').trim();
      return splitTitleAndBody(cleanLine, idx + 1);
    });
  }

  // 5. If it's a single sentence or text, check if it's substantial
  if (plain.length > 10) {
    return [splitTitleAndBody(plain, 1)];
  }

  return DEFAULT_ASSIGNMENT_INSTRUCTIONS_LIST.map((item, idx) => splitTitleAndBody(item, idx + 1));
}

/**
 * Splits "Title: Body text" into separate title and body strings.
 */
function splitTitleAndBody(text: string, number: number): ParsedInstructionItem {
  const cleaned = text.replace(/^\d+[\.\)]\s*/, '').trim();
  const colonIdx = cleaned.indexOf(':');

  if (colonIdx > 0 && colonIdx < 45) {
    const title = cleaned.slice(0, colonIdx).trim();
    const body = cleaned.slice(colonIdx + 1).trim();
    return { number, title, body: body || title };
  }

  return { number, title: '', body: cleaned };
}

/**
 * Converts any instruction payload into a flat string[] array for editing.
 */
export function extractInstructionStrings(raw: unknown): string[] {
  const parsed = parseInstructionsToList(raw);
  return parsed.map(p => (p.title ? `${p.title}: ${p.body}` : p.body));
}

