import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AiConversationEntity } from '../../entities/aiConversation.entity';
import { AiMessageEntity } from '../../entities/aiMessage.entity';
import { AiFeedbackEntity } from '../../entities/aiFeedback.entity';

@Injectable()
export class AiEntityService {
  private conversationRepo: Repository<AiConversationEntity>;
  private messageRepo: Repository<AiMessageEntity>;
  private feedbackRepo: Repository<AiFeedbackEntity>;

  constructor(private readonly datasource: DataSource) {
    this.conversationRepo = this.datasource.getRepository(AiConversationEntity);
    this.messageRepo = this.datasource.getRepository(AiMessageEntity);
    this.feedbackRepo = this.datasource.getRepository(AiFeedbackEntity);
  }

  async listConversations(userId: string) {
    return await this.conversationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createConversation(userId: string, title?: string) {
    const conversation = this.conversationRepo.create({
      userId,
      title: title?.trim() || 'AI Coaching Session',
    });
    const saved = await this.conversationRepo.save(conversation);

    await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: saved.id,
        role: 'assistant',
        content:
          'Hello! I am your SkillForge AI Engineering Coach. Ask about learning paths, architecture, APIs, or assignment feedback.',
      }),
    );

    return await this.getConversation(saved.id, userId);
  }

  async getConversation(id: string, userId: string) {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
      relations: ['messages'],
    });
    if (!conversation) throw new NotFoundException(`Conversation "${id}" not found.`);
    if (conversation.userId !== userId) throw new ForbiddenException('Access denied.');
    if (Array.isArray(conversation.messages)) {
      conversation.messages.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return conversation;
  }

  async addMessage(conversationId: string, userId: string, content: string) {
    const conversation = await this.getConversation(conversationId, userId);

    const userMessage = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        role: 'user',
        content: content.trim(),
      }),
    );

    const reply = this.generateReply(content);
    const assistantMessage = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: reply,
      }),
    );

    return { userMessage, assistantMessage };
  }

  async getFeedbackBySubmission(submissionId: string) {
    return await this.feedbackRepo.find({
      where: { submissionId },
      order: { createdAt: 'DESC' },
    });
  }

  async createFeedback(dto: {
    submissionId: string;
    generatedFeedback?: string;
    architectureReview?: string;
    improvementSuggestions?: string;
  }) {
    return await this.feedbackRepo.save(
      this.feedbackRepo.create({
        submissionId: dto.submissionId,
        generatedFeedback: dto.generatedFeedback,
        architectureReview: dto.architectureReview,
        improvementSuggestions: dto.improvementSuggestions,
      }),
    );
  }

  private generateReply(query: string): string {
    const q = query.toLowerCase();
    if (q.includes('api') || q.includes('rest')) {
      return 'For RESTful APIs, use clear status codes (200/201/400/401/500), validate payloads, and keep controllers thin with business logic in services.';
    }
    if (q.includes('database') || q.includes('sql') || q.includes('schema')) {
      return 'Design normalized tables with indexed foreign keys, enforce constraints, and evolve schema with migrations rather than ad-hoc changes.';
    }
    if (q.includes('progress') || q.includes('path')) {
      return 'Focus on completing lessons in order, submit assignments early for feedback, and track completion % from your Progress page.';
    }
    return 'Great question. Prefer clean architecture, typed contracts between frontend and backend, and incremental delivery with measurable learning outcomes.';
  }
}
