export function isLessonUnlocked(lesson: any, index: number, module: any, traineeProgress: { completedLessonIds: string[] }) {
  if (!module.sequentialLessonLock) return true;
  if (index === 0) return true;
  const previousLesson = module.lessons[index - 1];
  if (!previousLesson) return true;
  return traineeProgress.completedLessonIds.includes(previousLesson.id);
}
