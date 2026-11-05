import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository, Not, In } from 'typeorm';
import {
  PostgresMcpService,
  GetTraineesArgs,
  GetLearningPathsArgs,
  GetTrainersArgs,
  GetEnrollmentsArgs,
} from '../../../mcp/postgres-mcp.service';
import { TrainerLpGenerationService } from './trainerLpGeneration.service';
import { TrainerLpUpgradeService } from './trainerLpUpgrade.service';
import { TrainerActionService } from './trainerAction.service';
import { TrainerLpQaService } from './trainerLpQa.service';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { AssistantActionEntity } from '../../entities/assistantAction.entity';
import { getToolsForRole, ToolDefinition } from './tools/trainerTools.registry';
import { executeWebSearch } from './tools/trainerWebSearch.helper';
import { serializeLpToAuthoringPayload, summarizeCrudOperation } from './trainerCrudHelper';
import { sanitizeAiResponse, findReferencedLp } from './trainerAiSanitizer';

export interface AgentProcessOptions {
  trainerId: string;
  question: string;
  conversationId: string;
  activePathId?: string | null;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentUser?: any;
}

export interface AgentProcessResult {
  answer: string;
  actionCard?: Record<string, any> | null;
  upgradedLpId?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

interface UserContext {
  userId: string;
  role: string;
  roles: string[];
  isAdmin: boolean;
  isTrainer: boolean;
  isTrainee: boolean;
  currentUser?: any;
}

@Injectable()
export class TrainerAgentService {
  private readonly logger = new Logger(TrainerAgentService.name);
  private lpRepo: Repository<LearningPathEntity>;
  private actionRepo: Repository<AssistantActionEntity>;

  constructor(
    private readonly datasource: DataSource,
    private readonly postgresMcpService: PostgresMcpService,
    private readonly generationService: TrainerLpGenerationService,
    private readonly upgradeService: TrainerLpUpgradeService,
    private readonly actionService: TrainerActionService,
    private readonly qaService: TrainerLpQaService,
  ) {
    this.lpRepo = this.datasource.getRepository(LearningPathEntity);
    this.actionRepo = this.datasource.getRepository(AssistantActionEntity);
  }

  /**
   * Main entrypoint for processing user messages through the Autonomous Agent Engine.
   * Evaluates user role, dynamically provides authorized tools, executes LLM tool calling,
   * enforces runtime ownership guards, and synthesizes a natural, human-grade response.
   */
  async processUserQuery(options: AgentProcessOptions): Promise<AgentProcessResult> {
    const { trainerId, question, conversationId, activePathId, history, currentUser } = options;

    const startTurnMs = Date.now();
    const userContext = this.resolveUserContext(trainerId, currentUser);
    const groqKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    const cleanSnippet = question.trim().replace(/\s+/g, ' ');
    const preview = cleanSnippet.length > 80 ? cleanSnippet.substring(0, 80) + '...' : cleanSnippet;
    this.logger.log(
      `[TrainerAgentService] Starting query processing for Trainer ${trainerId} (Role: ${userContext.role}, Admin: ${userContext.isAdmin}) | ActivePath: ${activePathId || 'none'} | Model: ${model} | Query: "${preview}"`,
    );

    if (!groqKey) {
      throw new Error('GROQ_API_KEY is not configured in backend environment');
    }

    // 1. Dynamic Tool Gating (Tier 1 Defense): Only pass authorized tools to the LLM
    const tools: ToolDefinition[] = getToolsForRole(userContext.role);

    // 2. Resolve any pending staged action for this user & conversation
    const pendingAction = await this.actionService.getLatestPendingAction(trainerId, conversationId);

    // 3. Assemble system prompt with contextual awareness
    const systemPrompt = this.buildSystemPrompt(userContext, pendingAction, activePathId);

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: question },
    ];

    let stagedActionCard: Record<string, any> | null = null;
    let stagedUpgradedLpId: string | null = null;
    let finalAnswer = '';

    // Maximum 3 autonomous tool execution iterations per turn (safety circuit breaker)
    const MAX_TOOL_ITERATIONS = 3;
    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const payload: any = {
        model,
        messages,
        temperature: 0.2,
        max_tokens: 1500,
      };

      // Only pass tools if available for this role
      if (tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = 'auto';
      }

      this.logger.log(
        `[TrainerAgentService] ReAct Turn ${iteration}/${MAX_TOOL_ITERATIONS}: Invoking LLM (${payload.model}) with ${messages.length} messages and ${tools.length} available tools...`,
      );

      let assistantMessage: any = null;

      // Resilient Model Pool: Primary model + fallback models on 429 rate limit or 5xx outages
      const candidateModels = [
        process.env.GROQ_MODEL || process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
      ].filter((m, i, arr) => m && arr.indexOf(m) === i);

      let lastErrorText = '';

      for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
        const currentModel = candidateModels[mIdx];
        payload.model = currentModel;

        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${groqKey}`,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(35000),
          });

          if (!response.ok) {
            lastErrorText = await response.text();
            let parsedErr: any = null;
            try {
              parsedErr = JSON.parse(lastErrorText);
            } catch { }

            // Resilience Case 1: Intercept Groq 400 tool_use_failed and recover from failed_generation!
            if (
              response.status === 400 &&
              parsedErr?.error?.code === 'tool_use_failed' &&
              parsedErr?.error?.failed_generation
            ) {
              this.logger.warn(
                `[Groq Tool Recovery] Intercepted 400 tool_use_failed on model ${currentModel}. Parsing failed_generation...`,
              );
              const recovered = this.parseFailedGeneration(parsedErr.error.failed_generation);
              if (recovered) {
                this.logger.log(
                  `[Groq Tool Recovery] Successfully recovered tool "${recovered.name}" with args: ${JSON.stringify(recovered.args)}`,
                );
                assistantMessage = {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: `call_recovered_${Date.now()}`,
                      type: 'function',
                      function: {
                        name: recovered.name,
                        arguments: JSON.stringify(recovered.args),
                      },
                    },
                  ],
                };
                break;
              }
            }

            // Fallback for 429 rate limits or 5xx errors
            if ((response.status === 429 || response.status >= 500) && mIdx < candidateModels.length - 1) {
              this.logger.warn(`Model ${currentModel} returned ${response.status}. Retrying with fallback model...`);
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }

            this.logger.error(`Groq completions call failed: ${response.status} - ${lastErrorText}`);
            throw new Error(`LLM Agent service unavailable (status ${response.status})`);
          }

          const completion = (await response.json()) as any;
          assistantMessage = completion.choices?.[0]?.message;
          if (assistantMessage) break;
        } catch (fetchErr: any) {
          if (mIdx === candidateModels.length - 1) {
            throw fetchErr;
          }
          this.logger.warn(`Error querying model ${currentModel}: ${fetchErr.message}. Trying fallback model...`);
        }
      }

      if (!assistantMessage) {
        throw new Error('LLM Agent returned an empty response');
      }

      const toolCalls = assistantMessage.tool_calls;

      // Case A: Model requested tool execution
      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        messages.push(assistantMessage);
        this.logger.log(
          `[TrainerAgentService] Model requested ${toolCalls.length} tool call(s): ${toolCalls.map((c: any) => c.function?.name).join(', ')}`,
        );

        for (const call of toolCalls) {
          const fnName = call.function?.name;
          let fnArgs: any = {};
          try {
            fnArgs = JSON.parse(call.function?.arguments || '{}');
          } catch (e) {
            this.logger.warn(`Failed to parse tool arguments for ${fnName}: ${(e as Error).message}`);
          }

          const toolStartMs = Date.now();
          this.logger.log(`[TrainerAgentService] Executing tool "${fnName}" with args: ${JSON.stringify(fnArgs)}`);

          let toolOutput: any;
          try {
            toolOutput = await this.dispatchTool(
              fnName,
              fnArgs,
              userContext,
              conversationId,
              activePathId,
              pendingAction,
              question,
            );

            // Capture action card if generated during curriculum actions
            if (toolOutput?._stagedActionCard) {
              stagedActionCard = toolOutput._stagedActionCard;
              delete toolOutput._stagedActionCard;
            }
            if (toolOutput?._upgradedLpId) {
              stagedUpgradedLpId = toolOutput._upgradedLpId;
              delete toolOutput._upgradedLpId;
            }

            const toolDurationMs = Date.now() - toolStartMs;
            this.logger.log(
              `[TrainerAgentService] Tool "${fnName}" completed in ${toolDurationMs}ms | Success: ${toolOutput?.success !== false}`,
            );
          } catch (dispatchErr: any) {
            const toolDurationMs = Date.now() - toolStartMs;
            this.logger.warn(`[TrainerAgentService] Tool "${fnName}" failed after ${toolDurationMs}ms: ${dispatchErr.message}`);
            toolOutput = {
              success: false,
              error: dispatchErr.message || 'An error occurred during tool execution',
            };
          }

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: fnName,
            content: JSON.stringify(toolOutput),
          });
        }

        // Continue loop to let the LLM synthesize the tool output
        continue;
      }

      // Case B: Model returned natural language answer without further tool calls
      finalAnswer = assistantMessage.content || '';
      break;
    }

    this.logger.log(
      `[TrainerAgentService] Completed processing in ${Date.now() - startTurnMs}ms across ${iteration} turn(s) | Output length: ${finalAnswer.length} chars`,
    );

    if (!finalAnswer && stagedActionCard) {
      if (stagedActionCard.type === 'create_lp') {
        finalAnswer = `I have researched and generated a complete curriculum for **"${stagedActionCard.lpTitle}"** with **${stagedActionCard.moduleCount} modules**, **${stagedActionCard.lessonCount} lessons**, and **${stagedActionCard.assignmentCount} assessments**.\n\n*This curriculum is currently saved as an AI draft.* Click **Preview in Studio** to review the structure or click **Confirm & Publish** when you are ready.`;
      } else if (stagedActionCard.type === 'confirm_crud') {
        finalAnswer = `**Proposed Curriculum Change: Confirmation Required**\n\n**Target Learning Path:** "${stagedActionCard.lpTitle}"\n**Proposed Operation:** ${stagedActionCard.summary}\n\nPlease click **Preview in Studio** to inspect nodes, **Confirm & Apply** to publish to your catalog, or **Delete/Cancel** to revert changes.`;
      }
    }

    return {
      answer: sanitizeAiResponse(finalAnswer),
      actionCard: stagedActionCard,
      upgradedLpId: stagedUpgradedLpId,
    };
  }

  /**
   * Resilient fallback parser for Groq 400 "tool_use_failed" failed_generation payloads.
   * Extracts function name and arguments even when XML tags contain formatting discrepancies.
   */
  private parseFailedGeneration(text: string): { name: string; args: Record<string, any> } | null {
    if (!text || typeof text !== 'string') return null;

    // Decode common XML entities if present
    const cleanText = text
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    // 1. Try to extract JSON if model generated a JSON block
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.name && (parsed.arguments || parsed.parameters)) {
          return {
            name: parsed.name,
            args: parsed.arguments || parsed.parameters || {},
          };
        }
      } catch { }
    }

    // 2. Extract function name:
    // Matches: <function=name>, <function name="name">, <function_call name="name">
    let fnName = '';
    const fnMatch = cleanText.match(/<function(?:_call)?(?:=|\s+name=)["']?([a-zA-Z0-9_]+)["']?>/i);
    if (fnMatch) {
      fnName = fnMatch[1];
    } else {
      const genericMatch = cleanText.match(
        /\b(create_learning_path|mutate_curriculum|query_database_learning_paths|query_database_trainees|query_database_trainers|query_database_enrollments|vector_search_curriculum|web_search|manage_pending_action)\b/,
      );
      if (genericMatch) {
        fnName = genericMatch[1];
      }
    }

    if (!fnName) return null;

    const args: Record<string, any> = {};

    // 3. Extract parameter tags:
    // Handles:
    // <parameter=title>val</parameter>
    // <parameter name="title">val</parameter>
    // < parameter name="title">val</parameter>
    // <arg name="title">val</arg>
    const paramRegex =
      /<\s*(?:parameter|arg)(?:[=\s]+(?:name=)?["']?([a-zA-Z0-9_]+)["']?)?>([\s\S]*?)<\/\s*(?:parameter|arg)>/gi;
    let match: RegExpExecArray | null;
    while ((match = paramRegex.exec(cleanText)) !== null) {
      const key = match[1]?.trim();
      let val: any = match[2]?.trim();
      if (key && val !== undefined) {
        if (!isNaN(val) && val !== '' && !val.includes('\n')) {
          val = Number(val);
        } else if (val.toLowerCase() === 'true') {
          val = true;
        } else if (val.toLowerCase() === 'false') {
          val = false;
        }
        args[key] = val;
      }
    }

    return { name: fnName, args };
  }

  /**
   * Tool Execution Dispatcher with Tier 2 Runtime Security Guards
   */
  private async dispatchTool(
    name: string,
    args: any,
    userContext: UserContext,
    conversationId: string,
    activePathId?: string | null,
    pendingAction?: AssistantActionEntity | null,
    originalQuestion?: string,
  ): Promise<any> {
    switch (name) {
      case 'query_database_learning_paths': {
        const queryArgs: GetLearningPathsArgs = {
          status: userContext.isTrainee ? 'active' : (args.status || 'all'),
          search: args.search?.trim(),
          difficulty: args.difficulty,
          limit: Math.max(Number(args.limit) || 50, 50),
          count_only: Boolean(args.count_only),
        };

        const result = await this.postgresMcpService.getLearningPaths(queryArgs);
        this.logger.log(
          `[TrainerAgent DB] query_database_learning_paths | Found ${result.learningPaths.length} paths (Total: ${result.totalCount}, Active: ${result.activeCount}, Draft: ${result.draftCount})`,
        );

        if (args.count_only) {
          return {
            totalCount: result.totalCount,
            activeCount: result.activeCount,
            draftCount: result.draftCount,
            difficultyBreakdown: result.difficultyBreakdown,
            summary: result.summary,
            learningPathsPreview: result.learningPaths.slice(0, 10).map((p) => ({
              title: p.title,
              status: p.status,
              difficulty: p.difficulty,
              modules: p.moduleCount,
              lessons: p.lessonCount,
            })),
          };
        }

        return {
          totalCount: result.totalCount,
          activeCount: result.activeCount,
          draftCount: result.draftCount,
          difficultyBreakdown: result.difficultyBreakdown,
          filterApplied: result.filterApplied,
          summary: result.summary,
          learningPaths: result.learningPaths,
        };
      }

      case 'query_database_trainees': {
        // Tier 2 Security: Trainees are strictly forbidden from querying database trainees
        if (userContext.isTrainee) {
          throw new ForbiddenException('Trainees are not authorized to query learner records from the database.');
        }

        const effectiveSearch = args.search?.trim() || undefined;
        const courseFilter = args.course_name_or_id?.trim() || undefined;
        const hasAssignedPaths = args.has_assigned_paths !== undefined ? Boolean(args.has_assigned_paths) : undefined;
        const assignedByTrainer = args.assigned_by_trainer?.trim() || undefined;

        const queryArgs: GetTraineesArgs = {
          status: args.status || 'all',
          search: effectiveSearch,
          course_name_or_id: courseFilter,
          has_assigned_paths: hasAssignedPaths,
          assigned_by_trainer: assignedByTrainer,
          limit: Math.max(Number(args.limit) || 50, 50),
        };

        const result = await this.postgresMcpService.getTraineeUsers(queryArgs);
        this.logger.log(
          `[TrainerAgent DB] query_database_trainees | CourseFilter: "${courseFilter || 'none'}", HasAssigned: ${hasAssignedPaths ?? 'all'} | Found ${result.trainees.length} trainees (Total: ${result.totalCount}, Active: ${result.activeCount})`,
        );

        if (args.count_only) {
          return {
            totalCount: result.totalCount,
            activeCount: result.activeCount,
            inactiveCount: result.inactiveCount,
            targetCourseTitle: result.targetCourseTitle,
            filterApplied: result.filterApplied,
            summary: result.summary,
            traineesPreview: result.trainees.slice(0, 10).map((t) => ({
              fullName: t.fullName,
              email: t.email,
              status: t.status,
              enrolledPathsCount: t.enrolledPathsCount,
            })),
          };
        }

        return {
          totalCount: result.totalCount,
          activeCount: result.activeCount,
          inactiveCount: result.inactiveCount,
          targetCourseTitle: result.targetCourseTitle,
          filterApplied: result.filterApplied,
          summary: result.summary,
          trainees: result.trainees.map((t) => ({
            fullName: t.fullName,
            email: t.email,
            status: t.status,
            enrolledPathsCount: t.enrolledPathsCount,
            enrolledCourses: t.enrolledCourses,
            streak: t.streak,
            joinedDate: t.joinedDate,
          })),
        };
      }

      case 'query_database_trainers': {
        // Tier 2 Security: Trainees are strictly forbidden from querying trainer administrative records
        if (userContext.isTrainee) {
          throw new ForbiddenException('Trainees are not authorized to query trainer administrative records.');
        }

        const queryArgs: GetTrainersArgs = {
          search: args.search?.trim(),
          limit: Math.max(Number(args.limit) || 50, 50),
        };

        const result = await this.postgresMcpService.getTrainerUsers(queryArgs);
        this.logger.log(
          `[TrainerAgent DB] query_database_trainers | Found ${result.trainers.length} trainers (Total: ${result.totalTrainers})`,
        );

        if (args.count_only) {
          return {
            totalTrainers: result.totalTrainers,
            activeTrainers: result.activeTrainers,
            summary: result.summary,
            filterApplied: result.filterApplied,
            trainersPreview: result.trainers.slice(0, 10).map((t) => ({
              fullName: t.fullName,
              email: t.email,
              role: t.role,
              authoredCoursesCount: t.authoredCoursesCount,
            })),
          };
        }

        return {
          totalTrainers: result.totalTrainers,
          activeTrainers: result.activeTrainers,
          summary: result.summary,
          filterApplied: result.filterApplied,
          trainers: result.trainers,
        };
      }

      case 'query_trainee_progress': {
        // Tier 2 Security: Trainees are strictly forbidden from querying trainee progress records
        if (userContext.isTrainee) {
          throw new ForbiddenException('Trainees cannot query student progress records.');
        }

        const traineeQuery = args.trainee_name_or_email?.trim();
        const courseQuery = args.course_name_or_id?.trim() || undefined;

        if (!traineeQuery) {
          return {
            success: false,
            error: 'Please specify the trainee name or email to retrieve progress details.',
          };
        }

        const result = await this.postgresMcpService.getTraineeProgress({
          trainee_name_or_email: traineeQuery,
          course_name_or_id: courseQuery,
        });

        this.logger.log(
          `[TrainerAgent DB] query_trainee_progress | Trainee: "${result.traineeName}", Course: "${courseQuery || 'all'}" | Found ${result.courses.length} course(s)`,
        );

        return result;
      }

      case 'query_database_enrollments': {
        // Tier 2 Security: Trainees are strictly forbidden from querying platform enrollment registries
        if (userContext.isTrainee) {
          throw new ForbiddenException('Trainees cannot query platform enrollment registries.');
        }

        const effectiveCourse = args.course_title?.trim() || undefined;
        const queryArgs: GetEnrollmentsArgs = {
          course_title: effectiveCourse,
          trainee_search: args.trainee_search?.trim() || undefined,
          trainer_search: args.trainer_search?.trim() || undefined,
          status: args.status || 'all',
          limit: Math.max(Number(args.limit) || 50, 50),
        };

        const result = await this.postgresMcpService.getEnrollmentRecords(queryArgs);
        this.logger.log(
          `[TrainerAgent DB] query_database_enrollments | Filter Course: "${effectiveCourse || 'none'}" | Found ${result.enrollments.length} enrollments (Unique Trainees: ${result.uniqueTraineesCount})`,
        );

        if (args.count_only) {
          return {
            totalEnrollments: result.totalEnrollments,
            uniqueTraineesCount: result.uniqueTraineesCount,
            uniqueCoursesCount: result.uniqueCoursesCount,
            summary: result.summary,
            filterApplied: result.filterApplied,
            enrollmentsPreview: result.enrollments.slice(0, 10).map((e) => ({
              trainee: e.traineeName,
              course: e.courseTitle,
              assignedBy: e.assignedByName,
              status: e.status,
            })),
          };
        }

        return {
          totalEnrollments: result.totalEnrollments,
          uniqueTraineesCount: result.uniqueTraineesCount,
          uniqueCoursesCount: result.uniqueCoursesCount,
          summary: result.summary,
          filterApplied: result.filterApplied,
          enrollments: result.enrollments,
        };
      }

      case 'create_learning_path': {
        // Tier 2 Security: Trainees cannot author learning paths
        if (userContext.isTrainee) {
          throw new ForbiddenException('Trainees do not have permission to author learning paths.');
        }

        let rawTitle = (args.title || args.prompt || originalQuestion || 'New Learning Path').trim();

        if (!rawTitle) rawTitle = 'Advanced Curriculum';

        const genResult = await this.generationService.generateLearningPath(
          rawTitle,
          userContext.userId,
          conversationId,
        );
        this.logger.log(
          `[TrainerAgent Studio] create_learning_path | Created AI draft "${genResult.learningPath.title}" (${genResult.learningPath.id}) with ${genResult.moduleCount} modules, ${genResult.lessonCount} lessons`,
        );

        const actionCard = {
          actionId: genResult.action.id,
          type: 'create_lp',
          lpId: genResult.learningPath.id,
          lpTitle: genResult.learningPath.title,
          moduleCount: genResult.moduleCount,
          lessonCount: genResult.lessonCount,
          assignmentCount: genResult.assignmentCount,
          status: 'pending',
        };

        return {
          success: true,
          lpId: genResult.learningPath.id,
          lpTitle: genResult.learningPath.title,
          moduleCount: genResult.moduleCount,
          lessonCount: genResult.lessonCount,
          assignmentCount: genResult.assignmentCount,
          status: 'pending_confirmation',
          _stagedActionCard: actionCard,
        };
      }

      case 'mutate_curriculum': {
        // Tier 2 Security: Trainees cannot modify curriculum
        if (userContext.isTrainee) {
          throw new ForbiddenException('Trainees do not have permission to modify learning paths.');
        }

        const instruction = args.instruction || originalQuestion || '';
        const targetLp = await this.resolveTargetLearningPath(
          userContext.userId,
          args.lpId,
          args.lpTitle,
          activePathId,
          pendingAction,
          instruction,
        );

        if (!targetLp) {
          return {
            success: false,
            error:
              'Unable to identify target Learning Path to modify. Please explicitly specify the course title or select it in Curriculum Studio.',
          };
        }

        // CRITICAL OWNERSHIP VERIFICATION:
        // Trainer can ONLY mutate a course if they are its creator / owner, or if Admin!
        const ownerId = targetLp.createdBy?.id || (targetLp as any)?.createdById || (targetLp as any)?.createdBy;
        const ownerName = targetLp.createdBy?.firstName
          ? `${targetLp.createdBy.firstName} ${targetLp.createdBy.lastName || ''}`.trim()
          : (targetLp.createdBy?.email || 'another instructor');
        const isOwner =
          Boolean(ownerId && String(ownerId).toLowerCase() === String(userContext.userId).toLowerCase()) ||
          userContext.isAdmin;

        if (!isOwner) {
          this.logger.warn(
            `[TrainerAgent Ownership] Denied mutation on "${targetLp.title}" (${targetLp.id}) for trainer ${userContext.userId}. Course owned by ${ownerName}.`,
          );
          return {
            success: false,
            error: `Access Denied: Learning Path Ownership Required. You cannot modify or delete curriculum in "${targetLp.title}" because you are not its designated owner (authored by ${ownerName}). Under LMS governance policy, a trainer may only modify courses they authored. Please contact ${ownerName} or an Administrator to request changes.`,
          };
        }

        this.logger.log(
          `[TrainerAgent Ownership] Verified ownership for trainer ${userContext.userId} on "${targetLp.title}". Proceeding with mutation.`,
        );

        // Summarize operation and prepare rollback snapshot
        const crudSummary = args.summary?.trim() || summarizeCrudOperation(instruction).summary;
        const operationType = args.operationType || summarizeCrudOperation(instruction).operationType;
        const previousTree = serializeLpToAuthoringPayload(targetLp);

        // Execute structural upgrade
        const upgradeRes = await this.upgradeService.upgradeLearningPath(
          targetLp.id,
          instruction,
          userContext.userId,
        );

        // Stage pending action entity with 2-hour expiration window
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const action = this.actionRepo.create({
          trainerId: userContext.userId,
          actionType: 'confirm_crud',
          targetId: targetLp.id,
          status: 'pending',
          payload: {
            conversationId,
            lpId: targetLp.id,
            lpTitle: targetLp.title,
            instruction,
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
        this.logger.log(
          `[TrainerAgent Studio] mutate_curriculum | Staged "${crudSummary}" on "${targetLp.title}" (Action: ${savedAction.id}) -> ${upgradeRes.moduleCount} modules, ${upgradeRes.lessonCount} lessons`,
        );

        const actionCard = {
          actionId: savedAction.id,
          actionType: 'confirm_crud',
          type: 'confirm_crud',
          lpId: targetLp.id,
          lpTitle: targetLp.title,
          moduleCount: upgradeRes.moduleCount,
          lessonCount: upgradeRes.lessonCount,
          assignmentCount: upgradeRes.assignmentCount,
          operationType,
          summary: crudSummary,
          status: 'pending',
        };

        return {
          success: true,
          lpId: targetLp.id,
          lpTitle: targetLp.title,
          operation: crudSummary,
          moduleCount: upgradeRes.moduleCount,
          lessonCount: upgradeRes.lessonCount,
          assignmentCount: upgradeRes.assignmentCount,
          status: 'pending_confirmation',
          _stagedActionCard: actionCard,
          _upgradedLpId: targetLp.id,
        };
      }

      case 'vector_search_curriculum': {
        const query = args.query || originalQuestion || '';
        const searchLpId = args.lpId || activePathId;

        // Perform semantic / structural search over learning paths
        const results = await this.searchCurriculumContent(query, searchLpId);
        this.logger.log(
          `[TrainerAgent Search] vector_search_curriculum | Query: "${query.substring(0, 50)}" | lpId: ${searchLpId || 'catalog'} | Hits: ${results.chunks?.length || 0}`,
        );
        return results;
      }

      case 'web_search': {
        const query = args.query || originalQuestion || '';
        const topic = args.topic || 'general';
        const webResults = await executeWebSearch(query, topic);
        this.logger.log(
          `[TrainerAgent WebSearch] web_search | Query: "${query.substring(0, 50)}" | Topic: ${topic} | Hits: ${webResults.length}`,
        );
        return {
          query,
          resultsCount: webResults.length,
          results: webResults,
        };
      }

      case 'manage_pending_action': {
        if (userContext.isTrainee) {
          throw new ForbiddenException('Trainees cannot manage staged actions.');
        }

        if (!pendingAction) {
          return {
            success: false,
            message: 'There is no pending Learning Path draft waiting for confirmation in this conversation.',
          };
        }

        this.logger.log(
          `[TrainerAgent Action] manage_pending_action | Action: "${args.action}" on draft action ${pendingAction.id}`,
        );

        if (args.action === 'confirm') {
          const res = await this.actionService.confirmAction(
            userContext.userId,
            pendingAction.id,
            userContext.currentUser,
          );
          return {
            success: true,
            action: 'confirmed',
            message: res.message,
            lpId: pendingAction.targetId,
            _upgradedLpId: pendingAction.targetId,
          };
        } else if (args.action === 'cancel') {
          const res = await this.actionService.cancelAction(userContext.userId, pendingAction.id);
          return {
            success: true,
            action: 'cancelled',
            message: res.message,
          };
        }

        return { success: false, message: 'Invalid action specified. Must be confirm or cancel.' };
      }

      default:
        return { error: `Tool "${name}" is not recognized.` };
    }
  }

  /**
   * Helper to resolve target Learning Path for modifications
   */
  private async resolveTargetLearningPath(
    trainerId: string,
    lpId?: string,
    lpTitle?: string,
    activePathId?: string | null,
    pendingAction?: AssistantActionEntity | null,
    instruction: string = '',
  ): Promise<LearningPathEntity | null> {
    const forbiddenStatuses = ['deleted', 'archived'];

    // Load candidate courses first so we can check both lpTitle and instruction references
    const allCandidateLps = await this.lpRepo.find({
      relations: ['createdBy'],
      where: { status: Not(In(forbiddenStatuses)) },
      select: ['id', 'title', 'status', 'updatedAt'],
      order: { updatedAt: 'DESC' },
      take: 50,
    });

    const pendingCourseTitle = (pendingAction?.payload?.lpTitle || pendingAction?.payload?.title || '').toLowerCase().trim();
    const referencedInInstruction = findReferencedLp(instruction, allCandidateLps);

    // Check if user explicitly asked for a different course by name (either in lpTitle OR in the instruction)
    let explicitDifferentTitle = false;
    if (pendingCourseTitle) {
      if (lpTitle) {
        const titleLower = lpTitle.toLowerCase().trim();
        if (titleLower !== pendingCourseTitle && !pendingCourseTitle.includes(titleLower)) {
          explicitDifferentTitle = true;
        }
      }
      if (referencedInInstruction && referencedInInstruction.title.toLowerCase().trim() !== pendingCourseTitle) {
        explicitDifferentTitle = true;
      }
    }

    // Priority 1: If an explicit valid UUID LP ID was provided, search by ID
    if (isValidUuid(lpId)) {
      const found = await this.lpRepo.findOne({
        where: { id: lpId!.trim() },
        relations: [
          'createdBy',
          'modules',
          'modules.lessons',
          'modules.lessons.resources',
          'modules.assignments',
        ],
      });
      if (found) return found;
    } else if (lpId) {
      this.logger.warn(`resolveTargetLearningPath: Received non-UUID lpId "${lpId}". Falling back to contextual resolution.`);
    }

    // Priority 2: If an active pending draft exists and user is modifying current course context
    if (pendingAction?.targetId && isValidUuid(pendingAction.targetId) && !explicitDifferentTitle) {
      const found = await this.lpRepo.findOne({
        where: { id: pendingAction.targetId },
        relations: [
          'createdBy',
          'modules',
          'modules.lessons',
          'modules.lessons.resources',
          'modules.assignments',
        ],
      });
      if (found) return found;
    }

    // Priority 3: Fall back to activePathId (e.g. open in Curriculum Studio)
    if (activePathId && isValidUuid(activePathId) && !explicitDifferentTitle) {
      const found = await this.lpRepo.findOne({
        where: { id: activePathId },
        relations: [
          'createdBy',
          'modules',
          'modules.lessons',
          'modules.lessons.resources',
          'modules.assignments',
        ],
      });
      if (found) return found;
    }

    // Priority 4: Try matching by explicit title
    if (lpTitle) {
      const titleLower = lpTitle.toLowerCase().trim();
      const matched = allCandidateLps.find(
        (p) => p.title.toLowerCase() === titleLower || p.title.toLowerCase().includes(titleLower),
      );
      if (matched) {
        return this.lpRepo.findOne({
          where: { id: matched.id },
          relations: [
            'createdBy',
            'modules',
            'modules.lessons',
            'modules.lessons.resources',
            'modules.assignments',
          ],
        });
      }
    }

    // Priority 5: Match referenced LP from instruction
    const matchedByText = referencedInInstruction || findReferencedLp(instruction, allCandidateLps);
    if (matchedByText) {
      return this.lpRepo.findOne({
        where: { id: matchedByText.id },
        relations: [
          'createdBy',
          'modules',
          'modules.lessons',
          'modules.lessons.resources',
          'modules.assignments',
        ],
      });
    }

    // Priority 6: Fall back to trainer's most recent course
    const trainerRecent = await this.lpRepo.findOne({
      relations: [
        'createdBy',
        'modules',
        'modules.lessons',
        'modules.lessons.resources',
        'modules.assignments',
      ],
      where: { createdBy: { id: trainerId }, status: Not(In(forbiddenStatuses)) },
      order: { updatedAt: 'DESC' },
    });

    return trainerRecent || null;
  }

  /**
   * Helper to perform curriculum content search
   */
  private async searchCurriculumContent(query: string, lpId?: string | null): Promise<any> {
    try {
      const qb = this.lpRepo
        .createQueryBuilder('lp')
        .leftJoinAndSelect('lp.modules', 'm')
        .leftJoinAndSelect('m.lessons', 'l')
        .leftJoinAndSelect('l.resources', 'r')
        .leftJoinAndSelect('m.assignments', 'a')
        .where('lp.status NOT IN (:...forbidden)', { forbidden: ['deleted', 'archived'] });

      if (lpId && isValidUuid(lpId)) {
        qb.andWhere('lp.id = :lpId', { lpId });
      }

      const paths = await qb.take(10).getMany();
      const qLower = query.toLowerCase();

      const matchedResults: any[] = [];
      for (const p of paths) {
        const matchesInPath: string[] = [];
        if (p.title.toLowerCase().includes(qLower) || (p.description || '').toLowerCase().includes(qLower)) {
          matchesInPath.push(`Path Overview: ${p.title} (${p.description?.substring(0, 100)}...)`);
        }

        for (const m of p.modules || []) {
          if (m.title.toLowerCase().includes(qLower) || (m.description || '').toLowerCase().includes(qLower)) {
            matchesInPath.push(`Module: ${m.title}`);
          }
          for (const l of m.lessons || []) {
            if (l.title.toLowerCase().includes(qLower) || (l.description || '').toLowerCase().includes(qLower)) {
              matchesInPath.push(`Lesson: ${l.title}`);
            }
          }
        }

        if (matchesInPath.length > 0) {
          matchedResults.push({
            lpId: p.id,
            lpTitle: p.title,
            level: p.difficulty,
            matches: matchesInPath,
          });
        }
      }

      return {
        query,
        count: matchedResults.length,
        paths: matchedResults,
      };
    } catch (e) {
      this.logger.warn(`searchCurriculumContent failed: ${(e as Error).message}`);
      return { query, count: 0, paths: [] };
    }
  }

  /**
   * User context resolution from JWT / req.user
   */
  private resolveUserContext(trainerId: string, currentUser?: any): UserContext {
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

    // Default to 'trainer' if accessed via trainer assistant endpoint
    if (roles.length === 0) roles.push('trainer');

    const isAdmin = roles.includes('admin');
    const isTrainer = roles.includes('trainer') || isAdmin;
    const isTrainee = roles.includes('trainee') && !isTrainer && !isAdmin;

    const role = isAdmin ? 'Admin' : (isTrainer ? 'Trainer' : 'Trainee');

    return {
      userId: trainerId,
      role,
      roles,
      isAdmin,
      isTrainer,
      isTrainee,
      currentUser,
    };
  }

  /**
   * System Prompt Construction for Autonomous Tool Agent
   */
  private buildSystemPrompt(
    userContext: UserContext,
    pendingAction?: AssistantActionEntity | null,
    activePathId?: string | null,
  ): string {
    const roleInstructions = userContext.isAdmin
      ? 'You have Administrator privileges with full access to all system records, trainees, and courses.'
      : userContext.isTrainer
        ? 'You are acting as an instructional designer and trainer. You have access to database trainee records and course authoring tools. Note: You can ONLY mutate or update learning paths that YOU created (ownership enforced).'
        : 'You are an academic learning assistant for trainees. You can answer conceptual questions, search assigned curriculum, and find technical documentation.';

    let pendingActionContext = '';
    if (pendingAction) {
      const p = pendingAction.payload || {};
      const courseTitle = p.lpTitle || p.title || 'Untitled Course';
      pendingActionContext = `\nACTIVE PENDING DRAFT IN CONVERSATION:
- Target Course: "${courseTitle}" (ID: ${pendingAction.targetId})
- Status: Staged AI draft waiting for trainer review or publication.
- FULL CRUD SUPPORT ON DRAFTS: The trainer CAN modify, add, or delete modules, lessons, assignments, or questions in this draft BEFORE confirming or publishing!
  * If the user asks to modify, delete, remove, or add anything in this course (e.g. "delete module 3", "remove lesson 2", "add a quiz to module 1", "only keep 2 modules"):
    DO NOT refuse! DO NOT say drafts cannot be edited or that they must confirm/publish first!
    IMMEDIATELY invoke the "mutate_curriculum" tool with instruction (e.g. instruction: "Delete Module 3 and keep remaining modules").
  * If the user says "confirm", "publish", "apply", "cancel", "discard", or "revert", invoke the manage_pending_action tool.\n`;
    }

    let studioContext = '';
    if (activePathId) {
      studioContext = `\nACTIVE STUDIO COURSE CONTEXT: The user is currently viewing Learning Path ID: ${activePathId}.\n`;
    }

    return `You are the Senior Curriculum Architect & Autonomous LMS Intelligence Agent for SkillForge LMS.
${roleInstructions}
${pendingActionContext}${studioContext}
CORE INSTRUCTIONS FOR AUTONOMOUS TOOL CALLING:
1. NATIVE TOOL USAGE: Do not guess or hallucinate database records or curriculum structures. Autonomously choose the appropriate tool from your registered tool set:
   - To count, list, filter, search, or inspect Learning Paths / courses in PostgreSQL (e.g. "how many total learning paths exist", "count courses", "list learning paths with their names"): call "query_database_learning_paths".
   - To query registered trainees, students, or learners (e.g. "how many trainees in database", "how many trainees enrolled in Machine Learning", "how many trainees have Learning Path Assigned by the trainer"): call "query_database_trainees".
     * If asking for trainees enrolled in a specific course (e.g. "how many trainee enrolled in Machine Learning path"), pass course_name_or_id: "Machine Learning".
     * If asking for trainees who have courses assigned (e.g. "how many trainee have Learning Path Assigned by the trainer"), pass has_assigned_paths: true.
   - To query trainers, instructors, or admins (e.g. "who are the trainers", "list all trainers", "how many trainers exist in the system", "which trainer created course X"): call "query_database_trainers".
   - To inspect a trainee's progress, progress percentage, completed lessons, or submitted assignments in a specific Learning Path or across courses (e.g. '"Revaa Kub" progress on this LP their name is "DevOps Engineering"', 'What is Revaa\'s progress percentage?'): ALWAYS call "query_trainee_progress" with trainee_name_or_email and course_name_or_id.
   - To query student-course enrollments, course assignment links, or who assigned what course to whom: call "query_database_enrollments".
   - To create a new course/learning path from scratch: call "create_learning_path".
   - To add, remove, delete, or modify modules, lessons, assignments, questions, or resources in an existing course OR active draft: call "mutate_curriculum".
   - To search internal curriculum concepts or lessons: call "vector_search_curriculum".
   - To find external documentation, tech tutorials, or YouTube videos: call "web_search".
   - To confirm or cancel pending staged drafts: call "manage_pending_action".
   - When calling mutate_curriculum, DO NOT invent or truncate random UUIDs for lpId. If the exact UUID is not known, pass lpTitle or leave lpId omitted.
   - Always supply tool arguments as standard properties without custom HTML attributes or pseudo-tags.
2. PRESENTATION & QUALITY: Format responses in clear, professional GitHub-flavored markdown. Use structured bullet points, numbered lists, and bold headers. NEVER output markdown tables with pipe (|) delimiters; ALWAYS format counts, metrics, and lists using clean bullet points (- ) and bold labels (e.g. '- **Total Trainees**: 14', '- **Active Trainees**: 13').
   - ZERO DATABASE INTERNAL IDS: NEVER output raw database internal UUIDs (e.g., 'Enrollment ID: 4d1e93ac-...', 'Course ID: ...', 'User ID: ...') in your answers to trainers. Database internal IDs are strictly forbidden in responses. Use human-readable names: Trainee Name, Email, Course Title, Progress Percentage, and Module Names.
   - TRAINEE PROGRESS REPORT FORMAT: When presenting trainee progress:
     * Header with Trainee Name and Course Title.
     * Highlight **Overall Progress: X% (Completed / In Progress / Not Started)**.
     * State Completed Lessons (e.g. '6 / 6 Lessons Completed') and Submitted Tasks/Assessments (e.g. '3 / 3 Assessments Submitted').
     * Present the module-by-module breakdown with individual module progress percentages, lessons completed, and tasks submitted.
3. ACCESS & OWNERSHIP ENFORCEMENT:
   - If mutate_curriculum returns an error stating "Access Denied: Learning Path Ownership Required" or that the user is not the owner:
     * Firmly and politely explain to the user that their request was DENIED because they are not the designated owner/author of the Learning Path.
     * State who the course author is and remind them that under LMS governance policies, trainers are only permitted to edit, upgrade, or delete courses they authored.
     * Advise the user to contact the course owner or an Administrator if updates are needed.
     * DO NOT generate or display any action card (do not provide "Confirm & Apply" buttons).
     * NEVER state or claim that the deletion or modification succeeded.
4. NATURAL CONVERSATION: If the user is just greeting or asking general questions, respond directly and helpfully without invoking tools unnecessarily.`;
  }
}

