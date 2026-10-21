export type CurriculumNodeType = 'module' | 'lesson' | 'assignment';

export interface LockRule {
  type: 'prerequisite_lock' | 'unlocked';
  prerequisiteMode?: 'sequential' | 'all_preceding' | 'custom';
  minProgressPercent?: number; // e.g. 100 for 100% completion requirement
}

export interface CurriculumNodeItem {
  id: string;
  type: CurriculumNodeType;
  title: string;
  description?: string;
  index: number;
  pos: number;
  nodeSize: number;
  sequentialModuleLock?: boolean;
  sequentialLessonLock?: boolean;
  lockUntilLessonsComplete?: boolean;
  dependsOnLessonIds?: string[] | null;
  lockRule: LockRule;
  stats?: {
    videos?: number;
    resources?: number;
    questions?: number;
  };
  children?: CurriculumNodeItem[];
}

export interface CurriculumTreeData {
  modules: CurriculumNodeItem[];
  totalModules: number;
  totalLessons: number;
  totalAssignments: number;
}
