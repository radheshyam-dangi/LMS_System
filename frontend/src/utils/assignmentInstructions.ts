import { DEFAULT_ASSIGNMENT_INSTRUCTIONS } from './defaultInstructions';
import { isTiptapContentEmpty } from './textUtils';

/**
 * Returns the trainer-authored instructions regardless of which historic
 * assignment field stored them. Older assignments used `description`, while
 * newer ones use `instructions`.
 */
export function resolveAssignmentInstructions(assignment: any) {
  const isMeaningful = (value: unknown): value is string => {
    if (typeof value !== 'string' || isTiptapContentEmpty(value)) return false;
    const text = value.replace(/<[^>]*>/g, '').replace(/\u00a0/g, ' ').trim().toLowerCase();
    return text !== 'assignment instructions...';
  };

  const content = isMeaningful(assignment?.instructions)
    ? assignment.instructions
    : isMeaningful(assignment?.description)
      ? assignment.description
      : DEFAULT_ASSIGNMENT_INSTRUCTIONS;

  return { content, hasCustom: content !== DEFAULT_ASSIGNMENT_INSTRUCTIONS };
}
