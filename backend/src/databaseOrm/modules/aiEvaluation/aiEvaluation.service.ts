import { Injectable, Logger, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AssignmentSubmissionEntity } from '../../entities/assignmentSubmission.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { NotificationService } from '../notification/notification.service';
import { BaseService } from '../../../common/services/base.service';

@Injectable()
export class AiEvaluationService extends BaseService<AssignmentSubmissionEntity> {
  protected readonly logger = new Logger(AiEvaluationService.name);
  protected repository: Repository<AssignmentSubmissionEntity>;

  constructor(
    private readonly datasource: DataSource,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {
    super();
    this.repository = this.datasource.getRepository<AssignmentSubmissionEntity>(AssignmentSubmissionEntity);
  }

  async getSubmissionWithAiDetails(assignmentId: string, submissionId: string) {
    const submission = await this.repository.findOne({
      where: { id: submissionId, assignment: { id: assignmentId } },
      relations: ['assignment', 'trainee', 'assignment.createdBy', 'assignment.lesson', 'assignment.module'],
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async trainerEvaluate(assignmentId: string, submissionId: string, trainerId: string, payload: any) {
    const submission = await this.repository.findOne({
      where: { id: submissionId, assignment: { id: assignmentId } },
      relations: ['assignment', 'trainee', 'assignment.createdBy'],
    });
    if (!submission) throw new NotFoundException('Submission not found');

    submission.status = 'APPROVED'; // or 'EVALUATED'
    submission.questionScores = payload.questionScores;
    
    let totalScore = 0;
    let totalMaxScore = 0;
    if (payload.questionScores) {
      for (const qs of payload.questionScores) {
        totalScore += qs.score;
        totalMaxScore += qs.maxScore;
      }
    }
    submission.score = totalScore;
    submission.totalScore = totalScore;
    submission.totalMaxScore = totalMaxScore;
    submission.overallRemark = payload.overallRemark || 'Evaluated by trainer';
    submission.feedback = payload.overallRemark;
    submission.evaluationMethod = 'ai_assisted';
    submission.evaluatedAt = new Date();
    submission.evaluatedBy = { id: trainerId } as any;

    await this.repository.save(submission);

    // Notify trainee
    if (submission.trainee?.id) {
      await this.notificationService.create({
        userId: submission.trainee.id,
        type: 'evaluation_completed',
        title: 'Assignment evaluated',
        message: `Score: ${totalScore}/${totalMaxScore}. Remark: ${payload.overallRemark || 'Evaluated by trainer'}`,
        link: '/assignments',
        relatedEntityType: 'submission',
        relatedEntityId: submission.id,
      });
    }

    return submission;
  }

  async evaluateSubmission(submissionId: string) {
    const submission = await this.repository.findOne({
      where: { id: submissionId },
      relations: ['assignment'],
    });
    if (!submission || !submission.assignment) return;

    const jobRepo = this.datasource.getRepository('EvaluationJob');
    const job = jobRepo.create({
      submission: { id: submissionId },
      assignment: { id: submission.assignment.id },
      status: 'pending',
    });
    await jobRepo.save(job);
  }
}

