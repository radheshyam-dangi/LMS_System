import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { DataSource, Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssistantActionEntity } from '../../entities/assistantAction.entity';
import { AssistantAuditEntity } from '../../entities/assistantAudit.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { TrainerAiMessageEntity } from '../../entities/trainerAiMessage.entity';
import { UserEntity } from '../../entities/user.entity';
import { EmbeddingOutboxService } from '../aiAssistant/embeddingOutbox.service';
import { TrainerLpUpgradeService } from './trainerLpUpgrade.service';
import { LpAuthoringService } from '../lpAuthoring/lpAuthoring.service';

export interface ActionResolutionResult {
  success: boolean;
  message: string;
  lpId?: string;
  lpTitle?: string;
}

@Injectable()
export class TrainerActionService {
  private readonly logger = new Logger(TrainerActionService.name);
  private actionRepo: Repository<AssistantActionEntity>;
  private auditRepo: Repository<AssistantAuditEntity>;
  private lpRepo: Repository<LearningPathEntity>;
  private msgRepo: Repository<TrainerAiMessageEntity>;

  constructor(
    private readonly datasource: DataSource,
    private readonly embeddingOutbox: EmbeddingOutboxService,
    @Inject(forwardRef(() => TrainerLpUpgradeService))
    private readonly upgradeService: TrainerLpUpgradeService,
    @Inject(forwardRef(() => LpAuthoringService))
    private readonly lpAuthoringService: LpAuthoringService,
  ) {
    this.actionRepo = this.datasource.getRepository(AssistantActionEntity);
    this.auditRepo = this.datasource.getRepository(AssistantAuditEntity);
    this.lpRepo = this.datasource.getRepository(LearningPathEntity);
    this.msgRepo = this.datasource.getRepository(TrainerAiMessageEntity);
  }

  /**
   * Finds the latest unexpired pending action for the trainer.
   * Scoped to conversationId when provided to prevent action leakage across chats.
   */
  async getLatestPendingAction(
    trainerId: string,
    conversationId?: string,
  ): Promise<AssistantActionEntity | null> {
    const actions = await this.actionRepo.find({
      where: {
        trainerId,
        status: 'pending',
      },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    if (!actions.length) return null;

    const now = new Date();
    for (const action of actions) {
      if (now > new Date(action.expiresAt)) {
        action.status = 'expired';
        await this.actionRepo.save(action);
        continue;
      }

      // If conversationId is specified, only match actions created in this conversation
      if (conversationId) {
        const actionConvId = action.payload?.conversationId;
        if (!actionConvId || actionConvId !== conversationId) {
          continue;
        }
      }

      return action;
    }

    return null;
  }

  /**
   * Deterministic confirmation of draft LP creation.
   */
  async confirmAction(trainerId: string, actionId?: string, currentUser?: any): Promise<ActionResolutionResult> {
    let action: AssistantActionEntity | null = null;

    if (actionId) {
      action = await this.actionRepo.findOne({
        where: { id: actionId, trainerId },
      });
    } else {
      action = await this.getLatestPendingAction(trainerId);
    }

    if (!action) {
      throw new NotFoundException('No active pending action found to confirm.');
    }

    if (action.status === 'executed') {
      return {
        success: true,
        message: 'This Learning Path has already been confirmed and published.',
        lpId: action.targetId || undefined,
        lpTitle: action.payload?.title || undefined,
      };
    }

    if (action.status !== 'pending') {
      throw new BadRequestException(`Cannot confirm action with status "${action.status}".`);
    }

    if (new Date() > new Date(action.expiresAt)) {
      action.status = 'expired';
      await this.actionRepo.save(action);
      throw new BadRequestException('This proposed action has expired. Please create a new path.');
    }

    const lpId = action.targetId;
    if (!lpId) {
      throw new BadRequestException('Action target ID is missing.');
    }

    const lp = await this.lpRepo.findOne({
      where: { id: lpId },
      relations: ['createdBy'],
    });

    if (!lp) {
      throw new NotFoundException(`Learning Path "${lpId}" was not found.`);
    }

    // ─────────────────────────────────────────────────────────────
    // Handler for CRUD mutations (add/delete/update lesson, module, assignment, question)
    // ─────────────────────────────────────────────────────────────
    if (action.actionType === 'confirm_crud' || action.actionType === 'confirm_upgrade') {
      // Verify ownership: Only LP Owner or Admin can execute CRUD mutations
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

      const ownerId = lp.createdBy?.id || (lp as any)?.createdById;
      const isOwner = Boolean(ownerId && String(ownerId).toLowerCase() === String(trainerId).toLowerCase()) || isAdmin;

      if (!isOwner) {
        throw new ForbiddenException('Access Denied: Only the Learning Path Owner or an Admin can perform CRUD modifications.');
      }

      const instruction = action.payload?.instruction || '';
      const summary = action.payload?.summary || 'Curriculum modification';

      let upgradeSummary = summary;
      let moduleCount = action.payload?.moduleCount;
      let lessonCount = action.payload?.lessonCount;
      let assignmentCount = action.payload?.assignmentCount;

      // If changes were not applied yet (e.g. legacy action without previousTree), execute upgrade now
      if (!action.payload?.previousTree) {
        const upgradeRes = await this.upgradeService.upgradeLearningPath(lp.id, instruction, trainerId);
        upgradeSummary = upgradeRes.summary;
        moduleCount = upgradeRes.moduleCount;
        lessonCount = upgradeRes.lessonCount;
        assignmentCount = upgradeRes.assignmentCount;
      }

      // Ensure the LP status is promoted to Active so it is immediately visible in the trainer course catalog
      if (lp.status === 'ai_draft' || lp.status === 'Ai_draft' || lp.status === 'draft') {
        lp.status = 'Active';
        await this.lpRepo.save(lp);
      }

      // Mark action executed
      action.status = 'executed';
      await this.actionRepo.save(action);
      this.logger.log(
        `[TrainerActionService] Trainer ${trainerId} confirmed CRUD mutation on LP "${lp.title}" (${lp.id}) | Operation: ${upgradeSummary}`,
      );

      // Update message action card in chat history if stored
      await this.updateMessageActionCardStatus(action.id, 'confirmed');

      // Trigger embedding indexing so the confirmed path is indexed for search
      try {
        await this.embeddingOutbox.enqueue('lp_saved', lp.id);
        this.embeddingOutbox.processEntityImmediate('lp_saved', lp.id).catch(err => {
          this.logger.warn(`Immediate embedding processing failed for confirmed LP ${lp.id}: ${(err as Error).message}`);
        });
      } catch (err) {
        this.logger.warn(`Failed to enqueue embedding for confirmed LP ${lp.id}: ${(err as Error).message}`);
      }

      // Record audit
      await this.auditRepo.save(
        this.auditRepo.create({
          userId: trainerId,
          role: 'Trainer',
          intent: 'confirm_crud',
          prompt: `Confirmed CRUD operation on LP: ${lp.title} (${instruction})`,
          actionType: 'confirm_crud',
          targetId: lp.id,
          outcome: 'success',
          metadata: {
            lpTitle: lp.title,
            actionId: action.id,
            summary: upgradeSummary,
          },
        }),
      );

      const isDeletion = /\b(?:delete[ds]?|remov(?:e|ed|es|ing)|drop(?:ped|s)?|discard(?:ed|s)?|omit(?:ted|s)?|trash(?:ed|es)?|eras(?:e|ed|es|ing)|still\s+visible)\b/i.test(instruction);
      const headerTitle = isDeletion
        ? '**Curriculum Updated: Node Removed**'
        : '**Curriculum Upgraded & Published Successfully**';

      const actionDescription = isDeletion
        ? 'The specified item has been permanently removed from the curriculum.'
        : 'The requested additions and modifications have been applied to the curriculum.';

      const statsSection = (moduleCount !== undefined && lessonCount !== undefined && assignmentCount !== undefined)
        ? `**Current Curriculum Structure:**\n` +
          `- **Total Modules:** ${moduleCount}\n` +
          `- **Total Lessons:** ${lessonCount}\n` +
          `- **Total Assessments:** ${assignmentCount}\n\n`
        : '';

      return {
        success: true,
        message: `${headerTitle}\n\n` +
          `**Target Learning Path:** "${lp.title}"\n\n` +
          `**Final Confirmation of Action:**\n` +
          `- **Status:** Active (Published to Catalog)\n` +
          `- **Operation:** ${upgradeSummary}\n\n` +
          statsSection +
          `The learning path is created in the database effectively and is visible in your course catalog. ${actionDescription}`,
        lpId: lp.id,
        lpTitle: lp.title,
      };
    }

    // ─────────────────────────────────────────────────────────────
    // Handler for New Learning Path Creation
    // ─────────────────────────────────────────────────────────────
    // Publish the LP
    lp.status = 'Active';
    await this.lpRepo.save(lp);

    // Mark action executed
    action.status = 'executed';
    await this.actionRepo.save(action);
    this.logger.log(
      `[TrainerActionService] Trainer ${trainerId} confirmed and published draft LP "${lp.title}" (${lp.id})`,
    );

    // Update message action card in chat history if stored
    await this.updateMessageActionCardStatus(action.id, 'confirmed');

    // Trigger embedding indexing
    try {
      await this.embeddingOutbox.enqueue('lp_saved', lp.id);
      this.embeddingOutbox.processEntityImmediate('lp_saved', lp.id).catch(err => {
        this.logger.warn(`Immediate embedding processing failed for confirmed LP ${lp.id}: ${(err as Error).message}`);
      });
    } catch (err) {
      this.logger.error(`Failed to enqueue embeddings for confirmed LP ${lp.id}: ${(err as Error).message}`);
    }

    // Record audit
    await this.auditRepo.save(
      this.auditRepo.create({
        userId: trainerId,
        role: 'Trainer',
        intent: 'confirm_create',
        prompt: `Confirmed publication of LP: ${lp.title}`,
        actionType: 'confirm_create',
        targetId: lp.id,
        outcome: 'success',
        metadata: {
          lpTitle: lp.title,
          actionId: action.id,
        },
      }),
    );

    return {
      success: true,
      message: `Learning Path **"${lp.title}"** has been confirmed and published successfully!`,
      lpId: lp.id,
      lpTitle: lp.title,
    };
  }

  /**
   * Cancel or discard the proposed action.
   */
  async cancelAction(trainerId: string, actionId?: string): Promise<ActionResolutionResult> {
    let action: AssistantActionEntity | null = null;

    if (actionId) {
      action = await this.actionRepo.findOne({
        where: { id: actionId, trainerId },
      });
    } else {
      action = await this.getLatestPendingAction(trainerId);
    }

    if (!action) {
      throw new NotFoundException('No active pending action found to cancel.');
    }

    action.status = 'cancelled';
    await this.actionRepo.save(action);
    this.logger.log(
      `[TrainerActionService] Trainer ${trainerId} cancelled action ${action.id} (${action.actionType}) for LP ${action.targetId}`,
    );

    // Update message action card in chat
    await this.updateMessageActionCardStatus(action.id, 'cancelled');

    // Clean up draft LP row or restore previous curriculum state
    if (action.actionType === 'confirm_create' && action.targetId) {
      await this.deleteDraftLpCascade(action.targetId);
    } else if (action.actionType === 'confirm_crud' && action.payload?.previousTree && action.targetId) {
      try {
        await this.lpAuthoringService.createLearningPathFromDocument(action.payload.previousTree, trainerId);
      } catch (err) {
        this.logger.warn(`Failed to restore previousTree on cancelAction: ${(err as Error).message}`);
      }
    }

    // Record audit
    await this.auditRepo.save(
      this.auditRepo.create({
        userId: trainerId,
        role: 'Trainer',
        intent: action.actionType === 'confirm_crud' ? 'cancel_crud' : 'cancel_create',
        prompt: action.actionType === 'confirm_crud' ? 'Cancelled proposed curriculum CRUD action' : 'Cancelled draft LP creation',
        actionType: action.actionType,
        targetId: action.targetId,
        outcome: 'cancelled',
        metadata: {
          actionId: action.id,
        },
      }),
    );

    return {
      success: true,
      message: action.actionType === 'confirm_crud'
        ? (action.payload?.previousTree
            ? 'The proposed curriculum updates have been discarded and the Learning Path has been restored to its previous state.'
            : 'The proposed curriculum change has been cancelled. No modifications were made.')
        : `Draft Learning Path **"${action.payload?.title || 'Course'}"** has been discarded.`,
      lpId: action.targetId || undefined,
      lpTitle: action.payload?.title || undefined,
    };
  }

  private async updateMessageActionCardStatus(actionId: string, newStatus: string): Promise<void> {
    try {
      const messages = await this.msgRepo
        .createQueryBuilder('msg')
        .where("msg.action_card->>'actionId' = :actionId", { actionId })
        .getMany();

      for (const m of messages) {
        if (m.actionCard) {
          m.actionCard = {
            ...m.actionCard,
            status: newStatus,
          };
          await this.msgRepo.save(m);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to update message action card status: ${(err as Error).message}`);
    }
  }

  /**
   * Periodic cleanup: Mark expired actions and delete orphan ai_draft LPs older than 24h.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredDrafts(): Promise<void> {
    const now = new Date();
    try {
      const expiredActions = await this.actionRepo.find({
        where: {
          status: 'pending',
          expiresAt: LessThan(now),
        },
      });

      for (const action of expiredActions) {
        action.status = 'expired';
        await this.actionRepo.save(action);

        if (action.targetId) {
          await this.deleteDraftLpCascade(action.targetId);
        }
      }

      if (expiredActions.length > 0) {
        this.logger.log(`Cleaned up ${expiredActions.length} expired assistant draft actions.`);
      }
    } catch (err) {
      this.logger.error(`Error during expired draft cleanup: ${(err as Error).message}`);
    }
  }

  /**
   * Safely cascades and removes unconfirmed ai_draft learning paths
   */
  private async deleteDraftLpCascade(lpId: string): Promise<void> {
    try {
      const moduleRepo = this.datasource.getRepository(ModuleEntity);
      const lessonRepo = this.datasource.getRepository(LessonEntity);
      const assignRepo = this.datasource.getRepository(AssignmentEntity);

      const modules = await moduleRepo.find({
        where: { learningPath: { id: lpId } },
      });

      for (const m of modules) {
        await assignRepo.delete({ module: { id: m.id } });
        await lessonRepo.delete({ module: { id: m.id } });
        await moduleRepo.delete({ id: m.id });
      }

      await this.lpRepo.delete({ id: lpId, status: 'ai_draft' });
    } catch (err) {
      this.logger.warn(`Could not delete draft LP ${lpId}: ${(err as Error).message}`);
    }
  }
}
