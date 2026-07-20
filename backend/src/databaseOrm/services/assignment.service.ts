import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { AssignmentEntity } from '../entities/assignment.entity';
import { AssignmentSubmissionEntity } from '../entities/assignmentSubmission.entity';
import { LessonEntity } from '../entities/lesson.entity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AssignmentEntityService extends BaseService<AssignmentEntity> {
  protected repository: Repository<AssignmentEntity>;
  private submissionRepository: Repository<AssignmentSubmissionEntity>;
  private lessonRepository: Repository<LessonEntity>;

  constructor(private readonly datasource: DataSource) {
    super();
    this.repository = this.datasource.getRepository<AssignmentEntity>(AssignmentEntity);
    this.submissionRepository = this.datasource.getRepository<AssignmentSubmissionEntity>(AssignmentSubmissionEntity);
    this.lessonRepository = this.datasource.getRepository<LessonEntity>(LessonEntity);
  }

  /**
   * DATABASE MUTATION: Creates a new Assignment (Subjective or MCQ) linked to a Lesson
   */
  async createAssignment(dto: any, creatorId: string): Promise<AssignmentEntity> {
    const { lessonId, title, instructions, assignmentType, mcqConfig, maxScore, dueDate } = dto;

    if (!lessonId) {
      throw new BadRequestException('lessonId is required to associate an assignment with a lesson.');
    }

    if (!UUID_REGEX.test(lessonId)) {
      throw new BadRequestException(`"${lessonId}" is not a valid UUID format for lessonId.`);
    }

    try {
      // 1. Verify target lesson exists
      const lesson = await this.lessonRepository.findOne({ where: { id: lessonId } });
      if (!lesson) {
        throw new NotFoundException(`Lesson with ID "${lessonId}" non-existent.`);
      }

      // 2. Create Assignment Record
      const newAssignment = this.repository.create({
        title,
        instructions: instructions ?? dto.description ?? null,
        assignmentType: assignmentType ?? 'Subjective',
        mcqConfig: mcqConfig ?? null,
        maxScore: maxScore ?? 100,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        lesson,
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

  async submitAssignment(
    assignmentId: string,
    traineeId: string,
    submissionText: string,
    attachmentUrl?: string,
  ): Promise<AssignmentSubmissionEntity> {
    // 1. Validate UUID format before hitting the database
    if (!UUID_REGEX.test(assignmentId)) {
      throw new BadRequestException(`"${assignmentId}" is not a valid UUID format.`);
    }

    try {
      // 2. Fetch target assignment
      const assignment = await this.repository.findOne({ where: { id: assignmentId } });
      if (!assignment) {
        throw new NotFoundException(`Assignment with ID "${assignmentId}" non-existent.`);
      }

      // 3. Upsert submission
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
      } else {
        submission = this.submissionRepository.create({
          assignment,
          trainee: { id: traineeId } as any,
          submissionText,
          attachmentUrl: attachmentUrl ?? undefined,
          status: 'Submitted',
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

  async findByLessonId(lessonId: string): Promise<AssignmentEntity[]> {
    if (!UUID_REGEX.test(lessonId)) {
      throw new BadRequestException(`"${lessonId}" is not a valid UUID format.`);
    }

    return await this.repository.find({
      where: {
        lesson: { id: lessonId }
      } as any
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