import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AiEvaluationService } from './aiEvaluation.service';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller('api/v1/assignments/:assignmentId/submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiEvaluationController {
  constructor(private readonly aiEvalService: AiEvaluationService) {}

  @Get(':submissionId')
  async getSubmission(
    @Param('assignmentId') assignmentId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return await this.aiEvalService.getSubmissionWithAiDetails(assignmentId, submissionId);
  }

  @Post(':submissionId/evaluate')
  @Roles('Admin', 'Trainer')
  async evaluateSubmission(
    @Param('assignmentId') assignmentId: string,
    @Param('submissionId') submissionId: string,
    @Body() payload: {
      questionScores: Array<{ questionId: string; score: number; maxScore: number; remark: string }>;
      overallRemark?: string;
    },
    @GetUser() currentUser: any,
  ) {
    const trainerId = currentUser?.id || currentUser?.sub;
    return await this.aiEvalService.trainerEvaluate(assignmentId, submissionId, trainerId, payload);
  }
}
