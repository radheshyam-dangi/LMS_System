export const Entities = {
  Assignment: 'Assignment',
  Document: 'Document',
  DocumentAssociation: 'DocumentAssociation',
  Enrollment: 'Enrollment',
  Evaluation: 'Evaluation',
  LearningPath: 'LearningPath',
  LearningPathModule: 'LearningPathModule',
  Lesson: 'Lesson',
  Module: 'Module',
  ModuleKeyPoint: 'ModuleKeyPoint',
  ModulePrerequisite: 'ModulePrerequisite',
  ModuleTag: 'ModuleTag',
  Role: 'Role',
  Submission: 'Submission',
  Tag: 'Tag',
  User: 'User',
  UserLessonProgress: 'UserLessonProgress',
} as const;

export const Junctions = {
  LearningPathModules: 'LearningPathModules',
  UserRoles: 'UserRoles',
} as const;