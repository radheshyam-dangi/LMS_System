/**
 * useCurriculumDependencies.ts
 *
 * Enterprise-grade dependency resolution and deduplication engine for the
 * Trainee Learning Path module viewer.
 *
 * CORE LOGIC:
 * 1. Single-Instance Placement for Multi-Lesson Dependencies:
 *    If an Assignment depends on multiple Lessons (e.g. Lesson 1 and Lesson 2),
 *    it is NEVER duplicated across sections. It is dynamically resolved and placed
 *    STRICTLY ONCE immediately beneath the FINAL prerequisite Lesson in the sequence.
 * 2. Prerequisite & Completion Validation:
 *    Evaluates lesson completion in real time. Items remain locked with precise,
 *    subtle requirement badges (e.g. "Unlocks after completing Lesson 2") until all
 *    prior prerequisites are satisfied.
 */

import { useMemo } from 'react';

export interface CurriculumLesson {
  id: string;
  title: string;
  description?: string;
  orderIndex?: number;
  videoUrl?: string;
  videos?: { url: string; title?: string }[];
  articleUrl?: string;
  audios?: { url: string; title?: string }[];
  resources?: any[];
  keyPoints?: string[];
  isLocked?: boolean;
  lockReason?: string;
}

export interface CurriculumAssignment {
  id: string;
  title: string;
  description?: string;
  assignmentType?: string;
  lessonId?: string | null;
  lessonTitle?: string;
  dependsOnLessonIds?: string[] | null;
  lockUntilLessonsComplete?: boolean;
  maxScore?: number;
  durationMinutes?: number;
  questions?: any;
  mcqConfig?: any;
  options?: any;
  aiEvaluation?: boolean;
  aiFeedbackRules?: any;
  deadline?: string | Date;
  status?: string;
  isLocked?: boolean;
  lockReason?: string;
}

export interface CurriculumAssignmentNode {
  task: CurriculumAssignment;
  submission: any | null;
  isLocked: boolean;
  lockReason: string;
  displayStatus: string;
  prerequisiteLessonIds: string[];
  prerequisiteLessonTitles: string[];
  isFinalPrerequisiteForLessonId: string | null;
}

export interface CurriculumLessonNode {
  lesson: CurriculumLesson;
  index: number;
  isCompleted: boolean;
  isLocked: boolean;
  lockReason: string;
  dependentAssignments: CurriculumAssignmentNode[];
}

export interface CurriculumDependencyState {
  resolvedLessons: CurriculumLessonNode[];
  standaloneTasks: CurriculumAssignmentNode[];
  allTasks: CurriculumAssignmentNode[];
  totalItemsCount: number;
  completedItemsCount: number;
  progressPercent: number;
  nextPlayableLessonIndex: number | null;
  isModuleFullyCompleted: boolean;
}

export interface UseCurriculumDependenciesProps {
  lessons: CurriculumLesson[];
  tasks: CurriculumAssignment[];
  completedLessonIds: Set<string>;
  submissions: any[];
  sequentialLessonLock?: boolean;
  isTrainee?: boolean;
}

/**
 * Pure dependency resolution function.
 * Can be called standalone or inside the React useCurriculumDependencies hook.
 */
export function resolveCurriculumDependencies({
  lessons = [],
  tasks = [],
  completedLessonIds = new Set<string>(),
  submissions = [],
  sequentialLessonLock = true,
  isTrainee = true,
}: UseCurriculumDependenciesProps): CurriculumDependencyState {
  // 1. Build lookup map for submissions
  const subByAssignment = new Map<string, any>();
  submissions.forEach((s) => {
    const id = String(s.assignment?.id || s.assignmentId || s.id);
    subByAssignment.set(id, s);
  });

  // 2. Build index map of lessons: lessonId -> sequence index (0-based)
  const lessonIndexMap = new Map<string, number>();
  const lessonTitleMap = new Map<string, string>();
  lessons.forEach((l, idx) => {
    const idStr = String(l.id);
    lessonIndexMap.set(idStr, idx);
    lessonTitleMap.set(idStr, l.title || `Lesson ${idx + 1}`);
  });

  // Helper: Determine display status for an assignment submission
  const getAssignmentDisplayStatus = (task: CurriculumAssignment, sub: any, isLocked: boolean): string => {
    if (isLocked) return 'Locked';
    if (!sub) return 'Available';
    const raw = String(sub.status || '').trim();
    if (!raw || raw.toUpperCase() === 'AVAILABLE') return 'Available';
    if (raw.toUpperCase() === 'LOCKED') return 'Locked';
    if (raw.toUpperCase() === 'SUBMITTED' || raw.toLowerCase() === 'submitted') return 'Submitted';
    if (raw === 'ai_evaluated_pending_review' || raw === 'pending_manual_review') return 'Under Review';
    if (raw.toLowerCase() === 'evaluating') return 'Evaluating';

    const maxScore = task.maxScore || 100;
    const scorePct = typeof sub.score === 'number' ? (sub.score / maxScore) * 100 : null;
    const isBelow35 = scorePct !== null && scorePct < 35;

    if (isBelow35 || (raw.toUpperCase() === 'REJECTED' && scorePct === null)) {
      return 'Need Improvement';
    }
    if (
      raw.toLowerCase() === 'approved' ||
      raw.toLowerCase() === 'evaluated' ||
      raw.toUpperCase() === 'NEEDS_IMPROVEMENT'
    ) {
      return 'Approved';
    }
    return 'Pending';
  };

  // Helper: Determine prerequisite lesson IDs for a given task
  const getPrerequisiteLessonIds = (task: CurriculumAssignment): string[] => {
    const explicit = Array.isArray(task.dependsOnLessonIds)
      ? task.dependsOnLessonIds.map(String).filter(Boolean)
      : [];

    if (explicit.length > 0) {
      return explicit;
    }

    if (task.lessonId) {
      return [String(task.lessonId)];
    }

    // If creator checked lockUntilLessonsComplete without explicit list: depends on ALL module lessons
    if (task.lockUntilLessonsComplete && lessons.length > 0) {
      return lessons.map((l) => String(l.id));
    }

    return [];
  };

  // 3. Map assignments to their FINAL prerequisite lesson (Core Deduplication)
  const assignmentsByFinalLesson = new Map<string, CurriculumAssignmentNode[]>();
  const standaloneTasks: CurriculumAssignmentNode[] = [];
  const allAssignmentNodes: CurriculumAssignmentNode[] = [];

  tasks.forEach((task) => {
    const sub = subByAssignment.get(String(task.id));
    const prereqLessonIds = getPrerequisiteLessonIds(task);

    // Find the MAXIMUM sequence index among all prerequisite lessons that belong to this module
    let maxPrereqIndex = -1;
    let finalPrereqLessonId: string | null = null;

    prereqLessonIds.forEach((pId) => {
      if (lessonIndexMap.has(pId)) {
        const idx = lessonIndexMap.get(pId)!;
        if (idx > maxPrereqIndex) {
          maxPrereqIndex = idx;
          finalPrereqLessonId = pId;
        }
      }
    });

    // Human-readable list of prerequisite lesson titles
    const prereqTitles = prereqLessonIds
      .map((pId) => lessonTitleMap.get(pId))
      .filter(Boolean) as string[];

    // Evaluate lock state: is this task unlocked?
    const uncompletedPrereqs: { id: string; index: number; title: string }[] = [];
    prereqLessonIds.forEach((pId) => {
      if (!completedLessonIds.has(pId)) {
        const idx = lessonIndexMap.get(pId);
        uncompletedPrereqs.push({
          id: pId,
          index: idx !== undefined ? idx + 1 : 1,
          title: lessonTitleMap.get(pId) || 'Prerequisite Lesson',
        });
      }
    });

    uncompletedPrereqs.sort((a, b) => a.index - b.index);

    const isLocked = isTrainee && uncompletedPrereqs.length > 0;
    let lockReason = '';
    if (isLocked) {
      if (uncompletedPrereqs.length === 1) {
        lockReason = `Unlocks after completing Lesson ${uncompletedPrereqs[0].index}: ${uncompletedPrereqs[0].title}`;
      } else if (uncompletedPrereqs.length === 2) {
        lockReason = `Unlocks after completing Lesson ${uncompletedPrereqs[0].index} and Lesson ${uncompletedPrereqs[1].index}`;
      } else {
        lockReason = `Unlocks after completing ${uncompletedPrereqs.length} prerequisite lessons`;
      }
    }

    const displayStatus = getAssignmentDisplayStatus(task, sub, isLocked);

    const node: CurriculumAssignmentNode = {
      task,
      submission: sub,
      isLocked,
      lockReason,
      displayStatus,
      prerequisiteLessonIds: prereqLessonIds,
      prerequisiteLessonTitles: prereqTitles,
      isFinalPrerequisiteForLessonId: finalPrereqLessonId,
    };

    allAssignmentNodes.push(node);

    // SINGLE-INSTANCE PLACEMENT:
    // If a final prerequisite lesson was identified, attach strictly to that lesson!
    if (finalPrereqLessonId) {
      const existing = assignmentsByFinalLesson.get(finalPrereqLessonId) || [];
      existing.push(node);
      assignmentsByFinalLesson.set(finalPrereqLessonId, existing);
    } else {
      standaloneTasks.push(node);
    }
  });

  // 4. Resolve Lesson Nodes with sequential locking
  const resolvedLessons: CurriculumLessonNode[] = lessons.map((lesson, idx) => {
    const lessonIdStr = String(lesson.id);
    const isCompleted = completedLessonIds.has(lessonIdStr);

    let isLocked = false;
    let lockReason = '';

    if (isTrainee && sequentialLessonLock && idx > 0) {
      const uncompletedPrior: number[] = [];
      for (let priorIdx = 0; priorIdx < idx; priorIdx++) {
        const priorId = String(lessons[priorIdx].id);
        if (!completedLessonIds.has(priorId)) {
          uncompletedPrior.push(priorIdx + 1);
        }
      }

      if (uncompletedPrior.length > 0) {
        isLocked = true;
        const prevLessonTitle = lessons[idx - 1]?.title || `Lesson ${idx}`;
        lockReason = `Unlocks after completing Lesson ${idx}: ${prevLessonTitle}`;
      }
    }

    // Attach deduplicated dependent assignments that have this lesson as their FINAL prerequisite
    const dependentAssignments = assignmentsByFinalLesson.get(lessonIdStr) || [];

    return {
      lesson,
      index: idx,
      isCompleted,
      isLocked,
      lockReason,
      dependentAssignments,
    };
  });

  // 5. Aggregate module progression metrics
  const totalLessons = resolvedLessons.length;
  const completedLessons = resolvedLessons.filter((l) => l.isCompleted).length;

  const isTaskSubmitted = (sub: any) =>
    sub && sub.status && sub.status !== 'AVAILABLE' && sub.status !== 'LOCKED';

  const submittedTasksCount = allAssignmentNodes.filter((n) => isTaskSubmitted(n.submission)).length;
  const totalTasksCount = allAssignmentNodes.length;

  const totalItemsCount = totalLessons + totalTasksCount;
  const completedItemsCount = completedLessons + submittedTasksCount;

  const progressPercent = totalItemsCount > 0
    ? Math.min(100, Math.max(0, Math.round((completedItemsCount / totalItemsCount) * 100)))
    : 0;

  const nextPlayableIndex = resolvedLessons.findIndex((l) => !l.isCompleted && !l.isLocked);
  const nextPlayableLessonIndex = nextPlayableIndex !== -1 ? nextPlayableIndex : null;

  const isModuleFullyCompleted =
    totalItemsCount > 0 &&
    completedLessons === totalLessons &&
    submittedTasksCount === totalTasksCount;

  return {
    resolvedLessons,
    standaloneTasks,
    allTasks: allAssignmentNodes,
    totalItemsCount,
    completedItemsCount,
    progressPercent,
    nextPlayableLessonIndex,
    isModuleFullyCompleted,
  };
}

export function useCurriculumDependencies(props: UseCurriculumDependenciesProps): CurriculumDependencyState {
  return useMemo(
    () => resolveCurriculumDependencies(props),
    [
      props.lessons,
      props.tasks,
      props.completedLessonIds,
      props.submissions,
      props.sequentialLessonLock,
      props.isTrainee,
    ]
  );
}

