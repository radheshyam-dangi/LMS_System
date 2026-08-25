import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Headers,
} from '@nestjs/common';
import { AssignmentEntityService } from './assignment.service';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { NotificationService } from '../notification/notification.service';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentController {
  constructor(
    private readonly assignmentService: AssignmentEntityService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get('submissions/pending')
  @Roles('Admin', 'Trainer')
  async getPendingSubmissions(@GetUser() currentUser: any, @Headers('x-active-role') activeRole?: string) {
    if (activeRole?.toLowerCase() === 'admin') return [];
    const trainerId = currentUser?.id || currentUser?.sub;
    const isAdmin = this.assignmentService.isAdminUser(currentUser);
    return await this.assignmentService.findPendingSubmissionsForTrainer(
      isAdmin ? undefined : trainerId,
    );
  }

  @Put('submissions/:id/evaluate')
  @Roles('Admin', 'Trainer')
  async evaluateSubmission(
    @Param('id') submissionId: string,
    @Body()
    dto: {
      score: number;
      feedback: string;
      status?: 'Approved' | 'Rejected' | 'Evaluated';
    },
    @GetUser() currentUser: any,
  ) {
    const evaluatorId = currentUser?.id || currentUser?.sub;
    const isAdmin = this.assignmentService.isAdminUser(currentUser);
    return await this.assignmentService.evaluateSubmission(
      submissionId,
      evaluatorId,
      dto.score,
      dto.feedback,
      dto.status || 'Approved',
      isAdmin
    );
  }

  /** Trainer opens evaluation → mark related notification read (counter decreases) */
  @Post('submissions/:id/open')
  @Roles('Admin', 'Trainer')
  async openSubmissionForEvaluation(
    @Param('id') submissionId: string,
    @GetUser() currentUser: any,
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    const affected = await this.notificationService.markByRelatedEntity(
      userId,
      'submission',
      submissionId,
    );
    // Also clear generic evaluation-queue notifications if linked by type only
    await this.notificationService.markByTypes(
      userId,
      ['submission_pending'],
      submissionId,
    );
    const unreadCount = await this.notificationService.countUnread(userId);
    return { affected, unreadCount };
  }

  @Get('my-submissions')
  @Roles('Trainee', 'Trainer', 'Admin')
  async getMySubmissions(@GetUser() currentUser: any, @Headers('x-active-role') activeRole?: string) {
    if (activeRole?.toLowerCase() === 'admin') return [];
    const traineeId = currentUser?.id || currentUser?.sub;
    if (!traineeId) throw new ForbiddenException('User session missing.');
    return await this.assignmentService.findMySubmissions(traineeId);
  }

  /** Trainee: list assignments assigned to them (external + path-linked) */
  @Get('my-assignments')
  @Roles('Trainee', 'Trainer', 'Admin')
  async getMyAssignments(@GetUser() currentUser: any, @Headers('x-active-role') activeRole?: string) {
    if (activeRole?.toLowerCase() === 'admin') return [];
    const traineeId = currentUser?.id || currentUser?.sub;
    if (!traineeId) throw new ForbiddenException('User session missing.');
    return await this.assignmentService.findMyAssignments(traineeId);
  }

  @Get('external')
  @Roles('Admin', 'Trainer', 'Trainee')
  async getExternalAssignments(@GetUser() currentUser: any, @Headers('x-active-role') activeRole?: string) {
    const all = await this.assignmentService.findExternalAssignments();
    const roles = [
      currentUser?.role,
      currentUser?.primaryRole,
      ...(Array.isArray(currentUser?.roles) ? currentUser.roles : []),
    ]
      .map((r) => (typeof r === 'string' ? r : r?.name || '').toLowerCase())
      .filter(Boolean);

    if (roles.includes('admin') || roles.includes('trainer')) return all;

    const traineeId = currentUser?.id || currentUser?.sub;
    const myAssignments = await this.assignmentService.findMyAssignments(traineeId);
    const myAssignmentIds = new Set(myAssignments.map((a) => a.id));
    return all.filter((a) => myAssignmentIds.has(a.id));
  }

  @Post(':id/start')
  @Roles('Trainee', 'Trainer', 'Admin')
  async startAssignment(
    @Param('id') assignmentId: string,
    @GetUser() currentUser: any,
  ) {
    const traineeId = currentUser?.id || currentUser?.sub;
    if (!traineeId) throw new ForbiddenException('User session invalid.');
    return await this.assignmentService.startAssignment(assignmentId, traineeId);
  }

  @Post(':id/restart')
  @Roles('Trainee', 'Trainer', 'Admin')
  async restartAssignment(
    @Param('id') assignmentId: string,
    @GetUser() currentUser: any,
  ) {
    const traineeId = currentUser?.id || currentUser?.sub;
    if (!traineeId) throw new ForbiddenException('User session invalid.');
    return await this.assignmentService.restartAssignment(assignmentId, traineeId);
  }

  @Post(':id/submit')
  @Roles('Trainee', 'Trainer', 'Admin')
  async submitAssignment(
    @Param('id') assignmentId: string,
    @Body() dto: { submissionText: string; attachmentUrl?: string },
    @GetUser() currentUser: any,
  ) {
    const traineeId = currentUser?.id || currentUser?.sub;
    if (!traineeId) throw new ForbiddenException('User session invalid.');
    return await this.assignmentService.submitAssignment(
      assignmentId,
      traineeId,
      dto.submissionText,
      dto.attachmentUrl,
    );
  }

  @Post(':id/assign')
  @Roles('Admin', 'Trainer')
  async assignTrainees(
    @Param('id') id: string,
    @Body() body: { traineeIds?: string[]; traineeId?: string },
    @GetUser() currentUser: any,
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    const task = await this.assignmentService.findOne(id, userId);
    await this.assignmentService.assertCanManageAssignment(task, currentUser);
    const ids = body.traineeIds || (body.traineeId ? [body.traineeId] : []);
    const assignerId = currentUser.id || currentUser.sub;
    return await this.assignmentService.assignToTrainees(id, ids, assignerId);
  }

  @Delete(':id/unassign')
  @Roles('Admin', 'Trainer')
  async unassignTrainees(
    @Param('id') id: string,
    @Body() body: { traineeIds?: string[]; traineeId?: string },
    @GetUser() currentUser: any,
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    const task = await this.assignmentService.findOne(id, userId);
    await this.assignmentService.assertCanManageAssignment(task, currentUser);
    const ids = body.traineeIds || (body.traineeId ? [body.traineeId] : []);
    const unassignerId = currentUser.id || currentUser.sub;
    return await this.assignmentService.unassignTrainees(id, ids, unassignerId);
  }

  @Get()
  async findAll(
    @Query('lessonId') lessonId?: string,
    @Query('moduleId') moduleId?: string,
    @Query('learningPathId') learningPathId?: string,
    @Query('externalOnly') externalOnly?: string,
    @GetUser() currentUser?: any,
    @Headers('x-active-role') activeRole?: string,
  ) {
    if (activeRole) {
       if (!currentUser) currentUser = {};
       currentUser.activeRole = activeRole;
    }
    if (lessonId) {
      return await this.assignmentService.findByLessonId(lessonId, currentUser);
    }
    if (externalOnly === 'true' || externalOnly === '1') {
      return await this.assignmentService.findExternalAssignments(currentUser);
    }
    const all = await this.assignmentService.findAll(currentUser);
    return all.filter((a) => {
      if (
        moduleId &&
        a.module?.id !== moduleId &&
        (a as any).moduleId !== moduleId
      )
        return false;
      if (
        learningPathId &&
        a.learningPath?.id !== learningPathId &&
        (a as any).learningPathId !== learningPathId
      ) {
        return false;
      }
      return true;
    });
  }

  @Get(':id')
  @Roles('Admin', 'Trainer', 'Trainee')
  async getAssignment(@Param('id') id: string, @GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.assignmentService.findOne(id, userId);
  }

  @Post()
  @Roles('Admin', 'Trainer')
  async create(@Body() dto: any, @GetUser() currentUser: any) {
    const userId = currentUser.id || currentUser.sub;
    const isExternal =
      String(dto.assignmentType || '').toLowerCase() === 'external' ||
      (!dto.lessonId && !dto.moduleId && !dto.learningPathId);

    if (!isExternal && dto.lessonId) {
      const roles = [
        currentUser?.role,
        currentUser?.primaryRole,
        ...(Array.isArray(currentUser?.roles) ? currentUser.roles : []),
      ].map((r) => (typeof r === 'string' ? r : r?.name || '').toLowerCase());

      const isTrainerOrAdmin =
        roles.includes('admin') || roles.includes('trainer');
      if (!isTrainerOrAdmin) {
        const isOwner = await this.assignmentService.checkIsTaskPathOwner(
          dto.lessonId,
          userId,
        );
        if (!isOwner) {
          throw new ForbiddenException(
            'Only trainers or admins can create path-linked assignments.',
          );
        }
      }
    }

    return await this.assignmentService.createAssignment(dto, userId);
  }

  @Put(':id')
  @Roles('Admin', 'Trainer')
  async updateAssignment(
    @Param('id') id: string,
    @Body() dto: any,
    @GetUser() currentUser: any,
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    const task = await this.assignmentService.findOne(id, userId);
    await this.assignmentService.assertCanManageAssignment(task, currentUser);
    return await this.assignmentService.updateAssignment(id, dto);
  }

  @Delete(':id')
  @Roles('Admin', 'Trainer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAssignment(@Param('id') id: string, @GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    const task = await this.assignmentService.findOne(id, userId);
    await this.assignmentService.assertCanManageAssignment(task, currentUser);
    return await this.assignmentService.deleteAssignment(id);
  }
}
