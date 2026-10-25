/**
 * AI Assistant Controller
 *
 * REST API for the Global AI Assistant.
 * All routes are behind JWT guard and require Trainee role.
 * No existing routes are changed.
 *
 * Routes:
 *   POST   /api/ai-assistant/messages
 *   GET    /api/ai-assistant/conversations
 *   GET    /api/ai-assistant/conversations/:id
 *   DELETE /api/ai-assistant/conversations/:id
 *   POST   /api/ai-assistant/messages/:id/feedback
 *   POST   /api/admin/ai-assistant/reindex   (admin)
 */
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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { AiAssistantService, SendMessageDto } from './aiAssistant.service';
import { EmbeddingOutboxService } from './embeddingOutbox.service';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class FeedbackDto {
  @IsIn(['thumbs_up', 'thumbs_down'])
  feedback: 'thumbs_up' | 'thumbs_down';

  @IsOptional()
  @IsString()
  comment?: string;
}

export class ReindexDto {
  @IsOptional()
  @IsString()
  lpId?: string;
}

@Controller('ai-assistant')
@UseGuards(JwtAuthGuard)
export class AiAssistantController {
  private readonly logger = new Logger(AiAssistantController.name);

  constructor(
    private readonly service: AiAssistantService,
    private readonly outbox: EmbeddingOutboxService,
  ) {}

  /**
   * POST /api/ai-assistant/messages
   * Send a question and get an AI response.
   * Body: { conversationId?: string, question: string, activeAssignmentId?: string }
   */
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Req() req: any, @Body() dto: SendMessageDto) {
    const traineeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!traineeId) throw new ForbiddenException('Unauthenticated');
    if (!dto.question?.trim()) throw new BadRequestException('Question cannot be empty');
    if (dto.question.length > 2000) throw new BadRequestException('Question too long (max 2000 chars)');

    try {
      return await this.service.sendMessage(traineeId, dto);
    } catch (e) {
      this.logger.error(`AI Assistant error for trainee ${traineeId}: ${(e as Error).message}`);
      throw e;
    }
  }

  /**
   * GET /api/ai-assistant/conversations
   * List conversations for the current trainee.
   */
  @Get('conversations')
  async listConversations(@Req() req: any) {
    const traineeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!traineeId) throw new ForbiddenException('Unauthenticated');
    return this.service.listConversations(traineeId);
  }

  /**
   * GET /api/ai-assistant/conversations/:id
   * Load one conversation with all messages.
   */
  @Get('conversations/:id')
  async getConversation(@Req() req: any, @Param('id') id: string) {
    const traineeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!traineeId) throw new ForbiddenException('Unauthenticated');
    return this.service.getConversation(traineeId, id);
  }

  /**
   * DELETE /api/ai-assistant/conversations/:id
   */
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Req() req: any, @Param('id') id: string) {
    const traineeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!traineeId) throw new ForbiddenException('Unauthenticated');
    await this.service.deleteConversation(traineeId, id);
  }

  /**
   * POST /api/ai-assistant/messages/:id/feedback
   * Body: { feedback: 'thumbs_up' | 'thumbs_down', comment?: string }
   */
  @Post('messages/:id/feedback')
  @HttpCode(HttpStatus.OK)
  async submitFeedback(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body() body: FeedbackDto,
  ) {
    const traineeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!traineeId) throw new ForbiddenException('Unauthenticated');
    await this.service.submitFeedback(traineeId, messageId, body.feedback, body.comment);
    return { success: true };
  }
}

/**
 * Admin controller for reindex and analytics.
 * Separate controller to keep routing clean.
 */
@Controller('admin/ai-assistant')
@UseGuards(JwtAuthGuard)
export class AiAssistantAdminController {
  private readonly logger = new Logger(AiAssistantAdminController.name);

  constructor(private readonly outbox: EmbeddingOutboxService) {}

  /**
   * POST /api/admin/ai-assistant/reindex
   * Body: { lpId?: string } — if empty, reindexes all active LPs
   */
  @Post('reindex')
  @HttpCode(HttpStatus.ACCEPTED)
  async reindex(@Req() req: any, @Body() body: ReindexDto) {
    // Only admin/trainer roles
    const role = req.user?.role || req.user?.primaryRole;
    if (!['Admin', 'Trainer'].includes(role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const eventType = 'lp_saved';
    if (body.lpId) {
      await this.outbox.enqueue(eventType, body.lpId);
      this.outbox.processEntityImmediate(eventType, body.lpId).catch((err) => {
        this.logger.error(`Reindex failed for LP ${body.lpId}: ${err.message}`);
      });
      return { message: `Reindexing initiated for LP ${body.lpId}` };
    }

    this.logger.log(`Admin triggered full reindex by ${req.user?.userId}`);
    this.outbox.reindexAllLps().catch((err) => {
      this.logger.error(`Full reindex failed: ${err.message}`);
    });
    return { message: 'Full reindex started in background' };
  }
}
