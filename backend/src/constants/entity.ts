export const Entities = {
  Assignment: 'Assignment',
  Document: 'Document',
  DocumentAssociation: 'DocumentAssociation',
  Enrollment: 'Enrollment',
  Evaluation: 'Evaluation',
  LearningPath: 'LearningPath',
  LearningPathModule: 'LearningPathModule',
  Notification: 'Notification',
  Resource: 'Resource',
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
  UserResourceVisit: 'UserResourceVisit',
} as const;

export const Junctions = {
  LearningPathModules: 'LearningPathModules',
  UserRoles: 'UserRoles',
} as const;
