import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  ForbiddenException,
  BadRequestException,
  ConsoleLogger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { TrainerAiAssistantService, SendTrainerMessageDto } from './trainerAiAssistant.service';
import { TrainerActionService } from './trainerAction.service';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class TrainerFeedbackDto {
  @IsIn(['thumbs_up', 'thumbs_down'])
  feedback: 'thumbs_up' | 'thumbs_down';

  @IsOptional()
  @IsString()
  comment?: string;
}

@Controller('trainer-ai-assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Trainer', 'Admin')
export class TrainerAiAssistantController {
  private readonly logger = new Logger(TrainerAiAssistantController.name);

  constructor(
    private readonly service: TrainerAiAssistantService,
    private readonly actionService: TrainerActionService,
  ) {}

  /**
   * POST /api/trainer-ai-assistant/messages
   */
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Req() req: any, @Body() dto: SendTrainerMessageDto)
  {
    const trainerId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!trainerId) throw new ForbiddenException('Unauthenticated');
    if (!dto.question?.trim()) throw new BadRequestException('Question cannot be empty');

    const cleanSnippet = dto.question.trim().replace(/\s+/g, ' ');
    const preview = cleanSnippet.length > 80 ? cleanSnippet.substring(0, 80) + '...' : cleanSnippet;
    this.logger.log(
      `[TrainerAiAssistantController] Incoming message from trainer ${trainerId} | PathId: ${dto.pathId || 'none'} | Query: "${preview}"`,
    );

    try {
      const result = await this.service.sendMessage(trainerId, dto, req.user);
      return result;
    } catch (e) {
      this.logger.error(`[TrainerAiAssistantController] Error for trainer ${trainerId}: ${(e as Error).message}`);
      throw e;
    }
  }

  /**
   * GET /api/trainer-ai-assistant/conversations
   */
  @Get('conversations')
  async listConversations(@Req() req: any) {
    const trainerId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!trainerId) throw new ForbiddenException('Unauthenticated');
    return this.service.listConversations(trainerId);
  }

  /**
   * GET /api/trainer-ai-assistant/conversations/:id
   */
  @Get('conversations/:id')
  async getConversation(@Req() req: any, @Param('id') id: string) {
    const trainerId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!trainerId) throw new ForbiddenException('Unauthenticated');
    return this.service.getConversation(trainerId, id);
  }

  /**
   * DELETE /api/trainer-ai-assistant/conversations/:id
   */
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Req() req: any, @Param('id') id: string) {
    const trainerId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!trainerId) throw new ForbiddenException('Unauthenticated');
    this.logger.log(`[TrainerAiAssistantController] Deleting conversation ${id} for trainer ${trainerId}`);
    await this.service.deleteConversation(trainerId, id);
  }

  /**
   * POST /api/trainer-ai-assistant/messages/:id/feedback
   */
  @Post('messages/:id/feedback')
  @HttpCode(HttpStatus.OK)
  async submitFeedback(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body() body: TrainerFeedbackDto,
  ) {
    const trainerId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!trainerId) throw new ForbiddenException('Unauthenticated');
    this.logger.log(`[TrainerAiAssistantController] Trainer ${trainerId} submitted feedback "${body.feedback}" for message ${messageId}`);
    await this.service.submitFeedback(trainerId, messageId, body.feedback, body.comment);
    return { success: true };
  }

  /**
   * POST /api/trainer-ai-assistant/actions/:id/confirm
   */
  @Post('actions/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmAction(@Req() req: any, @Param('id') actionId: string) {
    const trainerId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!trainerId) throw new ForbiddenException('Unauthenticated');
    this.logger.log(`[TrainerAiAssistantController] Trainer ${trainerId} confirming action ${actionId}`);
    return this.actionService.confirmAction(trainerId, actionId, req.user);
  }

  /**
   * POST /api/trainer-ai-assistant/actions/:id/cancel
   */
  @Post('actions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelAction(@Req() req: any, @Param('id') actionId: string) {
    const trainerId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!trainerId) throw new ForbiddenException('Unauthenticated');
    this.logger.log(`[TrainerAiAssistantController] Trainer ${trainerId} cancelling action ${actionId}`);
    return this.actionService.cancelAction(trainerId, actionId);
  }

  /**
   * GET /api/trainer-ai-assistant/actions/pending
   */
  @Get('actions/pending')
  async getPendingAction(@Req() req: any) {
    const trainerId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!trainerId) throw new ForbiddenException('Unauthenticated');
    const action = await this.actionService.getLatestPendingAction(trainerId);
    return { action };
  }
}
