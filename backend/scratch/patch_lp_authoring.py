import os

file_path = 'e:/LMS_System/LMS_System/backend/src/databaseOrm/modules/lpAuthoring/lpAuthoring.service.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'import { QuestionLessonDependencyEntity }' not in content:
    content = content.replace(
        "import { AssignmentEntity } from '../../entities/assignment.entity';",
        "import { AssignmentEntity } from '../../entities/assignment.entity';\nimport { QuestionLessonDependencyEntity } from '../../entities/questionLessonDependency.entity';"
    )

old_save_assignment = """          const assignmentData = manager.create(AssignmentEntity, {
            ...(assignmentPayload.id && /^[0-9a-f]{8}-/i.test(assignmentPayload.id) ? { id: assignmentPayload.id } : {}),
            title: assignmentPayload.title || 'Assignment',
            description: assignmentPayload.body || null,
            instructions: assignmentPayload.body || null,
            assignmentType: this.inferAssignmentType(assignmentPayload),
            maxScore,
            module: savedModule,
            learningPath: savedLP,
            createdBy: creator,
            assignedToTraineeIds: [],
            questions: assignmentPayload.questions || null,
            dependsOnLessonIds: depLessonIds,
            lockUntilLessonsComplete: assignmentPayload.lockConfig?.enabled !== false,
            autoEvaluateWithAI: assignmentPayload.evaluation?.autoEvaluateWithAI === true,
            humanInterventionRequired: assignmentPayload.evaluation?.humanInterventionRequired !== false,
            timerDuration: 
              ((assignmentPayload.timerDuration?.days || 0) * 24 * 60) +
              ((assignmentPayload.timerDuration?.hours || 0) * 60) +
              (assignmentPayload.timerDuration?.minutes || 0),
            anchorType: assignmentPayload.countdownStart === 'taskUnlocked' ? 'TASK_UNLOCKED' : 'LP_ASSIGNED',
            isExternal: false,
          });
          await manager.save(AssignmentEntity, assignmentData);"""

new_save_assignment = """          const assignmentData = manager.create(AssignmentEntity, {
            ...(assignmentPayload.id && /^[0-9a-f]{8}-/i.test(assignmentPayload.id) ? { id: assignmentPayload.id } : {}),
            title: assignmentPayload.title || 'Assignment',
            description: assignmentPayload.body || null,
            instructions: assignmentPayload.body || null,
            assignmentType: this.inferAssignmentType(assignmentPayload),
            maxScore,
            module: savedModule,
            learningPath: savedLP,
            createdBy: creator,
            assignedToTraineeIds: [],
            questions: assignmentPayload.questions || null,
            dependsOnLessonIds: depLessonIds,
            lockUntilLessonsComplete: assignmentPayload.lockConfig?.enabled !== false,
            autoEvaluateWithAI: assignmentPayload.evaluation?.autoEvaluateWithAI === true,
            humanInterventionRequired: assignmentPayload.evaluation?.humanInterventionRequired !== false,
            timerDuration: 
              ((assignmentPayload.timerDuration?.days || 0) * 24 * 60) +
              ((assignmentPayload.timerDuration?.hours || 0) * 60) +
              (assignmentPayload.timerDuration?.minutes || 0),
            anchorType: assignmentPayload.countdownStart === 'taskUnlocked' ? 'TASK_UNLOCKED' : 'LP_ASSIGNED',
            isExternal: false,
          });
          await manager.save(AssignmentEntity, assignmentData);
          
          if (assignmentPayload.questions && assignmentPayload.questions.length > 0) {
            for (const q of assignmentPayload.questions) {
              if (q.requiresLessonGrounding !== false && q.lessonDependencies && q.lessonDependencies.length > 0) {
                // Save dependencies
                const validDeps = q.lessonDependencies.filter((id: string) => depLessonIds.includes(id));
                const depsToSave = validDeps.map((lessonId: string) => 
                  manager.create(QuestionLessonDependencyEntity, {
                    questionId: q.id,
                    lesson: { id: lessonId } as any,
                    source: 'creator'
                  })
                );
                if (depsToSave.length > 0) {
                  await manager.save(QuestionLessonDependencyEntity, depsToSave);
                }
              }
            }
          }"""

content = content.replace(old_save_assignment, new_save_assignment)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
