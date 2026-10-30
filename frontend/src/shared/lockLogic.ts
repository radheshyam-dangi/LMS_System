/**
 * Shared lock evaluation logic used by both frontend UI state
 * and backend authorization checks.
 */

export interface LockConfig {
  enabled: boolean;
}

export interface AssignmentContext {
  id?: string;
  title?: string;
  lockConfig?: LockConfig;
  lockUntilLessonsComplete?: boolean; // Sometimes directly on assignment in DB
  dependsOnLessonIds?: string[] | null;
}

export interface LessonContext {
  id?: string;
  title?: string;
  displayOrder?: number;
  orderIndex?: number;
  createdAt?: string | Date;
}

export interface ModuleContext {
  id?: string;
  title?: string;
  sequentialLessonLock?: boolean;
  lessonLocking?: boolean;
  taskLocking?: boolean; // From backend entity
  lessons?: LessonContext[];
  assignments?: AssignmentContext[];
  displayOrder?: number;
  orderIndex?: number;
  createdAt?: string | Date;
}

export interface TraineeProgress {
  completedLessonIds: string[];
}

export interface ModuleLockResult {
  isUnlocked: boolean;
  lockReason?: string;
  previousModuleTitle?: string;
}

export interface ItemLockResult {
  isUnlocked: boolean;
  lockReason?: string;
  prerequisites?: string[];
}

/**
 * Sorts curriculum modules to strictly maintain canonical sequence order
 * (e.g. Module 1 -> Module 2 -> Module 3).
 */
export function sortCurriculumModules<T extends any = any>(
  modules: T[]
): T[] {
  return [...modules].sort((a: any, b: any) => {
    // 1. Explicit display/order index
    const orderA = a?.orderIndex ?? a?.displayOrder ?? a?.order;
    const orderB = b?.orderIndex ?? b?.displayOrder ?? b?.order;
    if (typeof orderA === 'number' && typeof orderB === 'number') {
      return orderA - orderB;
    }

    // 2. Extract leading/module number from title (e.g. "Module 1", "02 - Advanced", "1. Basics")
    const matchA = (a?.title || '').match(/(?:module\s*|unit\s*|chapter\s*|^[^\d]*?)(\d+)/i);
    const matchB = (b?.title || '').match(/(?:module\s*|unit\s*|chapter\s*|^[^\d]*?)(\d+)/i);
    if (matchA && matchB) {
      const numA = parseInt(matchA[1], 10);
      const numB = parseInt(matchB[1], 10);
      if (numA !== numB) return numA - numB;
    }

    // 3. Fallback to createdAt ASC
    if (a?.createdAt && b?.createdAt) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return 0;
  });
}

/**
 * Sorts curriculum lessons to strictly maintain sequence order
 * (e.g. Lesson 1 -> Lesson 2 -> Lesson 3).
 */
export function sortCurriculumLessons<T extends any = any>(
  lessons: T[]
): T[] {
  return [...lessons].sort((a: any, b: any) => {
    const orderA = a?.displayOrder ?? a?.orderIndex ?? a?.order;
    const orderB = b?.displayOrder ?? b?.orderIndex ?? b?.order;
    if (typeof orderA === 'number' && typeof orderB === 'number') {
      return orderA - orderB;
    }

    const matchA = (a?.title || '').match(/(?:lesson\s*|^[^\d]*?)(\d+)/i);
    const matchB = (b?.title || '').match(/(?:lesson\s*|^[^\d]*?)(\d+)/i);
    if (matchA && matchB) {
      const numA = parseInt(matchA[1], 10);
      const numB = parseInt(matchB[1], 10);
      if (numA !== numB) return numA - numB;
    }

    if (a?.createdAt && b?.createdAt) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return 0;
  });
}

/**
 * Evaluates if a module is unlocked in sequential progression.
 * Module 1 (index 0) is ALWAYS unlocked.
 * Module N is unlocked ONLY if ALL preceding modules (0 ... N-1) are completed.
 */
export function isModuleUnlocked(
  moduleIndex: number,
  modules: any[],
  completedModuleIds: string[] = [],
  moduleProgressMap: Record<string, number> = {},
  sequentialModuleLock: boolean = true
): ModuleLockResult {
  if (!sequentialModuleLock || moduleIndex === 0) {
    return { isUnlocked: true };
  }

  const completedSet = new Set(completedModuleIds.map(String));

  // If the module itself is already completed, it is ALWAYS unlocked
  const currentMod = modules[moduleIndex];
  const currentModId = String(currentMod?.id || '');
  if (currentModId && (completedSet.has(currentModId) || (moduleProgressMap[currentModId] ?? 0) >= 100)) {
    return { isUnlocked: true };
  }

  // Check ALL prior modules in order from 0 to moduleIndex - 1
  for (let i = 0; i < moduleIndex; i++) {
    const priorMod = modules[i];
    if (!priorMod) continue;

    const priorId = String(priorMod.id || '');
    const priorTitle = priorMod.title || `Module ${i + 1}`;

    const isCompletedById = completedSet.has(priorId);
    const progressVal = moduleProgressMap[priorId] ?? 0;
    const isCompletedByProgress = progressVal >= 100;

    // Empty modules without lessons or assignments should not block progression
    const hasContent = (priorMod.lessons && priorMod.lessons.length > 0) || (priorMod.assignments && priorMod.assignments.length > 0);

    if (hasContent && !isCompletedById && !isCompletedByProgress) {
      return {
        isUnlocked: false,
        lockReason: `Complete "${priorTitle}" to unlock this module.`,
        previousModuleTitle: priorTitle,
      };
    }
  }

  return { isUnlocked: true };
}

/**
 * Evaluates if a lesson is unlocked for a trainee.
 * If sequential locking is enabled (default true), lesson N is locked until
 * ALL preceding lessons (0 ... N-1) in the module are completed.
 */
export function isLessonUnlocked(
  lesson: LessonContext,
  index: number,
  module: ModuleContext,
  traineeProgress: TraineeProgress
): boolean {
  const isLockEnabled = module.sequentialLessonLock ?? module.lessonLocking ?? true;
  if (!isLockEnabled) return true;
  if (index === 0) return true;
  
  if (!module.lessons || module.lessons.length === 0) return true;
  
  const completedIds = new Set((traineeProgress.completedLessonIds || []).map(String));

  // Strict check: ALL previous lessons must be watched/completed
  for (let i = 0; i < index; i++) {
    const priorLesson = module.lessons[i];
    if (priorLesson && !completedIds.has(String(priorLesson.id))) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates if a lesson is unlocked with a descriptive reason.
 */
export function getLessonLockInfo(
  lesson: LessonContext,
  index: number,
  module: ModuleContext,
  traineeProgress: TraineeProgress
): ItemLockResult {
  const isUnlocked = isLessonUnlocked(lesson, index, module, traineeProgress);
  if (isUnlocked) return { isUnlocked: true };

  const completedIds = new Set((traineeProgress.completedLessonIds || []).map(String));
  const priorLessons = module.lessons || [];

  // Find the first preceding lesson that hasn't been completed yet
  const firstIncomplete = priorLessons.slice(0, index).find(l => !completedIds.has(String(l.id)));
  const priorTitle = firstIncomplete?.title || priorLessons[index - 1]?.title || `Lesson ${index}`;

  return {
    isUnlocked: false,
    lockReason: `Watch and complete "${priorTitle}" to unlock this lesson.`,
    prerequisites: [priorTitle],
  };
}

/**
 * Evaluates if an assignment is unlocked for a trainee.
 * If lockUntilLessonsComplete is true:
 * - If explicit dependsOnLessonIds is provided, all those lessons must be completed.
 * - If dependsOnLessonIds is null/empty, all module lessons must be completed.
 */
export function isAssignmentUnlocked(
  assignment: AssignmentContext,
  traineeProgress: TraineeProgress,
  moduleLessons: LessonContext[] = []
): boolean {
  const isEnabled = assignment.lockConfig?.enabled ?? assignment.lockUntilLessonsComplete ?? (assignment as any).taskLocking ?? true;
  if (!isEnabled) return true;
  
  let depIds = assignment.dependsOnLessonIds;
  if (!depIds || !Array.isArray(depIds) || depIds.length === 0) {
    if (moduleLessons.length > 0) {
      depIds = moduleLessons.map(l => String(l.id));
    } else {
      return true;
    }
  }

  const completedIds = new Set((traineeProgress.completedLessonIds || []).map(String));
  return depIds.every(id => completedIds.has(String(id)));
}

/**
 * Evaluates if an assignment is unlocked with detailed prerequisite information.
 */
export function getAssignmentLockInfo(
  assignment: AssignmentContext,
  traineeProgress: TraineeProgress,
  allLessons: LessonContext[] = []
): ItemLockResult {
  const isUnlocked = isAssignmentUnlocked(assignment, traineeProgress, allLessons);
  if (isUnlocked) return { isUnlocked: true };

  let depIds = assignment.dependsOnLessonIds;
  if (!depIds || !Array.isArray(depIds) || depIds.length === 0) {
    depIds = allLessons.map(l => String(l.id));
  }

  const completedIds = new Set((traineeProgress.completedLessonIds || []).map(String));
  const missingLessonTitles = depIds
    .filter(id => !completedIds.has(String(id)))
    .map(id => {
      const match = allLessons.find(l => String(l.id) === String(id));
      return match?.title || `Lesson ${id.slice(0, 6)}`;
    });

  const reason = missingLessonTitles.length > 0
    ? `Complete prerequisite lesson${missingLessonTitles.length > 1 ? 's' : ''}: ${missingLessonTitles.join(', ')}`
    : 'Complete prerequisite lessons before starting this assignment.';

  return {
    isUnlocked: false,
    lockReason: reason,
    prerequisites: missingLessonTitles,
  };
}
