/**
 * Custom Tiptap Node Extensions for LP Authoring
 *
 * This file defines all custom node types used in the Tiptap LP editor.
 * Each node maps to a structural element of the Learning Path:
 *
 *   doc → lpTitle, lpDescription, module[]
 *   module → moduleTitle, lesson[], assignment[]
 *   lesson → lessonTitle, description, videoBlock, audioBlock, resourceBlock, listBlock
 *   assignment → assignmentTitle, assignmentBody, questionBlock[]
 *
 * Custom nodes use Tiptap's Node.create() API with React NodeViews
 * for interactive rendering (toggles, inputs, etc).
 */
import { Node, mergeAttributes } from '@tiptap/core';

/** UUID generator */
const uid = () => crypto.randomUUID();

// ─────────────────────────────────────────────
// MODULE NODE
// ─────────────────────────────────────────────
export const ModuleNode = Node.create({
  name: 'module',
  group: 'block',
  content: '(heading | paragraph | lesson | assignment)*',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: { default: null, parseHTML: el => el.getAttribute('data-id') || uid() },
      sequentialLessonLock: { default: true },
      learningObjectives: { default: [] },
      learningOutcomes: { default: [] },
      moduleResources: { default: [] },
      description: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="module"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'module',
      class: 'tiptap-module-node',
    }), 0];
  },
});

// ─────────────────────────────────────────────
// LESSON NODE
// ─────────────────────────────────────────────
export const LessonNode = Node.create({
  name: 'lesson',
  group: 'block',
  content: '(heading | paragraph | videoBlock | audioBlock | resourceBlock | bulletList | orderedList)*',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: { default: null, parseHTML: el => el.getAttribute('data-id') || uid() },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="lesson"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'lesson',
      class: 'tiptap-lesson-node',
    }), 0];
  },
});

// ─────────────────────────────────────────────
// ASSIGNMENT NODE
// ─────────────────────────────────────────────
export const AssignmentNode = Node.create({
  name: 'assignment',
  group: 'block',
  content: '(heading | paragraph | questionBlock)*',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: { default: null, parseHTML: el => el.getAttribute('data-id') || uid() },
      lockUntilLessonsComplete: { default: true },
      autoEvaluateWithAI: { default: false },
      humanInterventionRequired: { default: true },
      countdownStart: { default: 'onAssignment' },
      timerDuration: { default: { days: 3, hours: 0, minutes: 0 } },
      dependsOnLessonIds: { default: null },
      assignmentType: { default: 'Mixed' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="assignment"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'assignment',
      class: 'tiptap-assignment-node',
    }), 0];
  },
});

// ─────────────────────────────────────────────
// VIDEO BLOCK NODE
// ─────────────────────────────────────────────
export const VideoBlockNode = Node.create({
  name: 'videoBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="videoBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'videoBlock',
      class: 'tiptap-video-block',
    }), `🎬 Video: ${HTMLAttributes.url || '(no URL)'}`];
  },
});

// ─────────────────────────────────────────────
// AUDIO BLOCK NODE
// ─────────────────────────────────────────────
export const AudioBlockNode = Node.create({
  name: 'audioBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="audioBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'audioBlock',
      class: 'tiptap-audio-block',
    }), `🎵 Audio: ${HTMLAttributes.url || '(no URL)'}`];
  },
});

// ─────────────────────────────────────────────
// RESOURCE BLOCK NODE
// ─────────────────────────────────────────────
export const ResourceBlockNode = Node.create({
  name: 'resourceBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: '' },
      label: { default: '' },
      type: { default: 'Link' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="resourceBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'resourceBlock',
      class: 'tiptap-resource-block',
    }), `📎 Resource: ${HTMLAttributes.label || HTMLAttributes.url || '(no URL)'}`];
  },
});

// ─────────────────────────────────────────────
// QUESTION BLOCK NODE
// ─────────────────────────────────────────────
export const QuestionBlockNode = Node.create({
  name: 'questionBlock',
  group: 'block',
  content: 'paragraph bulletList?',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: { default: null, parseHTML: el => el.getAttribute('data-id') || uid() },
      questionType: { default: 'Subjective' },
      maxPoints: { default: 10 },
      correctIndex: { default: null },
      expectedAnswerGuideline: { default: '' },
      options: { default: ['', '', '', ''] },
      requiresLessonGrounding: { default: true },
      lessonDependencies: { default: [] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="questionBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'questionBlock',
      class: 'tiptap-question-block',
    }), `❓ ${HTMLAttributes.questionType} Question: ${HTMLAttributes.text || '(empty)'}`];
  },
});
