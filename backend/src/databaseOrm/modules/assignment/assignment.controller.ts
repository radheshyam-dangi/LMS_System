import { Controller, Post, Get, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AssignmentEntityService } from './assignment.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { GetUser } from '../../../common/decorator/GetUser.decorator';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentEntityService) {}

  /**
   * POST /assignments
   * Creates a new Assignment (Restricted to Trainers & Admins)
   */
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