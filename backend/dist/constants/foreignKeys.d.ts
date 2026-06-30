export declare const ForeignKeys: {
    readonly Assignment: {
        readonly LessonId: "lesson_id";
        readonly CreatedBy: "created_by";
    };
    readonly DocumentAssociation: {
        readonly DocumentId: "documentId";
        readonly AssociationId: "associationId";
    };
    readonly Enrollment: {
        readonly UserId: "userId";
        readonly LearningPathId: "learningPathId";
    };
    readonly Evaluation: {
        readonly SubmissionId: "submissionId";
        readonly EvaluatorId: "evaluatorId";
    };
    readonly LearningPath: {
        readonly CreatedBy: "createdBy";
    };
    readonly LearningPathModule: {
        readonly LearningPathId: "learningPathId";
        readonly ModuleId: "moduleId";
    };
    readonly Lesson: {
        readonly ModuleId: "moduleId";
    };
    readonly Module: {
        readonly ParentId: "parentId";
        readonly CreatedBy: "createdBy";
    };
    readonly ModuleKeyPoint: {
        readonly ModuleId: "moduleId";
    };
    readonly ModulePrerequisite: {
        readonly ModuleId: "moduleId";
        readonly PrerequisiteModuleId: "prerequisiteModuleId";
    };
    readonly ModuleTag: {
        readonly ModuleId: "moduleId";
        readonly TagId: "tagId";
    };
    readonly Submission: {
        readonly AssignmentId: "assignmentId";
        readonly UserId: "userId";
    };
    readonly UserLessonProgress: {
        readonly UserId: "userId";
        readonly LessonId: "lessonId";
    };
    readonly UserRoles: {
        readonly UserId: "userId";
        readonly RoleId: "roleId";
    };
};
