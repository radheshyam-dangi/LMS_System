/**
 * Shared lock evaluation logic used by both frontend UI state
 * and backend authorization checks.
 */

export interface LockConfig {
  enabled: boolean;
}

export interface AssignmentContext {
  id?: string;
  lockConfig?: LockConfig;
  lockUntilLessonsComplete?: boolean; // Sometimes directly on assignment in DB
  dependsOnLessonIds?: string[];
}

export interface LessonContext {
  id: string;
}

export interface ModuleContext {
  sequentialLessonLock: boolean;
  taskLocking?: boolean; // From backend entity
  lessons?: LessonContext[];
}

export interface TraineeProgress {
  completedLessonIds: string[];
}

/**
 * Evaluates if a lesson is unlocked for a trainee.
 * If sequentialLessonLock is true, lesson N is locked until lesson N-1 is completed.
 */
export function isLessonUnlocked(
  lesson: LessonContext,
  index: number,
  module: ModuleContext,
  traineeProgress: TraineeProgress
): boolean {
  if (module.sequentialLessonLock === false) return true;
  if (index === 0) return true;
  
  if (!module.lessons || !module.lessons[index - 1]) return true;
  
  const previousLessonId = String(module.lessons[index - 1].id);
  const completedIds = traineeProgress.completedLessonIds.map(String);
  return completedIds.includes(previousLessonId);
}

/**
 * Evaluates if an assignment is unlocked for a trainee.
 * If lockUntilLessonsComplete is true, the assignment stays locked until
 * ALL its dependent lessons are completed.
 */
export function isAssignmentUnlocked(
  assignment: AssignmentContext,
  traineeProgress: TraineeProgress
): boolean {
  const isEnabled = assignment.lockConfig?.enabled ?? assignment.lockUntilLessonsComplete ?? false;
  
  if (!isEnabled) return true;
  
  const depIds = assignment.dependsOnLessonIds || [];
  if (depIds.length === 0) return true; // Edge case: assignment locked but zero preceding lessons -> treat as unlocked
  
  const completedIds = traineeProgress.completedLessonIds.map(String);
  return depIds.every(id => completedIds.includes(String(id)));
}
