const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../src/databaseOrm/modules/assignment/assignment.service.ts');
let code = fs.readFileSync(p, 'utf8');

// 1. Add QuestionLessonDependencyEntity import if not there
if (!code.includes('QuestionLessonDependencyEntity')) {
  code = code.replace(
    "import { AssignmentEntity } from '../../entities/assignment.entity';",
    "import { AssignmentEntity } from '../../entities/assignment.entity';\nimport { QuestionLessonDependencyEntity } from '../../entities/questionLessonDependency.entity';"
  );
}

// 2. Add repository property
if (!code.includes('questionLessonDepRepository')) {
  code = code.replace(
    "private submissionRepository: Repository<AssignmentSubmissionEntity>;",
    "private submissionRepository: Repository<AssignmentSubmissionEntity>;\n  private questionLessonDepRepository: Repository<QuestionLessonDependencyEntity>;"
  );
  code = code.replace(
    "this.submissionRepository = this.datasource.getRepository<AssignmentSubmissionEntity>(AssignmentSubmissionEntity);",
    "this.submissionRepository = this.datasource.getRepository<AssignmentSubmissionEntity>(AssignmentSubmissionEntity);\n    this.questionLessonDepRepository = this.datasource.getRepository<QuestionLessonDependencyEntity>(QuestionLessonDependencyEntity);"
  );
}

// 3. Add the new v4 methods at the end of the class
const newMethods = `
  async getQuestionLessonOptions(assignmentId: string, questionId: string) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    const poolIds = assignment.dependsOnLessonIds || [];
    
    let assignmentLessonPool = [];
    if (poolIds.length > 0) {
      const lessons = await this.datasource.query(\`SELECT id, title FROM "Lesson" WHERE id = ANY($1)\`, [poolIds]);
      assignmentLessonPool = lessons.map((l: any) => ({ lessonId: l.id, title: l.title }));
    }
    
    const currentDeps = await this.questionLessonDepRepository.find({ where: { questionId }, relations: ['lesson'] });
    return {
      assignmentLessonPool,
      currentDependencies: currentDeps.map((d: any) => d.lesson?.id),
    };
  }

  async setQuestionLessonDependencies(assignmentId: string, questionId: string, lessonIds: string[], requiresLessonGrounding: boolean) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    
    // Subset constraint validation
    const pool = new Set(assignment.dependsOnLessonIds || []);
    const invalid = lessonIds.filter(id => !pool.has(id));
    if (invalid.length > 0) {
      throw new Error(\`INVALID_LESSON_DEPENDENCY: Question can only depend on lessons already in its assignment's pool. Invalid: \${invalid.join(', ')}\`);
    }

    // Update questions JSON
    if (assignment.questions) {
      const qIdx = assignment.questions.findIndex((q: any) => q.id === questionId);
      if (qIdx >= 0) {
        assignment.questions[qIdx].requiresLessonGrounding = requiresLessonGrounding;
        await this.repository.save(assignment);
      }
    }

    await this.questionLessonDepRepository.delete({ questionId });
    const depsToSave = lessonIds.map(id => this.questionLessonDepRepository.create({
      questionId,
      lesson: { id } as any,
      source: 'creator'
    }));
    if (depsToSave.length > 0) {
      await this.questionLessonDepRepository.save(depsToSave);
    }
    
    return { questionId, lessonIds, source: 'creator', requiresLessonGrounding };
  }

  async getQuestionsWithDependencies(assignmentId: string) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    
    const questions = assignment.questions || [];
    const deps = await this.questionLessonDepRepository.find({
      where: { questionId: In(questions.map((q: any) => q.id)) },
      relations: ['lesson']
    });
    
    const depMap = deps.reduce((acc, d) => {
      if (!acc[d.questionId]) acc[d.questionId] = [];
      acc[d.questionId].push({ lessonId: (d.lesson as any)?.id, source: d.source });
      return acc;
    }, {} as Record<string, any[]>);

    return {
      questions: questions.map((q: any) => ({
        questionId: q.id,
        text: q.text,
        lessonDependencies: depMap[q.id] || [],
        requiresLessonGrounding: q.requiresLessonGrounding !== false
      }))
    };
  }

  async validateAssignmentBeforePublish(assignmentId: string) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    
    const pool = new Set(assignment.dependsOnLessonIds || []);
    const questions = assignment.questions || [];
    const deps = await this.questionLessonDepRepository.find({
      where: { questionId: In(questions.map((q: any) => q.id)) },
      relations: ['lesson']
    });
    
    const depMap = deps.reduce((acc, d) => {
      if (!acc[d.questionId]) acc[d.questionId] = [];
      acc[d.questionId].push((d.lesson as any)?.id);
      return acc;
    }, {} as Record<string, string[]>);
    
    const errors = [];
    for (const question of questions) {
      const qDeps = depMap[question.id] || [];
      const hasDependency = qDeps.length > 0;
      const orphaned = qDeps.filter(id => !pool.has(id));
      
      const requiresGrounding = question.requiresLessonGrounding !== false;
      
      if (!hasDependency && requiresGrounding) {
        errors.push({
          questionId: question.id,
          type: 'MISSING_DEPENDENCY',
          message: \`Question "\${(question.text || '').slice(0, 40)}..." has no lesson dependency set. Select at least one lesson from this assignment's pool, or mark it as not requiring lesson grounding.\`
        });
      }
      if (orphaned.length > 0) {
        errors.push({
          questionId: question.id,
          type: 'ORPHANED_DEPENDENCY',
          message: \`Question depends on lesson(s) no longer in this assignment's pool: \${orphaned.join(', ')}. Update its dependency.\`,
          invalidLessonIds: orphaned
        });
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  async getMigrationReviewQueue(assignmentId: string) {
    const assignment = await this.repository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    
    const questions = assignment.questions || [];
    const deps = await this.questionLessonDepRepository.find({
      where: { questionId: In(questions.map((q: any) => q.id)), source: 'backfill' },
      relations: ['lesson']
    });
    
    const questionsNeedingReview = new Set(deps.map(d => d.questionId));
    
    const depMap = deps.reduce((acc, d) => {
      if (!acc[d.questionId]) acc[d.questionId] = [];
      acc[d.questionId].push((d.lesson as any)?.id);
      return acc;
    }, {} as Record<string, string[]>);
    
    const pendingReview = [];
    for (const qId of questionsNeedingReview) {
      const q = questions.find((q: any) => q.id === qId);
      if (q) {
        pendingReview.push({
          questionId: q.id,
          text: q.text,
          backfilledLessonIds: depMap[q.id] || []
        });
      }
    }
    
    return {
      pendingReview,
      totalPending: pendingReview.length,
      totalQuestions: questions.length
    };
  }
`;

code = code.replace(
  "async evaluateLockState(assignment: AssignmentEntity, userId: string): Promise<{ isLocked: boolean; lockReason: string | null }> {\n    return { isLocked: false, lockReason: null };\n  }\n}",
  "async evaluateLockState(assignment: AssignmentEntity, userId: string): Promise<{ isLocked: boolean; lockReason: string | null }> {\n    return { isLocked: false, lockReason: null };\n  }\n\n" + newMethods + "\n}"
);

if (!code.includes('import { In } from')) {
    code = code.replace("import { DataSource, Repository, IsNull, Not } from 'typeorm';", "import { DataSource, Repository, IsNull, Not, In } from 'typeorm';");
}

fs.writeFileSync(p, code);
