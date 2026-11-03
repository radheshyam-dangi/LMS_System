import { Injectable, Logger } from '@nestjs/common';
import { sanitizeTrainerQuery } from './trainerAiSanitizer';
import { McpBridgeService } from '../../../mcp/mcp-bridge.service';

export type TrainerIntent =
  | 'qa'
  | 'create_lp'
  | 'upgrade_lp'
  | 'confirm'
  | 'cancel'
  | 'trainee_query'
  | 'other';

/**
 * Structured parameters for trainee directory & database queries
 */
export interface TraineeIntentParams {
  status: 'all' | 'active' | 'inactive';
  search?: string;
  limit: number;
  isCountOnly: boolean;
}

/**
 * Structured parameters for curriculum authoring & editor mutations
 */
export interface CurriculumIntentParams {
  operationType: 'create' | 'update' | 'delete' | 'read';
  targetNode?: 'course' | 'module' | 'lesson' | 'assignment' | 'resource' | 'assessment';
  targetNodeIndex?: number;
  targetTitle?: string;
  rawInstruction?: string;
}

/**
 * Structured categorization for pedagogical and course Q&A
 */
export interface QaIntentParams {
  category:
    | 'catalog_overview'
    | 'course_structure'
    | 'pedagogy'
    | 'prerequisites'
    | 'assessment_guidance'
    | 'general';
  detectedTopic?: string;
}

/**
 * Extracted semantic entities across all trainer intents
 */
export interface ClassifiedIntentEntities {
  role?: string;
  targetLpTitle?: string;
  nodeType?: string;
  nodeIndex?: number;
  statusFilter?: string;
  searchKeyword?: string;
  topic?: string;
  confirmationStatus?: 'confirmed' | 'cancelled';
}

/**
 * Comprehensive classified intent returned to assistant orchestrators
 */
export interface ClassifiedIntent {
  intent: TrainerIntent;
  confidence: number;
  title?: string;
  sanitizedQuery?: string;

  // Architectural additions (100% backward-compatible, non-breaking)
  secondaryIntent?: TrainerIntent;
  traineeParams?: TraineeIntentParams;
  curriculumParams?: CurriculumIntentParams;
  qaParams?: QaIntentParams;
  entities?: ClassifiedIntentEntities;
  isStudioContext?: boolean;
  requiresConfirmation?: boolean;
}

@Injectable()
export class TrainerAiIntentService {
  private readonly logger = new Logger(TrainerAiIntentService.name);

  constructor(private readonly mcpBridgeService: McpBridgeService) {}

  /**
   * Fast, contextual, multi-parameter intent classification for Trainer AI Assistant.
   * Analyzes semantic intent, extracts entity parameters, and maintains multi-turn context continuity.
   */
  async classify(
    message: string,
    hasPendingAction: boolean,
    hasActiveLp: boolean = false,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  ): Promise<ClassifiedIntent> {
    const { cleanQuery, normalizedQuery, hasAdvisoryIntent, hasDirectMutationIntent } =
      sanitizeTrainerQuery(message);
    const lower = normalizedQuery;

    // ─────────────────────────────────────────────────────────
    // 1. Pending Action Resolution (Highest Priority State Guard)
    // ─────────────────────────────────────────────────────────
    if (hasPendingAction) {
      if (/^(confirm|yes|publish|proceed|create\s+it|approve|sure|ok|do\s+it|go\s+ahead)\b/i.test(lower)) {
        return {
          intent: 'confirm',
          confidence: 0.99,
          sanitizedQuery: cleanQuery,
          requiresConfirmation: false,
          entities: { confirmationStatus: 'confirmed' },
        };
      }
      if (/^(cancel|no|discard|abort|reject|stop|don't|dont)\b/i.test(lower)) {
        return {
          intent: 'cancel',
          confidence: 0.99,
          sanitizedQuery: cleanQuery,
          requiresConfirmation: false,
          entities: { confirmationStatus: 'cancelled' },
        };
      }
    }

    // ─────────────────────────────────────────────────────────
    // 2. Trainee Database Inquiry Intent (FastMCP Postgres Tool)
    // ─────────────────────────────────────────────────────────
    const isDirectTraineeInquiry = this.mcpBridgeService.isTraineeInquiry(cleanQuery);
    const isContextualTraineeFollowUp = this.isFollowUpTraineeQuery(lower, history);

    if (isDirectTraineeInquiry || isContextualTraineeFollowUp) {
      const traineeParams = this.mcpBridgeService.extractTraineeQueryParams(cleanQuery);
      return {
        intent: 'trainee_query',
        confidence: isDirectTraineeInquiry ? 0.99 : 0.92,
        sanitizedQuery: cleanQuery,
        traineeParams,
        entities: {
          role: 'Trainee',
          statusFilter: traineeParams.status,
          searchKeyword: traineeParams.search,
        },
      };
    }

    // ─────────────────────────────────────────────────────────
    // 3. Explicit Create LP / Curriculum Intent
    // ─────────────────────────────────────────────────────────
    const createCurriculumRegex =
      /^(?:please\s+)?(?:create|generate|build|start|make|design|roadmap|develop|draft|outline|prepare)\s+(?:a\s+|an\s+|the\s+)?(?:new\s+)?(?:brand\s+new\s+)?(?:lp|learning\s+path|course|curriculum|syllabus|training\s+program|bootcamp)\s*(?:titled|named|called|for|on|about|of|:)\s*["'“”]?([^"'“”\n\r]+)["'“”]?/i;
    const createMatch = cleanQuery.match(createCurriculumRegex);
    if (createMatch && createMatch[1]?.trim().length > 1) {
      let title = createMatch[1].trim().replace(/^[:\-\s]+|[:\-\s]+$/g, '');
      title = title.replace(/^(?:of|for|on|about)\s+/i, '').trim();
      return {
        intent: 'create_lp',
        title,
        confidence: 0.98,
        sanitizedQuery: cleanQuery,
        curriculumParams: {
          operationType: 'create',
          targetNode: 'course',
          targetTitle: title,
          rawInstruction: cleanQuery,
        },
        entities: {
          nodeType: 'course',
          targetLpTitle: title,
        },
        requiresConfirmation: true,
      };
    }

    // Direct "Create LP: Title", "Generate LP: Title", "Draft Course: Title"
    const directLpMatch = cleanQuery.match(
      /^(?:create|generate|build|start|make|draft|develop)\s+(?:a\s+|an\s+|the\s+)?(?:lp|learning\s+path|course|curriculum|syllabus)\s*[:\-]\s*(.+)/i,
    );
    if (directLpMatch && directLpMatch[1]?.trim().length > 1) {
      const title = directLpMatch[1].trim();
      return {
        intent: 'create_lp',
        title,
        confidence: 0.98,
        sanitizedQuery: cleanQuery,
        curriculumParams: {
          operationType: 'create',
          targetNode: 'course',
          targetTitle: title,
          rawInstruction: cleanQuery,
        },
        entities: {
          nodeType: 'course',
          targetLpTitle: title,
        },
        requiresConfirmation: true,
      };
    }

    // Direct "Create/Generate [Topic] Curriculum/Course/Learning Path" (e.g. "Create DevOps curriculum")
    const topicCurriculumMatch = cleanQuery.match(
      /^(?:please\s+)?(?:create|generate|build|start|make|design|prepare|draft)\s+(?:a\s+|an\s+|the\s+)?(?:new\s+)?(.+?)\s+(?:curriculum|learning\s+path|course|syllabus|training\s+program)$/i,
    );
    if (topicCurriculumMatch && topicCurriculumMatch[1]?.trim().length > 1) {
      const title = topicCurriculumMatch[1].trim();
      return {
        intent: 'create_lp',
        title,
        confidence: 0.96,
        sanitizedQuery: cleanQuery,
        curriculumParams: {
          operationType: 'create',
          targetNode: 'course',
          targetTitle: title,
          rawInstruction: cleanQuery,
        },
        entities: {
          nodeType: 'course',
          targetLpTitle: title,
        },
        requiresConfirmation: true,
      };
    }

    // ─────────────────────────────────────────────────────────
    // 4. Consultative / Pedagogical / Advisory Inquiries (QA)
    // ─────────────────────────────────────────────────────────
    if (hasAdvisoryIntent && !hasDirectMutationIntent) {
      const qaParams = this.extractQaParams(lower, cleanQuery);
      return {
        intent: 'qa',
        confidence: 0.96,
        sanitizedQuery: cleanQuery,
        qaParams,
        isStudioContext: hasActiveLp,
      };
    }

    // ─────────────────────────────────────────────────────────
    // 5. Active LP Context (Curriculum Studio / Visual Canvas)
    // ─────────────────────────────────────────────────────────
    if (hasActiveLp) {
      const nodeCommandMatch = this.detectNodeMutation(lower);

      if (hasDirectMutationIntent || nodeCommandMatch.isNodeCommand) {
        return {
          intent: 'upgrade_lp',
          confidence: hasDirectMutationIntent ? 0.98 : 0.92,
          sanitizedQuery: cleanQuery,
          curriculumParams: {
            operationType: nodeCommandMatch.operationType,
            targetNode: nodeCommandMatch.targetNode,
            targetNodeIndex: nodeCommandMatch.nodeIndex,
            rawInstruction: cleanQuery,
          },
          entities: {
            nodeType: nodeCommandMatch.targetNode,
            nodeIndex: nodeCommandMatch.nodeIndex,
          },
          isStudioContext: true,
          requiresConfirmation: true,
        };
      }

      // Any other query while in Studio is consultative Studio QA
      const qaParams = this.extractQaParams(lower, cleanQuery);
      return {
        intent: 'qa',
        confidence: 0.92,
        sanitizedQuery: cleanQuery,
        qaParams,
        isStudioContext: true,
      };
    }

    // ─────────────────────────────────────────────────────────
    // 6. Outside Studio (Global Catalog View Mutation Attempt)
    // ─────────────────────────────────────────────────────────
    if (hasDirectMutationIntent) {
      const nodeCommandMatch = this.detectNodeMutation(lower);
      return {
        intent: 'upgrade_lp',
        confidence: 0.88,
        sanitizedQuery: cleanQuery,
        curriculumParams: {
          operationType: nodeCommandMatch.operationType,
          targetNode: nodeCommandMatch.targetNode,
          targetNodeIndex: nodeCommandMatch.nodeIndex,
          rawInstruction: cleanQuery,
        },
        entities: {
          nodeType: nodeCommandMatch.targetNode,
          nodeIndex: nodeCommandMatch.nodeIndex,
        },
        isStudioContext: false,
        requiresConfirmation: false,
      };
    }

    // ─────────────────────────────────────────────────────────
    // 7. Default to Q&A with Categorized Parameters
    // ─────────────────────────────────────────────────────────
    const defaultQaParams = this.extractQaParams(lower, cleanQuery);
    return {
      intent: 'qa',
      confidence: 0.9,
      sanitizedQuery: cleanQuery,
      qaParams: defaultQaParams,
      isStudioContext: hasActiveLp,
    };
  }

  /**
   * Detects multi-turn conversational follow-ups targeting trainee information
   * (e.g. user previously asked for trainees, now asks: "What about inactive ones?" or "How many are there?")
   */
  private isFollowUpTraineeQuery(
    lower: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): boolean {
    if (history.length === 0) return false;

    // Check if the immediately preceding context was about trainees
    const recentHistory = history.slice(-2);
    const wasRecentTraineeContext = recentHistory.some((m) =>
      /\b(?:trainee|trainees|student|students|learner|learners|roster|enrolled\s+user)\b/i.test(m.content),
    );

    if (!wasRecentTraineeContext) return false;

    // Look for follow-up inquiry markers
    const followUpPatterns = [
      /\b(?:what\s+about|show\s+me|how\s+about)\s+(?:the\s+)?(?:inactive|active|others|rest|remaining)\b/i,
      /\b(?:how\s+many|what\s+is\s+the\s+count|total\s+count)\b/i,
      /\b(?:give\s+me|show)\s+(?:their|the)\s+(?:emails?|names?|status|progress)\b/i,
      /\b(?:only\s+active|only\s+inactive)\b/i,
      /\b(?:are\s+there\s+any\s+more|anyone\s+else)\b/i,
    ];

    return followUpPatterns.some((pattern) => pattern.test(lower));
  }

  /**
   * Extracts structural node mutations and target indices for curriculum operations
   */
  private detectNodeMutation(lower: string): {
    isNodeCommand: boolean;
    operationType: 'create' | 'update' | 'delete';
    targetNode?: 'course' | 'module' | 'lesson' | 'assignment' | 'resource' | 'assessment';
    nodeIndex?: number;
  } {
    // Detect operation type
    let operationType: 'create' | 'update' | 'delete' = 'update';
    if (/\b(?:delete|remove|drop|discard|erase|trash)\b/i.test(lower)) {
      operationType = 'delete';
    } else if (/\b(?:add|insert|append|attach|embed|put|create|new)\b/i.test(lower)) {
      operationType = 'create';
    }

    // Detect target node
    let targetNode: 'course' | 'module' | 'lesson' | 'assignment' | 'resource' | 'assessment' | undefined;
    if (/\b(?:lesson|lecture|topic|unit)\b/i.test(lower)) {
      targetNode = 'lesson';
    } else if (/\b(?:module|chapter|section)\b/i.test(lower)) {
      targetNode = 'module';
    } else if (/\b(?:assignment|task|homework|project)\b/i.test(lower)) {
      targetNode = 'assignment';
    } else if (/\b(?:quiz|assessment|test|exam)\b/i.test(lower)) {
      targetNode = 'assessment';
    } else if (/\b(?:resource|link|video|document|doc)\b/i.test(lower)) {
      targetNode = 'resource';
    } else if (/\b(?:course|curriculum|learning\s+path|syllabus)\b/i.test(lower)) {
      targetNode = 'course';
    }

    // Detect node index (e.g. "Module 2", "Lesson 4")
    let nodeIndex: number | undefined;
    const indexMatch = lower.match(/\b(?:module|lesson|assignment|assessment|chapter|unit)\s+(\d{1,3})\b/i);
    if (indexMatch && indexMatch[1]) {
      nodeIndex = parseInt(indexMatch[1], 10);
    }

    const isNodeCommand =
      Boolean(targetNode) &&
      (/(?:add|insert|append|attach|put|embed|delete|remove|drop|rename|replace|create|make)\s+(?:the\s+|a\s+|an\s+|one\s+|\d+\s+)?(?:new\s+|more\s+)?(?:lesson|module|assignment|question|quiz|video|resource)s?\b/i.test(
        lower,
      ) ||
        /(?:lesson|module|assignment|question|quiz|video|resource)s?\s*(?:[0-9]+)?\s*.*?\b(?:delete|remove|drop|discard|erase|trash)\b/i.test(
          lower,
        ) ||
        /\b(?:still\s+visible\s+)?(?:remove|delete|drop)\s+(?:it|this|that|them)\b/i.test(lower));

    return { isNodeCommand, operationType, targetNode, nodeIndex };
  }

  /**
   * Categorizes pedagogical and catalog inquiries to guide downstream prompt shaping
   */
  private extractQaParams(lower: string, cleanQuery: string): QaIntentParams {
    let category: QaIntentParams['category'] = 'general';

    if (/\b(?:catalog|courses?|learning\s+paths?|available|catalog\s+overview|list\s+courses)\b/i.test(lower)) {
      category = 'catalog_overview';
    } else if (
      /\b(?:how\s+many\s+modules|structure|duration|breakdown|outline|how\s+long|weeks|hours)\b/i.test(lower)
    ) {
      category = 'course_structure';
    } else if (/\b(?:prerequisite|prior\s+knowledge|prereq|before\s+starting|requirements)\b/i.test(lower)) {
      category = 'prerequisites';
    } else if (/\b(?:rubric|grade|grading|assessment|scoring|evaluate\s+trainee)\b/i.test(lower)) {
      category = 'assessment_guidance';
    } else if (/\b(?:pedagog|best\s+practice|teaching|lab|hands-on|how\s+to\s+teach|explain\s+to)\b/i.test(lower)) {
      category = 'pedagogy';
    }

    // Detect primary topic keyword if any
    let detectedTopic: string | undefined;
    const topicMatch = cleanQuery.match(/\b(?:about|for|on|in)\s+["'“”]?([A-Za-z0-9+#.\s]{3,30})["'“”]?(?:$|\?|\.)/i);
    if (topicMatch && topicMatch[1]) {
      const candidate = topicMatch[1].trim();
      const STOP_WORDS = new Set(['this', 'that', 'it', 'them', 'my', 'the', 'a', 'an', 'course', 'curriculum']);
      if (!STOP_WORDS.has(candidate.toLowerCase())) {
        detectedTopic = candidate;
      }
    }

    return { category, detectedTopic };
  }
}
