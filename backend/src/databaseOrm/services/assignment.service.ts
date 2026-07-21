import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { BaseService } from './base.service';
import { AssignmentEntity } from '../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../entities/assignmentSubmission.entity';
import { LessonEntity } from '../entities/lesson.entity';
import { ModuleEntity } from '../entities/module.entity';
import { LearningPathEntity } from '../entities/learningPath.entity';
import { UserLessonProgressEntity } from '../entities/userLessonProgress.entity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AssignmentEntityService extends BaseService<AssignmentEntity> {
  protected repository: Repository<AssignmentEntity>;
  private submissionRepository: Repository<AssignmentSubmissionEntity>;
  private lessonRepository: Repository<LessonEntity>;
  private moduleRepository: Repository<ModuleEntity>;
  private learningPathRepository: Repository<LearningPathEntity>;
  private progressRepository: Repository<UserLessonProgressEntity>;

  constructor(private readonly datasource: DataSource) {
    super();
    this.repository = this.datasource.getRepository<AssignmentEntity>(AssignmentEntity);
    this.submissionRepository = this.datasource.getRepository<AssignmentSubmissionEntity>(AssignmentSubmissionEntity);
    this.lessonRepository = this.datasource.getRepository<LessonEntity>(LessonEntity);
    this.moduleRepository = this.datasource.getRepository<ModuleEntity>(ModuleEntity);
    this.learningPathRepository = this.datasource.getRepository<LearningPathEntity>(LearningPathEntity);
    this.progressRepository = this.datasource.getRepository<UserLessonProgressEntity>(UserLessonProgressEntity);
  }

  /**
   * 🌟 CREATE ASSIGNMENT: Supports Lesson, Module, OR direct LearningPath hierarchy attachment
   */
  async createAssignment(dto: any, creatorId: string): Promise<AssignmentEntity> {
    const { lessonId, moduleId, learningPathId, title, instructions, assignmentType, mcqConfig, maxScore, dueDate } = dto;

    if (!lessonId && !moduleId && !learningPathId) {
      throw new BadRequestException('At least one target parent ID (lessonId, moduleId, or learningPathId) is required.');
    }

    let targetLesson: LessonEntity | undefined;
    let targetModule: ModuleEntity | undefined;
    let targetLearningPath: LearningPathEntity | undefined;

    try {
      if (lessonId) {
        if (!UUID_REGEX.test(lessonId)) {
          throw new BadRequestException(`"${lessonId}" is not a valid UUID format.`);
        }
        targetLesson = (await this.lessonRepository.findOne({ where: { id: lessonId } })) ?? undefined;
        if (!targetLesson) throw new NotFoundException(`Lesson with ID "${lessonId}" non-existent.`);
      } else if (moduleId) {
        if (!UUID_REGEX.test(moduleId)) {
          throw new BadRequestException(`"${moduleId}" is not a valid UUID format.`);
        }
        targetModule = (await this.moduleRepository.findOne({ where: { id: moduleId } })) ?? undefined;
        if (!targetModule) throw new NotFoundException(`Module with ID "${moduleId}" non-existent.`);
      } else if (learningPathId) {
        if (!UUID_REGEX.test(learningPathId)) {
          throw new BadRequestException(`"${learningPathId}" is not a valid UUID format.`);
        }
        targetLearningPath = (await this.learningPathRepository.findOne({ where: { id: learningPathId } })) ?? undefined;
        if (!targetLearningPath) throw new NotFoundException(`Learning Path with ID "${learningPathId}" non-existent.`);
      }

      const newAssignment = this.repository.create({
        title,
        instructions: instructions ?? dto.description ?? null,
        assignmentType: assignmentType ?? 'Subjective',
        mcqConfig: mcqConfig ?? null,
        maxScore: maxScore ?? 100,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        ...(targetLesson ? { lesson: targetLesson } : {}),
        ...(targetModule ? { module: targetModule } : {}),
        ...(targetLearningPath ? { learningPath: targetLearningPath } : {}),
        createdBy: { id: creatorId } as any,
      });

      return await this.repository.save(newAssignment);
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to create assignment: ${error.message}`);
    }
  }

  /**
   * 🌟 TRAINEE: Submit solution for assignment
   */
  async submitAssignment(
    assignmentId: string,
    traineeId: string,
    submissionText: string,
    attachmentUrl?: string,
  ): Promise<AssignmentSubmissionEntity> {
    if (!UUID_REGEX.test(assignmentId)) {
      throw new BadRequestException(`"${assignmentId}" is not a valid UUID format.`);
    }

    try {
      const assignment = await this.repository.findOne({ where: { id: assignmentId } });
      if (!assignment) {
        throw new NotFoundException(`Assignment with ID "${assignmentId}" non-existent.`);
      }

      let submission = await this.submissionRepository.findOne({
        where: {
          assignment: { id: assignmentId },
          trainee: { id: traineeId },
        } as any,
      });

      if (submission) {
        submission.submissionText = submissionText;
        if (attachmentUrl) submission.attachmentUrl = attachmentUrl;
        submission.status = 'Submitted';
        submission.submittedAt = new Date();
      } else {
        submission = this.submissionRepository.create({
          assignment,
          trainee: { id: traineeId } as any,
          submissionText,
          attachmentUrl: attachmentUrl ?? undefined,
          status: 'Submitted',
          submittedAt: new Date(),
        });
      }

      return await this.submissionRepository.save(submission);
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to process assignment submission: ${error.message}`);
    }
  }

  /**
   * 🌟 TRAINER / ADMIN: Evaluate & Grade Trainee Submission
   */
  async evaluateSubmission(
    submissionId: string,
    evaluatorId: string,
    score: number,
    feedback: string,
  ): Promise<AssignmentSubmissionEntity> {
    if (!UUID_REGEX.test(submissionId)) {
      throw new BadRequestException(`"${submissionId}" is not a valid UUID format.`);
    }

    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId } as any,
      relations: ['assignment', 'assignment.lesson', 'assignment.lesson.learningPath', 'trainee'],
    });

    if (!submission) {
      throw new NotFoundException(`Assignment submission "${submissionId}" non-existent.`);
    }

    submission.score = score;
    submission.feedback = feedback;
    submission.status = 'Evaluated';
    submission.evaluatedAt = new Date();
    submission.evaluatedBy = { id: evaluatorId } as any;

    const savedSubmission = await this.submissionRepository.save(submission);

    // Auto-update overall LearningPath progress for Trainee
    const pathId = submission.assignment?.lesson?.learningPath?.id;
    if (pathId && submission.trainee?.id) {
      await this.recalculateTraineeProgress(submission.trainee.id, pathId);
    }

    return savedSubmission;
  }

  /**
   * Helper: Calculates completion percentage for Trainee under a Learning Path
   */
  private async recalculateTraineeProgress(traineeId: string, pathId: string): Promise<void> {
    try {
      const path = await this.learningPathRepository.findOne({
        where: { id: pathId },
        relations: ['modules', 'modules.lessons'],
      });

      if (!path) return;

      const lessonIds: string[] = [];
      path.modules?.forEach((mod) => {
        mod.lessons?.forEach((les) => lessonIds.push(les.id));
      });

      if (lessonIds.length === 0) return;

      const completedCount = await this.progressRepository.count({
        where: {
          user: { id: traineeId },
          lesson: { id: In(lessonIds) },
          isCompleted: true,
        } as any,
      });

      const percentage = Math.round((completedCount / lessonIds.length) * 100);
      await this.learningPathRepository.update(pathId, { overallProgress: percentage });
    } catch (err: any) {
      // Non-blocking progress sync warning
      console.warn('Progress recalculation warning:', err.message);
    }
  }

  async findByLessonId(lessonId: string): Promise<AssignmentEntity[]> {
    if (!UUID_REGEX.test(lessonId)) {
      throw new BadRequestException(`"${lessonId}" is not a valid UUID format.`);
    }

    return await this.repository.find({
      where: { lesson: { id: lessonId } } as any,
    });
  }

  async findSubmissionsByAssignment(assignmentId: string): Promise<AssignmentSubmissionEntity[]> {
    if (!UUID_REGEX.test(assignmentId)) {
      throw new BadRequestException(`"${assignmentId}" is not a valid UUID format.`);
    }

    return await this.submissionRepository.find({
      where: { assignment: { id: assignmentId } } as any,
      relations: ['trainee'],
      order: { createdAt: 'DESC' } as any,
    });
  }

  async findTraineeSubmission(assignmentId: string, traineeId: string): Promise<AssignmentSubmissionEntity | null> {
    if (!UUID_REGEX.test(assignmentId)) {
      throw new BadRequestException(`"${assignmentId}" is not a valid UUID format.`);
    }

    return await this.submissionRepository.findOne({
      where: {
        assignment: { id: assignmentId },
        trainee: { id: traineeId },
      } as any,
    });
  }
}