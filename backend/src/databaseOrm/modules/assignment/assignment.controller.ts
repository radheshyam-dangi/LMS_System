import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AssignmentEntityService } from './assignment.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { RoutePaths } from '../../../constants/routePaths';

@Controller(RoutePaths.Assignments)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentEntityService) {}
  @Post()
  @Roles('Admin', 'Trainer')
  async create(@Body() dto: any, @GetUser() currentUser: any) {
    const creatorId = currentUser?.id || currentUser?.sub;
    if (!creatorId) {
      throw new BadRequestException('User session details missing.');
    }
    return await this.assignmentService.createAssignment(dto, creatorId);
  }
/**
   * GET /assignments/my-submissions
   * Returns all submissions made by the logged-in Trainee
   */
  @Get('my-submissions')
  async getMySubmissionsHistory(@GetUser() currentUser: any) {
    const traineeId = currentUser?.id || currentUser?.sub;
    if (!traineeId) {
      throw new BadRequestException('User session identity missing.');
    }
    return await this.assignmentService.findAllSubmissionsByTrainee(traineeId);
  }
  /**
   * POST /assignments/:id/submit
   * Allows Trainees to submit solutions
   */
  @Post(':id/submit')
  async submitAssignment(
    @Param('id') assignmentId: string,
    @Body() dto: { submissionText: string; attachmentUrl?: string },
    @GetUser() currentUser: any,
  ) {
    const traineeId = currentUser?.id || currentUser?.sub;
    if (!traineeId) {
      throw new BadRequestException('User session identity missing.');
    }

    if (!dto.submissionText) {
      throw new BadRequestException('Submission text or code answer is required.');
    }

    return await this.assignmentService.submitAssignment(
      assignmentId,
      traineeId,
      dto.submissionText,
      dto.attachmentUrl,
    );
  }

  /**
   * 🌟 GET /assignments/submissions/pending
   * Fetches all pending trainee submissions waiting for evaluation (Trainer & Admin)
   */
  @Get('submissions/pending')
  @Roles('Admin', 'Trainer')
  async getPendingSubmissions(@GetUser() currentUser: any) {
    const trainerId = currentUser?.id || currentUser?.sub;
    if (!trainerId) {
      throw new BadRequestException('User session identity missing.');
    }
    return await this.assignmentService.findPendingSubmissionsForTrainer(trainerId);
  }

  /**
   * 🌟 PUT /assignments/submissions/:id/evaluate
   * Allows Trainers & Admins to evaluate, grade, and Accept/Reject a trainee's submission
   */
  @Put('submissions/:id/evaluate')
  @Roles('Admin', 'Trainer')
  async evaluateSubmission(
    @Param('id') submissionId: string,
    @Body() dto: { score: number; feedback: string; status?: 'Accepted' | 'Rejected' | 'Evaluated' },
    @GetUser() currentUser: any,
  ) {
    const evaluatorId = currentUser?.id || currentUser?.sub;
    if (!evaluatorId) {
      throw new BadRequestException('Evaluator session identity missing.');
    }

    return await this.assignmentService.evaluateSubmission(
      submissionId,
      evaluatorId,
      dto.score,
      dto.feedback,
      dto.status ?? 'Accepted',
    );
  }

  @Get()
  async findByLesson(@Query('lessonId') lessonId?: string) {
    if (lessonId) {
      return await this.assignmentService.findByLessonId(lessonId);
    }
    return await this.assignmentService.findAll();
  }

  @Get(':id/my-submission')
  async getMySubmission(@Param('id') assignmentId: string, @GetUser() currentUser: any) {
    const traineeId = currentUser?.id || currentUser?.sub;
    return await this.assignmentService.findTraineeSubmission(assignmentId, traineeId);
  }

  @Get(':id/submissions')
  @Roles('Admin', 'Trainer')
  async getSubmissionsForAssignment(@Param('id') assignmentId: string) {
    return await this.assignmentService.findSubmissionsByAssignment(assignmentId);
  }
}