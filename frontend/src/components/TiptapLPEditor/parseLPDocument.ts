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
  expectedAnswerGuideline?: string;
  requiresLessonGrounding?: boolean;
  lessonDependencies?: string[];
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
  assignmentType: string;
}

interface ParsedModule {
  id: string;
  title: string;
  description: string;
  sequentialLessonLock: boolean;
  learningObjectives?: string[];
  learningOutcomes?: string[];
  moduleResources?: ParsedResource[];
  lessons: ParsedLesson[];
  assignments: ParsedAssignment[];
}

export interface ParsedLPDocument {
  title: string;
  description: string;
  level?: string;
  status?: string;
  modules: ParsedModule[];
  _draftId?: string;
  id?: string;
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
    .map((q: any) => {
      let qText = '';
      const qOptions: string[] = [];
      
      for (const child of q.content || []) {
        if (child.type === 'paragraph') {
          qText += extractText(child) + '\\n';
        } else if (child.type === 'bulletList' || child.type === 'orderedList') {
          qOptions.push(...extractListItems(child));
        }
      }

      const type = q.attrs?.questionType || 'Subjective';
      const options = (type === 'MCQ' && Array.isArray(q.attrs?.options) && q.attrs.options.length > 0) 
        ? q.attrs.options 
        : qOptions;

      return {
        id: q.attrs?.id || crypto.randomUUID(),
        text: qText.trim() || 'Untitled Question',
        type,
        maxPoints: q.attrs?.maxPoints || 10,
        options,
        correctIndex: q.attrs?.correctIndex,
        expectedAnswerGuideline: q.attrs?.expectedAnswerGuideline || '',
      };
    });
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
      case 'questionBlock': {
        let qText = '';
        const qOptions: string[] = [];
        
        for (const child of block.content || []) {
          if (child.type === 'paragraph') {
            qText += extractText(child) + '\\n';
          } else if (child.type === 'bulletList' || child.type === 'orderedList') {
            qOptions.push(...extractListItems(child));
          }
        }
        
        const type = block.attrs?.questionType || 'Subjective';
        const options = (type === 'MCQ' && Array.isArray(block.attrs?.options) && block.attrs.options.length > 0) 
          ? block.attrs.options 
          : qOptions;

        questions.push({
          id: block.attrs?.id || crypto.randomUUID(),
          text: qText.trim() || 'Untitled Question',
          type,
          maxPoints: block.attrs?.maxPoints || 10,
          options,
          correctIndex: block.attrs?.correctIndex,
          expectedAnswerGuideline: block.attrs?.expectedAnswerGuideline || '',
          requiresLessonGrounding: block.attrs?.requiresLessonGrounding !== false,
          lessonDependencies: block.attrs?.lessonDependencies || []
        });
        break;
      }
    }
  }

  return {
    id: attrs.id || crypto.randomUUID(),
    title,
    body,
    questions,
    dependsOnLessonIds: attrs.dependsOnLessonIds !== undefined ? attrs.dependsOnLessonIds : null, // will be resolved in parseModule
    lockConfig: {
      enabled: attrs.lockUntilLessonsComplete !== false,
    },
    evaluation: {
      autoEvaluateWithAI: attrs.autoEvaluateWithAI === true,
      humanInterventionRequired: attrs.humanInterventionRequired !== false,
    },
    timerDuration: attrs.timerDuration || { days: 0, hours: 0, minutes: 0 },
    countdownStart: attrs.countdownStart || 'onAssignment',
    assignmentType: attrs.assignmentType || 'Mixed',
  };
}

function parseModule(moduleNode: any): ParsedModule {
  const attrs = moduleNode.attrs || {};
  const module: ParsedModule = {
    id: attrs.id || crypto.randomUUID(),
    title: '',
    description: '',
    sequentialLessonLock: attrs.sequentialLessonLock !== false,
    learningObjectives: attrs.learningObjectives || [],
    learningOutcomes: attrs.learningOutcomes || [],
    moduleResources: attrs.moduleResources || [],
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
        // DEPENDENCY RULE: If explicit selection is null, depend on all preceding lessons
        if (assignment.dependsOnLessonIds === null) {
          assignment.dependsOnLessonIds = module.lessons.map(l => l.id);
        } else {
          // Otherwise, filter the explicit array to ensure they actually exist as preceding lessons
          const precedingIds = new Set(module.lessons.map(l => l.id));
          assignment.dependsOnLessonIds = (assignment.dependsOnLessonIds as string[]).filter(id => precedingIds.has(id));
        }
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
export function parseLPDocument(doc: any, draftId?: string, pathId?: string): ParsedLPDocument {
  const lp: ParsedLPDocument = {
    title: '',
    description: '',
    level: doc?.attrs?.level || 'basic',
    status: doc?.attrs?.status || 'upcoming',
    modules: [],
  };

  if (draftId) lp._draftId = draftId;
  if (pathId) lp.id = pathId;

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
