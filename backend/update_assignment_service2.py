import os

file_path = 'e:/LMS_System/LMS_System/backend/src/databaseOrm/modules/assignment/assignment.service.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Import the entity
import_statement = "import { QuestionLessonDependencyEntity } from '../../entities/questionLessonDependency.entity';\n"
content = content.replace("import { AssignmentSubmissionEntity }", import_statement + "import { AssignmentSubmissionEntity }")

# Add to class properties
prop = "  private questionLessonDependencyRepository: Repository<QuestionLessonDependencyEntity>;\n"
content = content.replace("private submissionRepository: Repository<AssignmentSubmissionEntity>;", prop + "  private submissionRepository: Repository<AssignmentSubmissionEntity>;")

# Add to constructor
init = "    this.questionLessonDependencyRepository = this.datasource.getRepository<QuestionLessonDependencyEntity>(QuestionLessonDependencyEntity);\n"
content = content.replace("this.submissionRepository =", init + "    this.submissionRepository =")

# Add `questions` mapping in createTask
create_task_before = """      externalUrl: externalUrl || undefined,
      mcqConfig: mcqConfig || undefined,"""
create_task_after = """      externalUrl: externalUrl || undefined,
      mcqConfig: mcqConfig || undefined,
      questions: mcqConfig?.questions || undefined,"""
content = content.replace(create_task_before, create_task_after)

# Save dependencies after saving the assignment
save_deps = """
    if (assignmentType === 'Subjective' && mcqConfig?.questions?.length) {
      const dependenciesToSave = [];
      for (const q of mcqConfig.questions) {
        if (q.dependentLessonIds && Array.isArray(q.dependentLessonIds)) {
          for (const lessonId of q.dependentLessonIds) {
            dependenciesToSave.push(this.questionLessonDependencyRepository.create({
              questionId: q.id,
              lesson: { id: lessonId } as any
            }));
          }
        }
      }
      if (dependenciesToSave.length > 0) {
        await this.questionLessonDependencyRepository.save(dependenciesToSave);
      }
    }
"""

content = content.replace("const saved = await this.repository.save(assignment);", "const saved = await this.repository.save(assignment);\n" + save_deps)

# Add `questions` mapping in updateTask
update_task_before = """      dto.maxScore = dto.mcqConfig.questions.reduce(
        (sum: number, q: any) => sum + (Number(q.maxPoints) || 10),
        0,
      );
    }"""
update_task_after = update_task_before + """
    if (dto.mcqConfig && dto.mcqConfig.questions) {
      assignment.questions = dto.mcqConfig.questions;
    }
"""
content = content.replace(update_task_before, update_task_after)

# Update dependencies in updateTask
update_deps = """
    const updated = await this.repository.save(assignment);

    if (dto.assignmentType === 'Subjective' && dto.mcqConfig?.questions?.length) {
      for (const q of dto.mcqConfig.questions) {
        await this.questionLessonDependencyRepository.delete({ questionId: q.id });
        if (q.dependentLessonIds && Array.isArray(q.dependentLessonIds)) {
          const deps = q.dependentLessonIds.map((lid: string) => this.questionLessonDependencyRepository.create({
            questionId: q.id,
            lesson: { id: lid } as any
          }));
          if (deps.length > 0) {
            await this.questionLessonDependencyRepository.save(deps);
          }
        }
      }
    }

    return updated;
"""
content = content.replace("return this.repository.save(assignment);", update_deps)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated assignment.service.ts")
