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

        // Fetch accessible learning paths: ONLY active, published, confirmed courses!
        // Strictly exclude unconfirmed drafts (ai_draft), drafts, deleted, or archived courses.
        const forbiddenStatuses = ['ai_draft', 'Ai_draft', 'draft', 'deleted', 'archived', 'unconfirmed'];
        const allLps = await this.datasource.getRepository(LearningPathEntity).find({
          relations: ['createdBy'],
          where: {
            status: Not(In(forbiddenStatuses)),
          },
          select: ['id', 'title', 'status', 'updatedAt'],
          order: { updatedAt: 'DESC' },
          take: 30,
        });

        const matchedLp = findReferencedLp(question, allLps);

        let targetId: string | undefined;
        let targetLpTitle: string | undefined;

        if (matchedLp) {
          targetId = matchedLp.id;
          targetLpTitle = matchedLp.title;
        } else if (dto.pathId) {
          targetId = dto.pathId;
          const currentLp = allLps.find(p => p.id === dto.pathId);
          targetLpTitle = currentLp?.title;
        } else if (pendingAction?.targetId && pendingAction.payload?.conversationId === conv.id) {
          targetId = pendingAction.targetId;
          const pendingLp = allLps.find(p => p.id === pendingAction.targetId);
          targetLpTitle = pendingLp?.title;
        }

        // Fetch target LP with createdBy to verify ownership
        let targetLp: LearningPathEntity | null = null;
        if (targetId) {
          targetLp = await this.datasource.getRepository(LearningPathEntity).findOne({
            where: { id: targetId },
            relations: ['createdBy'],
          });
          if (targetLp) {
            targetLpTitle = targetLp.title;
          }
        }

        // ── SCENARIO A: Global AI Assistant Mode (outside Curriculum Studio) ────────
        if (!hasActiveStudioContext) {
          const { operationType, summary: crudSummary } = summarizeCrudOperation(question);

          if (targetId && targetLp) {
            const ownerId = targetLp.createdBy?.id || (targetLp as any)?.createdById;
            const isOwner = Boolean(ownerId && String(ownerId).toLowerCase() === String(trainerId).toLowerCase()) || isAdmin;

            if (isOwner) {
              answer = `**Curriculum Modification: Open in Curriculum Studio**\n\n` +
                `You are currently in **Global AI Assistant** mode. To add, edit, or delete modules and lessons in **"${targetLpTitle}"**, please open this course in **Curriculum Studio**:\n\n` +
                `- Go to **Manage Curriculum**\n` +
                `- Click **Edit Learning Path** for **"${targetLpTitle}"**\n` +
                `- Open the **Curriculum AI Assistant** in the editor toolbar to apply modifications with live canvas preview.\n\n` +
                `*From the Global Assistant, you can create brand new Learning Paths (e.g. "Create LP: [Title]") or ask for course details.*`;
            } else {
              answer = `**Access Notice: Learning Path Ownership Required**\n\n` +
                `You cannot modify **"${targetLpTitle}"** because you are not the designated owner of this Learning Path.\n\n` +
                `Only the course creator or an institutional administrator has authorization to edit modules, lessons, and assessments.`;
            }
          } else {
            const lpList = allLps.length > 0
              ? allLps.slice(0, 6).map((lp, idx) => `${idx + 1}. **${lp.title}**`).join('\n')
              : 'No learning paths currently available in your catalog.';

            answer = `**Curriculum Modification: Open in Curriculum Studio**\n\n` +
              `Curriculum modifications (adding, editing, or deleting modules, lessons, and assignments) cannot be made from the Global Assistant.\n\n` +
              `To update a course, please open it in **Curriculum Studio**:\n` +
              `- Go to **Manage Curriculum**\n` +
              `- Click **Edit Learning Path** for the desired course\n` +
              `- Open the **Curriculum AI Assistant** in the editor toolbar to make changes.\n\n` +
              `**Available Learning Paths:**\n\n${lpList}\n\n` +
              `*From the Global Assistant, you can create brand new Learning Paths (e.g. "Create LP: [Title]") or ask for course details.*`;
          }
        } else {
          // ── SCENARIO B: Curriculum Studio Mode (Inside LPEditorPage) ────────
          if (!targetId || !targetLp) {
            answer = `Unable to locate the active Learning Path for this operation. Please reopen the course in Curriculum Studio and try again.`;
          } else {
            // Verify OWNERSHIP: Only owner or admin can mutate the curriculum!
            const ownerId = targetLp.createdBy?.id || (targetLp as any)?.createdById;
            const isOwner = Boolean(ownerId && String(ownerId).toLowerCase() === String(trainerId).toLowerCase()) || isAdmin;

            if (!isOwner) {
              answer = `**Access Denied: Learning Path Ownership Required**\n\n` +
                `You cannot perform CRUD operations on **"${targetLpTitle}"** because you are not the designated owner of this Learning Path.\n\n` +
                `Only the owner or an administrator has permission to add, edit, or remove modules, lessons, and assessments.`;
            } else {
              // Owner verified! Stage confirm_crud action
              const { operationType, summary: crudSummary } = summarizeCrudOperation(question);

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
                operationType,
                summary: crudSummary,
                status: 'pending',
              };

              const isDeletion = operationType === 'delete';
              const actionWord = isDeletion ? 'removal' : (operationType === 'create' ? 'addition' : 'update');

              answer = `**Proposed Curriculum Change: Confirmation Required**\n\n` +
                `**Target Learning Path:** "${targetLpTitle}"\n` +
                `**Proposed Operation:** ${crudSummary}\n\n` +
                `Please confirm this ${actionWord} before modifications are applied to the curriculum. Click **Confirm & Apply** below or reply with **"Confirm"** to proceed. You can also reply with **"Cancel"** to abort.`;
            }
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

function summarizeCrudOperation(instruction: string): { operationType: 'delete' | 'create' | 'update'; summary: string } {
  const lower = instruction.toLowerCase();
  const isDelete = /\b(?:delete|remove|drop|discard|omit|trash|erase|still\s+visible)\b/i.test(lower);
  const isAdd = /\b(?:add|insert|append|attach|create|new|make)\b/i.test(lower);

  // 1. Question removal/addition:
  // e.g. from this assignment "Module 1 Hands-On Assessment" remove question 2
  const qMatch = lower.match(/\bquest(?:ion)?\s*([0-9]+)\b/i);
  const assignQuote = instruction.match(/["'“]([^"'“”]+)["'”]/i);
  const assignMatch = lower.match(/\b(?:assignment|assessment|task|quiz)\s*([0-9]+)\b/i);

  if (qMatch) {
    const qNum = qMatch[1];
    const assignName = assignQuote ? `"${assignQuote[1]}"` : (assignMatch ? `Assessment ${assignMatch[1]}` : 'the assignment');
    if (isDelete) {
      return { operationType: 'delete', summary: `Remove Question ${qNum} from assignment ${assignName}` };
    }
    return { operationType: isAdd ? 'create' : 'update', summary: `Add Question ${qNum} to assignment ${assignName}` };
  }

  // 2. Lesson removal/addition:
  const lessonMatch = lower.match(/\bless(?:on)?\s*([0-9]+)\b/i);
  if (lessonMatch) {
    const lNum = lessonMatch[1];
    if (isDelete) {
      return { operationType: 'delete', summary: `Permanently delete Lesson ${lNum} from the curriculum` };
    }
    return { operationType: isAdd ? 'create' : 'update', summary: `Add Lesson ${lNum} to the curriculum` };
  }

  // 3. Module removal/addition:
  const modMatch = lower.match(/\bmod(?:ule)?\s*([0-9]+)\b/i);
  if (modMatch) {
    const mNum = modMatch[1];
    if (isDelete) {
      return { operationType: 'delete', summary: `Permanently delete Module ${mNum} from the curriculum` };
    }
    return { operationType: isAdd ? 'create' : 'update', summary: `Add Module ${mNum} to the curriculum` };
  }

  // 4. Assignment removal/addition:
  if (assignMatch || assignQuote) {
    const aName = assignQuote ? `"${assignQuote[1]}"` : `Assessment ${assignMatch![1]}`;
    if (isDelete) {
      return { operationType: 'delete', summary: `Permanently delete assignment ${aName} from the curriculum` };
    }
    return { operationType: isAdd ? 'create' : 'update', summary: `Add assignment ${aName} to the curriculum` };
  }

  // Generic fallback:
  if (isDelete) {
    return { operationType: 'delete', summary: `Remove specified item according to: "${instruction}"` };
  }
  return { operationType: isAdd ? 'create' : 'update', summary: `Apply modifications according to: "${instruction}"` };
}

