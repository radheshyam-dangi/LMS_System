import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TrainerAiConversationEntity } from '../../entities/trainerAiConversation.entity';
import { TrainerAiMessageEntity } from '../../entities/trainerAiMessage.entity';
import { AssistantActionEntity } from '../../entities/assistantAction.entity';
import { TrainerAgentService } from './trainerAgent.service';
import { sanitizeAiResponse } from './trainerAiSanitizer';

import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SendTrainerMessageDto {
  @IsOptional()
  @IsString()
  conversationId?: string | null;

  @IsOptional()
  @IsString()
  pathId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question: string;
}

export interface TrainerAiResponseDto {
  conversationId: string;
  messageId: string;
  answer: string;
  actionCard?: Record<string, any> | null;
  upgradedLpId?: string | null;
}

@Injectable()
export class TrainerAiAssistantService {
  private readonly logger = new Logger(TrainerAiAssistantService.name);
  private convRepo: Repository<TrainerAiConversationEntity>;
  private msgRepo: Repository<TrainerAiMessageEntity>;
  private actionRepo: Repository<AssistantActionEntity>;

  constructor(
    private readonly datasource: DataSource,
    private readonly agentService: TrainerAgentService,
  ) {
    this.convRepo = this.datasource.getRepository(TrainerAiConversationEntity);
    this.msgRepo = this.datasource.getRepository(TrainerAiMessageEntity);
    this.actionRepo = this.datasource.getRepository(AssistantActionEntity);
  }

  /**
   * Main entrypoint for processing a trainer message.
   * Dispatches autonomously to TrainerAgentService with strict dynamic RBAC tool-calling.
   */
  async sendMessage(
    trainerId: string,
    dto: SendTrainerMessageDto,
    currentUser?: any,
  ): Promise<TrainerAiResponseDto> {
    const question = dto.question.trim();
    if (!question) {
      throw new BadRequestException('Question cannot be empty');
    }

    const startMs = Date.now();

    // 1. Resolve or create conversation
    const conv = await this.resolveConversation(trainerId, dto.conversationId, question);

    const cleanSnippet = question.replace(/\s+/g, ' ');
    const preview = cleanSnippet.length > 80 ? cleanSnippet.substring(0, 80) + '...' : cleanSnippet;
    this.logger.log(
      `[TrainerAiAssistantService] Processing query from Trainer ${trainerId} | Conv: ${conv.id} | Query: "${preview}"`,
    );

    // 2. Load previous conversation history for multi-turn continuity
    const previousMessages = await this.msgRepo.find({
      where: { conversationId: conv.id },
      order: { createdAt: 'ASC' },
      take: 16,
    });
    const history = previousMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 3. Persist user message
    const userMsg = this.msgRepo.create({
      conversationId: conv.id,
      role: 'user',
      content: question,
    });
    await this.msgRepo.save(userMsg);

    let answer = '';
    let actionCard: Record<string, any> | null = null;
    let upgradedLpId: string | null = null;

    try {
      // 4. Delegate to Autonomous Tool Calling Agent
      const agentResult = await this.agentService.processUserQuery({
        trainerId,
        question,
        conversationId: conv.id,
        activePathId: dto.pathId,
        history,
        currentUser,
      });

      answer = agentResult.answer;
      actionCard = agentResult.actionCard || null;
      upgradedLpId = agentResult.upgradedLpId || null;
    } catch (err) {
      this.logger.error(`Error in autonomous agent processing: ${(err as Error).message}`, (err as Error).stack);
      answer = `An error occurred while processing your request: ${(err as Error).message}. Please try again.`;
    }

    // 5. Sanitize and clean response
    const sanitizedAnswer = sanitizeAiResponse(answer);

    // 6. Persist assistant message
    const aiMsg = this.msgRepo.create({
      conversationId: conv.id,
      role: 'assistant',
      content: sanitizedAnswer,
      actionCard,
    });
    const savedAiMsg = await this.msgRepo.save(aiMsg);

    // 7. Update conversation count & timestamp
    conv.messageCount += 2;
    await this.convRepo.save(conv);

    const durationMs = Date.now() - startMs;
    this.logger.log(
      `[TrainerAiAssistantService] Response generated in ${durationMs}ms for Trainer ${trainerId} | ActionCard: ${actionCard ? actionCard.type : 'none'} | UpgradedLP: ${upgradedLpId || 'none'}`,
    );

    return {
      conversationId: conv.id,
      messageId: savedAiMsg.id,
      answer: sanitizedAnswer,
      actionCard,
      upgradedLpId,
    };
  }

  // ─────────────────────────────────────────────
  // Conversations API
  // ─────────────────────────────────────────────

  async listConversations(trainerId: string) {
    return this.convRepo.find({
      where: { trainerId },
      order: { updatedAt: 'DESC' },
      select: ['id', 'title', 'messageCount', 'updatedAt'],
    });
  }

  async getConversation(trainerId: string, conversationId: string) {
    const conv = await this.convRepo.findOne({
      where: { id: conversationId, trainerId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const messages = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      select: [
        'id',
        'role',
        'content',
        'actionCard',
        'sourceLabel',
        'citations',
        'feedback',
        'createdAt',
      ],
    });

    return {
      id: conv.id,
      title: conv.title,
      messages,
      updatedAt: conv.updatedAt,
    };
  }

  async deleteConversation(trainerId: string, conversationId: string) {
    const conv = await this.convRepo.findOne({
      where: { id: conversationId, trainerId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    await this.convRepo.remove(conv);
  }

  async submitFeedback(
    trainerId: string,
    messageId: string,
    feedback: 'thumbs_up' | 'thumbs_down',
    comment?: string,
  ) {
    const msg = await this.msgRepo.findOne({
      where: { id: messageId },
      relations: ['conversation'],
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.conversation?.trainerId !== trainerId) {
      throw new ForbiddenException('Access denied');
    }

    msg.feedback = feedback;
    if (comment) msg.feedbackComment = comment;
    await this.msgRepo.save(msg);
  }

  private async resolveConversation(
    trainerId: string,
    conversationId?: string | null,
    firstQuestion?: string,
  ): Promise<TrainerAiConversationEntity> {
    if (conversationId) {
      const existing = await this.convRepo.findOne({
        where: { id: conversationId, trainerId },
      });
      if (existing) return existing;
    }

    const title = firstQuestion
      ? firstQuestion.length > 60
        ? `${firstQuestion.substring(0, 57)}...`
        : firstQuestion
      : 'New Consultation';

    const conv = this.convRepo.create({
      trainerId,
      title,
      messageCount: 0,
    });
    return this.convRepo.save(conv);
  }
}

// Re-export helpers for backward compatibility
export { serializeLpToAuthoringPayload, summarizeCrudOperation } from './trainerCrudHelper';
