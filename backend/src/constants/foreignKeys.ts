export const ForeignKeys = {
  Assignment: {
    LessonId: 'lesson_id',
    CreatedBy: 'created_by',
  },
  DocumentAssociation: {
    DocumentId: 'documentId',
    AssociationId: 'associationId',
  },
  Enrollment: {
    UserId: 'userId',
    LearningPathId: 'learningPathId',
  },
  Evaluation: {
    SubmissionId: 'submissionId',
    EvaluatorId: 'evaluatorId',
  },
  LearningPath: {
    CreatedBy: 'createdBy',
  },
  LearningPathModule: {
    LearningPathId: 'learningPathId',
    ModuleId: 'moduleId',
  },
  Lesson: {
    ModuleId: 'moduleId',
  },
  Module: {
    ParentId: 'parentId',
    CreatedBy: 'createdBy',
  },
  ModuleKeyPoint: {
    ModuleId: 'moduleId',
  },
  ModulePrerequisite: {
    ModuleId: 'moduleId',
    PrerequisiteModuleId: 'prerequisiteModuleId',
  },
  ModuleTag: {
    ModuleId: 'moduleId',
    TagId: 'tagId',
  },
  Submission: {
    AssignmentId: 'assignmentId',
    UserId: 'userId',
  },
  UserLessonProgress: {
    UserId: 'userId',
    LessonId: 'lessonId',
  },
  UserRoles: {
    UserId: 'userId',
    RoleId: 'roleId',
  },
} as const;