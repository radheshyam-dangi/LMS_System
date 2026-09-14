/**
 * Client-side validation for the parsed LP document.
 * Runs before submit — blocks submit and highlights errors in the UI.
 * Server-side validation is the source of truth (never trust client alone).
 */

import type { ParsedLPDocument } from './parseLPDocument';

export interface ValidationError {
  path: string; // e.g. "modules[0].lessons[1]"
  message: string;
  isWarning?: boolean; // If true, shows in UI but does not block submit
}

export function validateLPDocument(doc: ParsedLPDocument): ValidationError[] {
  const errors: ValidationError[] = [];

  // LP-level
  if (!doc.title?.trim()) {
    errors.push({ path: 'title', message: 'Learning Path title is required.' });
  }

  if (!doc.modules?.length) {
    errors.push({ path: 'modules', message: 'At least one module is required.' });
  }

  // Module-level
  for (let mi = 0; mi < (doc.modules || []).length; mi++) {
    const mod = doc.modules[mi];
    const modPath = `modules[${mi}]`;
    const modLabel = mod.title || `Module ${mi + 1}`;

    if (!mod.lessons?.length) {
      errors.push({
        path: `${modPath}.lessons`,
        message: `${modLabel}: At least one lesson is required.`,
      });
    }

    // Lesson-level
    for (let li = 0; li < (mod.lessons || []).length; li++) {
      const lesson = mod.lessons[li];
      const lessonPath = `${modPath}.lessons[${li}]`;
      const lessonLabel = lesson.title || `Lesson ${li + 1}`;

      if (!lesson.title?.trim()) {
        errors.push({
          path: `${lessonPath}.title`,
          message: `${modLabel} → ${lessonLabel}: Title is required.`,
        });
      }

      const hasContent =
        !!lesson.description?.trim() ||
        lesson.videos?.length > 0 ||
        lesson.audios?.length > 0 ||
        lesson.resources?.length > 0 ||
        lesson.keyPoints?.length > 0;

      if (!hasContent) {
        errors.push({
          path: lessonPath,
          message: `${modLabel} → ${lessonLabel}: At least one content block is required.`,
        });
      }
    }

    // Assignment-level
    for (let ai = 0; ai < (mod.assignments || []).length; ai++) {
      const assignment = mod.assignments[ai];
      const aPath = `${modPath}.assignments[${ai}]`;
      const aLabel = assignment.title || `Assignment ${ai + 1}`;

      // I2: This is a WARN not an error — the assignment is usable, just always-unlocked
      if (
        assignment.lockConfig?.enabled &&
        assignment.dependsOnLessonIds?.length === 0
      ) {
        errors.push({
          path: aPath,
          isWarning: true, // Non-blocking — submit still allowed
          message: `⚠️ ${modLabel} → ${aLabel}: Lock is enabled but no preceding lessons exist. Assignment will be always-unlocked until lessons are added.`,
        });
      }

      // AI evaluation needs grounding content
      if (assignment.evaluation?.autoEvaluateWithAI) {
        if (assignment.dependsOnLessonIds?.length === 0) {
          errors.push({
            path: `${aPath}.evaluation`,
            message: `${modLabel} → ${aLabel}: AI evaluation enabled but no dependent lessons to ground on.`,
          });
        }
      }
    }
  }

  return errors;
}
