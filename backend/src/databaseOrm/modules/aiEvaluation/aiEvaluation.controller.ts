import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiEvaluationService } from './aiEvaluation.service';
import { RoutePaths } from '../../../constants/routePaths';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller(RoutePaths.AiEvaluation)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiEvaluationController {
  constructor(private readonly aiEvalService: AiEvaluationService) {}

  /**
   * Trigger AI evaluation for a submission (internal use / admin override).
   * Normally triggered automatically by the assignment submission flow.
   */
  @Post('evaluate/:submissionId')
  @Roles('Admin', 'Trainer')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerEvaluation(@Param('submissionId') submissionId: string) {
    // Fire and forget — evaluation runs asynchronously
    this.aiEvalService.evaluateSubmission(submissionId).catch(err => {
      console.error(`AI evaluation trigger failed for ${submissionId}:`, err);
    });
    return { message: 'AI evaluation queued', submissionId };
  }

  /**
   * Trainer reviews and releases an AI-evaluated submission.
   * Accepts optional edits to question scores and overall remark.
   */
  @Post('review/:submissionId')
  @Roles('Admin', 'Trainer')
  async reviewAndRelease(
    @Param('submissionId') submissionId: string,
    @Body()
    body: {
      questionScores?: Array<{
        questionId: string;
        score: number;
        maxScore: number;
        remark: string;
      }>;
      overallRemark?: string;
    },
    @GetUser() currentUser: any,
  ) {
    const trainerId = currentUser?.id || currentUser?.sub;
    return await this.aiEvalService.trainerReviewAndRelease(
      submissionId,
      trainerId,
      body,
    );
  }
}
