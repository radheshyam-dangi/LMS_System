import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository, Not, In } from 'typeorm';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { TrainerAiConversationEntity } from '../../entities/trainerAiConversation.entity';
import { TrainerAiMessageEntity } from '../../entities/trainerAiMessage.entity';
import { AssistantActionEntity } from '../../entities/assistantAction.entity';
import { TrainerAiIntentService } from './trainerAiIntent.service';
import { TrainerLpQaService } from './trainerLpQa.service';
import { TrainerLpGenerationService } from './trainerLpGeneration.service';
import { TrainerLpUpgradeService } from './trainerLpUpgrade.service';
import { TrainerActionService } from './trainerAction.service';
import { sanitizeAiResponse, findReferencedLp } from './trainerAiSanitizer';
import { McpBridgeService } from '../../../mcp/mcp-bridge.service';

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
    private readonly intentService: TrainerAiIntentService,
    private readonly qaService: TrainerLpQaService,
    private readonly generationService: TrainerLpGenerationService,
    private readonly upgradeService: TrainerLpUpgradeService,
    private readonly actionService: TrainerActionService,
    private readonly mcpBridgeService: McpBridgeService,
  ) {
    this.convRepo = this.datasource.getRepository(TrainerAiConversationEntity);
    this.msgRepo = this.datasource.getRepository(TrainerAiMessageEntity);
    this.actionRepo = this.datasource.getRepository(AssistantActionEntity);
  }

  /**
   * Main entrypoint for processing a trainer message.
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

    // Resolve user roles & admin authorization
    const roles: string[] = [];
    const pushRole = (v: any) => {
      if (!v) return;
      if (typeof v === 'string') roles.push(v.toLowerCase());
      else if (v?.name) roles.push(String(v.name).toLowerCase());
    };
    pushRole(currentUser?.role);
    pushRole(currentUser?.primaryRole);
    pushRole(currentUser?.activeRole);
    if (Array.isArray(currentUser?.roles)) currentUser.roles.forEach(pushRole);
    const isAdmin = roles.includes('admin');

    // 1. Resolve or create conversation
    const conv = await this.resolveConversation(trainerId, dto.conversationId, question);

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

    // 4. Check for any pending action scoped to this conversation
    const pendingAction = await this.actionService.getLatestPendingAction(trainerId, conv.id);
    const hasActiveLp = Boolean(dto.pathId);
    const classified = await this.intentService.classify(question, Boolean(pendingAction), hasActiveLp, history);

    let answer = '';
    let actionCard: Record<string, any> | null = null;
    let upgradedLpId: string | null = null;

    try {
      if (classified.intent === 'confirm') {
        if (!pendingAction) {
          answer = "There is no pending Learning Path draft waiting for confirmation.";
        } else {
          const res = await this.actionService.confirmAction(trainerId, pendingAction.id, currentUser);
          answer = `${res.message}\n\nYou can now view it in your catalog or edit it at any time.`;
          upgradedLpId = pendingAction.targetId;
        }
      } else if (classified.intent === 'cancel') {
        if (!pendingAction) {
          answer = "There is no pending draft to cancel.";
        } else {
          const res = await this.actionService.cancelAction(trainerId, pendingAction.id);
          answer = res.message;
        }
      } else if (classified.intent === 'upgrade_lp') {
        const hasActiveStudioContext = Boolean(dto.pathId);

        // Fetch candidate learning paths: published courses AND recent paths owned by this trainer (including drafts)
        const forbiddenStatuses = ['deleted', 'archived'];
        const allPublishedLps = await this.datasource.getRepository(LearningPathEntity).find({
          relations: ['createdBy'],
          where: {
            status: Not(In(['ai_draft', 'Ai_draft', 'draft', ...forbiddenStatuses])),
          },
          select: ['id', 'title', 'status', 'updatedAt'],
          order: { updatedAt: 'DESC' },
          take: 20,
        });

        const trainerRecentLps = await this.datasource.getRepository(LearningPathEntity).find({
          relations: ['createdBy'],
          where: {
            createdBy: { id: trainerId },
            status: Not(In(forbiddenStatuses)),
          },
          select: ['id', 'title', 'status', 'updatedAt'],
          order: { updatedAt: 'DESC' },
          take: 15,
        });

        const combinedCandidateLps = [
          ...trainerRecentLps,
          ...allPublishedLps.filter((p) => !trainerRecentLps.some((t) => t.id === p.id)),
        ];

        const matchedLp = findReferencedLp(question, combinedCandidateLps);

        let targetId: string | undefined;
        let targetLpTitle: string | undefined;

        if (matchedLp) {
          targetId = matchedLp.id;
          targetLpTitle = matchedLp.title;
        } else if (dto.pathId) {
          targetId = dto.pathId;
          const currentLp = combinedCandidateLps.find((p) => p.id === dto.pathId);
          targetLpTitle = currentLp?.title;
        } else if (pendingAction?.targetId) {
          targetId = pendingAction.targetId;
          const pendingLp = combinedCandidateLps.find((p) => p.id === pendingAction.targetId);
          targetLpTitle = pendingLp?.title;
        } else {
          // Check for the most recent LP action in this conversation
          const lastActionInConv = await this.actionRepo.findOne({
            where: { trainerId },
            order: { createdAt: 'DESC' },
          });
          if (lastActionInConv?.targetId && lastActionInConv.payload?.conversationId === conv.id) {
            targetId = lastActionInConv.targetId;
            const lp = combinedCandidateLps.find((p) => p.id === targetId);
            targetLpTitle = lp?.title;
          } else if (trainerRecentLps.length > 0) {
            targetId = trainerRecentLps[0].id;
            targetLpTitle = trainerRecentLps[0].title;
          }
        }

        let targetLp: LearningPathEntity | null = null;
        if (targetId) {
          targetLp = await this.datasource.getRepository(LearningPathEntity).findOne({
            where: { id: targetId },
            relations: [
              'createdBy',
              'modules',
              'modules.lessons',
              'modules.lessons.resources',
              'modules.assignments',
            ],
          });
          if (targetLp) {
            targetLpTitle = targetLp.title;
          }
        }

        if (!targetId || !targetLp) {
          const lpList = combinedCandidateLps.length > 0
            ? combinedCandidateLps.slice(0, 5).map((lp, idx) => `${idx + 1}. **${lp.title}**`).join('\n')
            : 'No learning paths currently available.';

          answer = `Unable to determine which Learning Path you would like to update.\n\n` +
            `Please specify the name of the Learning Path (e.g. "In LP LLM, add 2 modules...") or open it in **Curriculum Studio**.\n\n` +
            `**Available Learning Paths:**\n\n${lpList}`;
        } else {
          // Verify OWNERSHIP: Only owner or admin can mutate the curriculum!
          const ownerId = targetLp.createdBy?.id || (targetLp as any)?.createdById;
          const isOwner = Boolean(ownerId && String(ownerId).toLowerCase() === String(trainerId).toLowerCase()) || isAdmin;

          if (!isOwner) {
            answer = `**Access Denied: Learning Path Ownership Required**\n\n` +
              `You cannot perform modifications on **"${targetLpTitle}"** because you are not the designated owner of this Learning Path.\n\n` +
              `Only the course creator or an administrator has permission to modify its curriculum.`;
          } else {
            const { operationType, summary: crudSummary } = summarizeCrudOperation(question);

            // Serialize pre-update snapshot for instant rollback on cancel
            const previousTree = serializeLpToAuthoringPayload(targetLp);

            // Apply the upgrade to the curriculum in the DB immediately so visual preview is updated!
            const upgradeRes = await this.upgradeService.upgradeLearningPath(targetId, question, trainerId);

            const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
            const action = this.actionRepo.create({
              trainerId,
              actionType: 'confirm_crud',
              targetId,
              status: 'pending',
              payload: {
                conversationId: conv.id,
                lpId: targetId,
                lpTitle: targetLpTitle,
                instruction: question,
                operationType,
                summary: crudSummary,
                previousTree,
                moduleCount: upgradeRes.moduleCount,
                lessonCount: upgradeRes.lessonCount,
                assignmentCount: upgradeRes.assignmentCount,
              },
              expiresAt,
            });
            const savedAction = await this.actionRepo.save(action);

            actionCard = {
              actionId: savedAction.id,
              actionType: 'confirm_crud',
              type: 'confirm_crud',
              lpId: targetId,
              lpTitle: targetLpTitle,
              moduleCount: upgradeRes.moduleCount,
              lessonCount: upgradeRes.lessonCount,
              assignmentCount: upgradeRes.assignmentCount,
              operationType,
              summary: crudSummary,
              status: 'pending',
            };

            upgradedLpId = targetId;

            answer = `**Proposed Curriculum Change: Confirmation Required**\n\n` +
              `**Target Learning Path:** "${targetLpTitle}"\n` +
              `**Proposed Operation:** ${crudSummary}\n\n` +
              `Please confirm this update before modifications are applied to your catalog. Click **Preview in Studio** to review the live canvas in Curriculum Studio, click **Confirm & Apply** to finalize and publish to your catalog, or click the **Delete** icon to discard these updates and revert to the previous version.`;
          }
        }
      } else if (classified.intent === 'create_lp') {
        let titleToCreate = classified.title || question;
        titleToCreate = titleToCreate
          .replace(/^(?:please\s+)?(?:create|generate|build|start|make|design)\s+/i, '')
          .replace(/^(?:a\s+|an\s+|the\s+)?(?:new\s+)?(?:lp|learning\s+path|course|curriculum|syllabus)\s*(?:of|for|on|about|:)?\s*/i, '')
          .replace(/^[:\-\s]+|[:\-\s]+$/g, '')
          .trim();

        if (!titleToCreate) {
          answer = "Please provide a title for the Learning Path you'd like to create (e.g. `Create LP: Advanced TypeScript Patterns` or `create the curriculum of DevOps`).";
        } else {
          const genResult = await this.generationService.generateLearningPath(titleToCreate, trainerId, conv.id);

          actionCard = {
            actionId: genResult.action.id,
            type: 'create_lp',
            lpId: genResult.learningPath.id,
            lpTitle: genResult.learningPath.title,
            moduleCount: genResult.moduleCount,
            lessonCount: genResult.lessonCount,
            assignmentCount: genResult.assignmentCount,
            status: 'pending',
          };

          const warningNote = genResult.warning ? `\n\n> *Notice: ${genResult.warning}*` : '';
          answer = `I have researched and generated a complete curriculum for **"${genResult.learningPath.title}"** with **${genResult.moduleCount} modules**, **${genResult.lessonCount} lessons** (including verified tutorial links and documentation), and **${genResult.assignmentCount} assessments**.${warningNote}\n\n*This curriculum is currently saved as an AI draft and is not visible to trainees.* Click **Preview in Studio** to review nodes or click **Confirm & Publish** when you are ready.`;
        }
      } else if (classified.intent === 'trainee_query') {
        const queryToUse = classified.sanitizedQuery || question;
        answer = await this.mcpBridgeService.handleTraineeInquiry(queryToUse, history);
      } else {
        // Q&A / Curriculum Guidance / Deep node inquiries with full multi-turn conversational history
        const queryToUse = classified.sanitizedQuery || question;
        const qaRes = await this.qaService.handleQuery(trainerId, queryToUse, dto.pathId, history);
        answer = qaRes.answer;
      }
    } catch (err) {
      this.logger.error(`Error processing trainer intent "${classified.intent}": ${(err as Error).message}`);
      answer = `An error occurred while processing your request: ${(err as Error).message}. Please try again.`;
    }

    // 4. Sanitize and clean response (strip any stray emojis or decorative ASCII artifacts)
    const sanitizedAnswer = sanitizeAiResponse(answer);

    // 5. Persist assistant message
    const aiMsg = this.msgRepo.create({
      conversationId: conv.id,
      role: 'assistant',
      content: sanitizedAnswer,
      actionCard,
    });
    const savedAiMsg = await this.msgRepo.save(aiMsg);

    // 6. Update conversation count & timestamp
    conv.messageCount += 2;
    await this.convRepo.save(conv);

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

export function serializeLpToAuthoringPayload(lp: LearningPathEntity): any {
  return {
    id: lp.id,
    title: lp.title,
    description: lp.description,
    level: lp.difficulty || 'Intermediate',
    status: lp.status || 'ai_draft',
    origin: lp.origin || 'ai',
    duration: lp.duration || '12 weeks',
    skillsTags: Array.isArray(lp.skillsTags) ? lp.skillsTags : [],
    modules: (lp.modules || []).map((m: any, mIdx: number) => {
      const lessons = (m.lessons || []).map((l: any, lIdx: number) => ({
        id: l.id,
        title: l.title || `Lesson ${lIdx + 1}`,
        description: l.description || '',
        videos: Array.isArray(l.videos) ? l.videos : (l.videoUrl ? [{ url: l.videoUrl, title: l.title }] : []),
        audios: Array.isArray(l.audios) ? l.audios : [],
        resources: Array.isArray(l.resources)
          ? l.resources.map((r: any) => ({
              url: r.url,
              label: r.title || r.label || 'Link',
              type: r.type || 'Link',
            }))
          : [],
      }));

      const createdLessonIds = lessons.map((l: any) => l.id);

      const assignments = (m.assignments || []).map((a: any, aIdx: number) => {
        const questions = (a.questions || []).map((q: any) => ({
          id: q.id,
          text: q.text || 'Question',
          type: q.type === 'MCQ' ? 'MCQ' : 'Subjective',
          maxPoints: Number(q.maxPoints) || 10,
          options: q.type === 'MCQ' ? (q.options || ['Option A', 'Option B', 'Option C', 'Option D']) : undefined,
          correctIndex: q.type === 'MCQ' ? (Number(q.correctIndex) || 0) : undefined,
          expectedAnswerGuideline: q.expectedAnswerGuideline || undefined,
          requiresLessonGrounding: true,
          lessonDependencies: createdLessonIds,
        }));

        return {
          id: a.id,
          title: a.title || `Module ${mIdx + 1} Assessment`,
          body: a.description || a.instructions || a.body || '',
          questions,
          dependsOnLessonIds: createdLessonIds,
          lockConfig: a.lockConfig || { enabled: true },
          evaluation: a.evaluation || {
            autoEvaluateWithAI: true,
            humanInterventionRequired: true,
          },
          timerDuration: a.timerDuration || { days: 7, hours: 0, minutes: 0 },
          countdownStart: a.countdownStart || 'taskUnlocked',
        };
      });

      return {
        id: m.id,
        title: m.title || `Module ${mIdx + 1}`,
        description: m.description || '',
        sequentialModuleLock: m.sequentialModuleLock ?? true,
        sequentialLessonLock: m.sequentialLessonLock ?? true,
        learningObjectives: m.objectives || m.learningObjectives || [],
        learningOutcomes: m.outcomes || m.learningOutcomes || [],
        lessons,
        assignments,
      };
    }),
  };
}

function summarizeCrudOperation(instruction: string): { operationType: 'delete' | 'create' | 'update'; summary: string } {
  const lower = instruction.toLowerCase();
  const hasDelete = /\b(?:delete[ds]?|deleting|remov(?:e|ed|es|ing)|drop(?:ped|s)?|discard(?:ed|s)?|omit(?:ted|s)?|trash(?:ed|es)?|eras(?:e|ed|es|ing)|still\s+visible)\b/i.test(lower);
  const hasAdd = /\b(?:add[s]?|adding|insert(?:ed|ing|s)?|append(?:ed|ing|s)?|attach(?:ed|ing|s)?|creat(?:e|ed|ing|es)|build(?:ing)?|new|make)\b/i.test(lower);

  const parts: string[] = [];

  // Check additions
  if (hasAdd) {
    const modCountMatch = lower.match(/\b(?:add|insert|create|new)\s*([0-9]+)\s*(?:more\s+)?mod(?:ule)?/i);
    const modCount = modCountMatch ? modCountMatch[1] : null;

    const lessonCountMatch = lower.match(/\b(?:with\s+)?(?:([0-9]+)|one|two|three)\s+less(?:on)?/i);
    let lessonInfo = '';
    if (lessonCountMatch) {
      const rawNum = lessonCountMatch[1] || (lessonCountMatch[0].includes('one') ? '1' : lessonCountMatch[0].includes('two') ? '2' : '3');
      lessonInfo = `${rawNum} lesson${rawNum === '1' ? '' : 's'}`;
    }

    const assignCountMatch = lower.match(/\b(?:and\s+)?(?:([0-9]+)|one|two|three)\s+(?:assignment|assessment|task|quiz)/i);
    let assignInfo = '';
    if (assignCountMatch) {
      const rawNum = assignCountMatch[1] || (assignCountMatch[0].includes('one') ? '1' : assignCountMatch[0].includes('two') ? '2' : '3');
      const isMcq = /\bmcq\b/i.test(lower);
      assignInfo = `${rawNum} ${isMcq ? 'MCQ ' : ''}assessment${rawNum === '1' ? '' : 's'}`;
    }

    if (modCount) {
      const details = [lessonInfo, assignInfo].filter(Boolean).join(' and ');
      parts.push(`Add ${modCount} module${modCount === '1' ? '' : 's'}${details ? ` (with ${details} each)` : ''}`);
    } else {
      const singleModMatch = lower.match(/\bmod(?:ule)?\s*([0-9]+)\b/i);
      const lessonMatch = lower.match(/\bless(?:on)?\s*([0-9]+)?\b/i);
      if (lessonMatch && singleModMatch && !hasDelete) {
        parts.push(`Add lesson to Module ${singleModMatch[1]}`);
      } else if (singleModMatch && !hasDelete) {
        parts.push(`Add Module ${singleModMatch[1]} to the curriculum`);
      } else {
        parts.push(`Add requested curriculum components`);
      }
    }
  }

  // Check deletions
  if (hasDelete) {
    // 1. Question deletion
    const qMatch = lower.match(/\bquest(?:ion)?\s*([0-9]+)\b/i);
    const assignQuote = instruction.match(/["'“]([^"'“”]+)["'”]/i);
    const assignMatch = lower.match(/\b(?:assignment|assessment|task|quiz)\s*([0-9]+)\b/i);

    if (qMatch) {
      const qNum = qMatch[1];
      const assignName = assignQuote ? `"${assignQuote[1]}"` : (assignMatch ? `Assessment ${assignMatch[1]}` : 'the assignment');
      parts.push(`Remove Question ${qNum} from ${assignName}`);
    } else {
      // 2. Module deletion
      const modDelMatch =
        lower.match(/(?:delete[ds]?|remov(?:e|ed|ing)|drop(?:ped)?|omit(?:ted)?|trash(?:ed)?)\s+(?:only\s+)?(?:the\s+)?mod(?:ule)?\s*([0-9]+)/i) ||
        lower.match(/\bmod(?:ule)?\s*([0-9]+)\s*.*?(?:delete[ds]?|remov(?:e|ed|es|ing)|drop|trash)/i);

      const namedModMatch =
        instruction.match(/mod(?:ule)?\s*[0-9]*\s*[-–—:]\s*["'“]([^"'“”]+)["'”]/i) ||
        instruction.match(/["'“]([^"'“”]+)["'”]/i);

      if (modDelMatch) {
        const mNum = modDelMatch[1];
        const titleSuffix = namedModMatch ? ` ("${namedModMatch[1]}")` : '';
        parts.push(`Delete Module ${mNum}${titleSuffix}`);
      } else if (namedModMatch) {
        parts.push(`Delete Module "${namedModMatch[1]}"`);
      } else {
        // 3. Lesson deletion
        const lessDelMatch =
          lower.match(/(?:delete[ds]?|remov(?:e|ed|ing)|drop(?:ped)?|omit(?:ted)?|trash(?:ed)?)\s+(?:the\s+)?less(?:on)?\s*([0-9]+)/i) ||
          lower.match(/\bless(?:on)?\s*([0-9]+)\s*.*?(?:delete[ds]?|remov(?:e|ed|es|ing)|still\s+visible)/i);

        if (lessDelMatch) {
          parts.push(`Delete Lesson ${lessDelMatch[1]}`);
        } else if (assignMatch || (assignQuote && !hasAdd)) {
          const aName = assignQuote ? `"${assignQuote[1]}"` : `Assessment ${assignMatch![1]}`;
          parts.push(`Delete assessment ${aName}`);
        } else {
          parts.push(`Remove specified item`);
        }
      }
    }
  }

  const operationType: 'delete' | 'create' | 'update' =
    hasDelete && hasAdd ? 'update' : (hasDelete ? 'delete' : (hasAdd ? 'create' : 'update'));

  const summary = parts.length > 0 ? parts.join('; ') : `Apply modifications according to: "${instruction}"`;

  return { operationType, summary };
}

