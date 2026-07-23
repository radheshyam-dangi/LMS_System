import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
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
   * 🌟 CREATE ASSIGNMENT
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
   * 🌟 TRAINER / ADMIN: Evaluate Trainee Submission & UPDATE TRAINEE PROGRESS
   */
  async evaluateSubmission(
    submissionId: string,
    evaluatorId: string,
    score: number,
    feedback: string,
    status: 'Accepted' | 'Rejected' | 'Evaluated' = 'Accepted',
  ): Promise<AssignmentSubmissionEntity> {
    if (!UUID_REGEX.test(submissionId)) {
      throw new BadRequestException(`"${submissionId}" is not a valid UUID format.`);
    }

    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId } as any,
      relations: [
        'trainee',
        'assignment',
        'assignment.lesson',
        'assignment.lesson.module',
        'assignment.lesson.module.learningPath',
        'assignment.module',
        'assignment.module.learningPath',
        'assignment.learningPath',
      ],
    });

    if (!submission) {
      throw new NotFoundException(`Assignment submission "${submissionId}" non-existent.`);
    }

    submission.score = score;
    submission.feedback = feedback;
    submission.status = status;
    submission.evaluatedAt = new Date();
    submission.evaluatedBy = { id: evaluatorId } as any;

    const updatedSubmission = await this.submissionRepository.save(submission);

    // 📊 Recalculate Trainee Learning Path Progress on Acceptance
    if (status === 'Accepted' || status === 'Evaluated') {
      const learningPathId =
        submission.assignment?.lesson?.module?.learningPath?.id ||
        submission.assignment?.module?.learningPath?.id ||
        submission.assignment?.learningPath?.id;

      if (learningPathId && submission.trainee?.id) {
        await this.updateTraineePathProgress(submission.trainee.id, learningPathId);
      }
    }

    return updatedSubmission;
  }

  /**
   * 🌟 TRAINER DASHBOARD: Fetch all pending submissions assigned to a trainer's paths
   */
  async findPendingSubmissionsForTrainer(trainerId: string): Promise<AssignmentSubmissionEntity[]> {
    return await this.submissionRepository.find({
      where: [
        { status: 'Submitted', assignment: { createdBy: { id: trainerId } } },
        { status: 'Submitted', assignment: { lesson: { module: { learningPath: { createdBy: { id: trainerId } } } } } },
      ] as any,
      relations: ['trainee', 'assignment'],
      order: { createdAt: 'DESC' } as any,
    });
  }

  /**
   * Helper: Calculates and updates overall progress percentage for a Trainee
   */
  private async updateTraineePathProgress(traineeId: string, learningPathId: string): Promise<void> {
    try {
      // 1. Get total assignments under this Learning Path
      const totalAssignments = await this.repository.count({
        where: [
          { lesson: { module: { learningPath: { id: learningPathId } } } },
          { module: { learningPath: { id: learningPathId } } },
          { learningPath: { id: learningPathId } },
        ] as any,
      });

      if (totalAssignments === 0) return;

      // 2. Count accepted/evaluated submissions by trainee for this path
      const completedSubmissions = await this.submissionRepository.count({
        where: [
          {
            trainee: { id: traineeId },
            status: 'Accepted',
            assignment: { lesson: { module: { learningPath: { id: learningPathId } } } },
          },
          {
            trainee: { id: traineeId },
            status: 'Accepted',
            assignment: { module: { learningPath: { id: learningPathId } } },
          },
          {
            trainee: { id: traineeId },
            status: 'Accepted',
            assignment: { learningPath: { id: learningPathId } },
          },
          {
            trainee: { id: traineeId },
            status: 'Evaluated',
            assignment: { lesson: { module: { learningPath: { id: learningPathId } } } },
          },
        ] as any,
      });

      const progressPercentage = Math.min(100, Math.round((completedSubmissions / totalAssignments) * 100));

      // 3. Update overallProgress column in LearningPath
      await this.learningPathRepository.update(learningPathId, {
        overallProgress: progressPercentage,
      });
    } catch (err) {
      console.warn('Failed to update trainee learning path progress:', err);
    }
  }

  /**
   * Fetch all assignments attached to a specific Lesson
   */
  async findByLessonId(lessonId: string): Promise<AssignmentEntity[]> {
    if (!UUID_REGEX.test(lessonId)) {
      throw new BadRequestException(`"${lessonId}" is not a valid UUID format.`);
    }

    return await this.repository.find({
      where: { lesson: { id: lessonId } } as any,
    });
  }

  /**
   * Fetch all submissions for a given Assignment
   */
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

  async findAllSubmissionsByTrainee(traineeId: string): Promise<AssignmentSubmissionEntity[]> {
    if (!traineeId) {
      throw new BadRequestException('Trainee user ID is required.');
    }

    try {
      return await this.submissionRepository.find({
        where: {
          trainee: { id: traineeId },
        } as any,
        relations: [
          'assignment',
          'assignment.lesson',
          'assignment.module',
          'assignment.learningPath',
        ],
        order: {
          submittedAt: 'DESC',
          createdAt: 'DESC',
        } as any,
      });
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to fetch trainee submission history: ${error.message}`,
      );
    }
  }

  /**
   * Fetch single trainee's submission for an assignment
   */
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