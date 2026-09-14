/**
 * Client-side parser: converts Tiptap editor JSON tree into the structured
 * payload expected by the LP Authoring backend endpoint.
 *
 * DESIGN DECISION: Order = dependency.
 * The linear position of lesson nodes before an assignment node inside the
 * same module defines that assignment's lesson-dependency list.
 * Do NOT reorder the tree walk — a future dev could accidentally break
 * dependency computation by changing the iteration order.
 */

interface ParsedVideo { url: string; title?: string }
interface ParsedAudio { url: string; title?: string }
interface ParsedResource { url: string; label: string; type: string }

interface ParsedQuestion {
  id: string;
  text: string;
  type: 'MCQ' | 'Subjective';
  maxPoints: number;
  options?: string[];
  correctIndex?: number;
}

interface ParsedLesson {
  id: string;
  title: string;
  description: string;
  videos: ParsedVideo[];
  audios: ParsedAudio[];
  resources: ParsedResource[];
  keyPoints: string[];
}

interface ParsedAssignment {
  id: string;
  title: string;
  body: string;
  questions: ParsedQuestion[];
  dependsOnLessonIds: string[];
  lockConfig: { enabled: boolean };
  evaluation: {
    autoEvaluateWithAI: boolean;
    humanInterventionRequired: boolean;
  };
  timerDuration: { days: number; hours: number; minutes: number };
  countdownStart: string;
}

interface ParsedModule {
  id: string;
  title: string;
  description: string;
  sequentialLessonLock: boolean;
  lessons: ParsedLesson[];
  assignments: ParsedAssignment[];
}

export interface ParsedLPDocument {
  title: string;
  description: string;
  modules: ParsedModule[];
  _draftId?: string;
}

/** Extract plain text from a Tiptap node */
function extractText(node: any): string {
  if (!node) return '';
  if (node.text) return node.text;
  if (node.content) {
    return node.content.map((c: any) => extractText(c)).join('');
  }
  return '';
}

/** Generate simple HTML from a Tiptap rich text node */
function generateHTML(node: any): string {
  if (!node) return '';
  if (node.text) {
    let text = node.text;
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        if (mark.type === 'italic') text = `<em>${text}</em>`;
        if (mark.type === 'code') text = `<code>${text}</code>`;
        if (mark.type === 'link') text = `<a href="${mark.attrs?.href || ''}">${text}</a>`;
      }
    }
    return text;
  }
  if (node.type === 'paragraph') {
    const inner = (node.content || []).map((c: any) => generateHTML(c)).join('');
    return `<p>${inner}</p>`;
  }
  if (node.type === 'bulletList') {
    const items = (node.content || []).map((c: any) => generateHTML(c)).join('');
    return `<ul>${items}</ul>`;
  }
  if (node.type === 'orderedList') {
    const items = (node.content || []).map((c: any) => generateHTML(c)).join('');
    return `<ol>${items}</ol>`;
  }
  if (node.type === 'listItem') {
    const inner = (node.content || []).map((c: any) => generateHTML(c)).join('');
    return `<li>${inner}</li>`;
  }
  if (node.type === 'heading') {
    const level = node.attrs?.level || 2;
    const inner = (node.content || []).map((c: any) => generateHTML(c)).join('');
    return `<h${level}>${inner}</h${level}>`;
  }
  if (node.type === 'hardBreak') return '<br>';
  if (node.content) {
    return node.content.map((c: any) => generateHTML(c)).join('');
  }
  return '';
}

/** Extract list items from a listBlock node */
function extractListItems(node: any): string[] {
  if (!node) return [];
  const items: string[] = [];
  const walk = (n: any) => {
    if (n.type === 'listItem') {
      items.push(extractText(n));
    }
    if (n.content) n.content.forEach(walk);
  };
  walk(node);
  return items;
}

/** Extract questions from an assignment node */
function extractQuestions(node: any): ParsedQuestion[] {
  if (!node?.content) return [];
  return node.content
    .filter((c: any) => c.type === 'questionBlock')
    .map((q: any) => ({
      id: q.attrs?.id || crypto.randomUUID(),
      text: q.attrs?.text || extractText(q),
      type: q.attrs?.questionType || 'Subjective',
      maxPoints: q.attrs?.maxPoints || 10,
      options: q.attrs?.options || [],
      correctIndex: q.attrs?.correctIndex,
    }));
}

function parseLesson(lessonNode: any): ParsedLesson {
  const lesson: ParsedLesson = {
    id: lessonNode.attrs?.id || crypto.randomUUID(),
    title: '',
    description: '',
    videos: [],
    audios: [],
    resources: [],
    keyPoints: [],
  };

  for (const block of lessonNode.content || []) {
    switch (block.type) {
      case 'lessonTitle':
      case 'heading':
        if (!lesson.title) lesson.title = extractText(block);
        break;
      case 'description':
      case 'paragraph':
        lesson.description += generateHTML(block);
        break;
      case 'videoBlock':
        if (block.attrs?.url) lesson.videos.push(block.attrs);
        break;
      case 'audioBlock':
        if (block.attrs?.url) lesson.audios.push(block.attrs);
        break;
      case 'resourceBlock':
        if (block.attrs?.url) lesson.resources.push(block.attrs);
        break;
      case 'listBlock':
      case 'bulletList':
      case 'orderedList':
        lesson.keyPoints.push(...extractListItems(block));
        break;
    }
  }

  return lesson;
}

function parseAssignment(assignmentNode: any): ParsedAssignment {
  const attrs = assignmentNode.attrs || {};

  let title = '';
  let body = '';
  const questions: ParsedQuestion[] = [];

  for (const block of assignmentNode.content || []) {
    switch (block.type) {
      case 'assignmentTitle':
      case 'heading':
        if (!title) title = extractText(block);
        break;
      case 'assignmentBody':
      case 'paragraph':
        body += generateHTML(block);
        break;
      case 'questionBlock':
        questions.push({
          id: block.attrs?.id || crypto.randomUUID(),
          text: block.attrs?.text || extractText(block),
          type: block.attrs?.questionType || 'Subjective',
          maxPoints: block.attrs?.maxPoints || 10,
          options: block.attrs?.options || [],
          correctIndex: block.attrs?.correctIndex,
        });
        break;
    }
  }

  return {
    id: attrs.id || crypto.randomUUID(),
    title,
    body,
    questions,
    dependsOnLessonIds: [], // populated by parseModule
    lockConfig: {
      enabled: attrs.lockUntilLessonsComplete !== false,
    },
    evaluation: {
      autoEvaluateWithAI: attrs.autoEvaluateWithAI === true,
      humanInterventionRequired: attrs.humanInterventionRequired !== false,
    },
    timerDuration: attrs.timerDuration || { days: 0, hours: 0, minutes: 0 },
    countdownStart: attrs.countdownStart || 'onAssignment',
  };
}

function parseModule(moduleNode: any): ParsedModule {
  const attrs = moduleNode.attrs || {};
  const module: ParsedModule = {
    id: attrs.id || crypto.randomUUID(),
    title: '',
    description: '',
    sequentialLessonLock: attrs.sequentialLessonLock !== false,
    lessons: [],
    assignments: [],
  };

  for (const child of moduleNode.content || []) {
    switch (child.type) {
      case 'moduleTitle':
      case 'heading':
        if (!module.title) module.title = extractText(child);
        break;
      case 'paragraph':
        module.description += generateHTML(child);
        break;
      case 'lesson':
        module.lessons.push(parseLesson(child));
        break;
      case 'assignment': {
        const assignment = parseAssignment(child);
        // DEPENDENCY RULE: all lessons parsed SO FAR in THIS module
        assignment.dependsOnLessonIds = module.lessons.map(l => l.id);
        module.assignments.push(assignment);
        break;
      }
    }
  }

  return module;
}

/**
 * Parse a complete Tiptap LP document into the structured payload
 * expected by the backend's POST /lp-authoring/submit endpoint.
 */
export function parseLPDocument(doc: any, draftId?: string): ParsedLPDocument {
  const lp: ParsedLPDocument = {
    title: '',
    description: '',
    modules: [],
  };

  if (draftId) lp._draftId = draftId;

  for (const node of doc.content || []) {
    switch (node.type) {
      case 'lpTitle':
      case 'heading':
        if (!lp.title) lp.title = extractText(node);
        break;
      case 'lpDescription':
      case 'paragraph':
        if (!lp.title) {
          // First text content is title if no lpTitle node
          lp.title = extractText(node);
        } else {
          lp.description += generateHTML(node);
        }
        break;
      case 'module':
        lp.modules.push(parseModule(node));
        break;
    }
  }

  return lp;
}
