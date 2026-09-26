import os

file_path = 'e:/LMS_System/LMS_System/backend/src/databaseOrm/modules/lpAuthoring/lpAuthoring.service.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """          if (assignmentPayload.questions && assignmentPayload.questions.length > 0) {
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

new_block = """          if (assignmentPayload.questions && assignmentPayload.questions.length > 0) {
            for (const q of assignmentPayload.questions) {
              // Clear existing dependencies to prevent unique constraint violations on update
              if (q.id) {
                await manager.delete(QuestionLessonDependencyEntity, { questionId: q.id });
              }

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

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Could not find the block to replace")
