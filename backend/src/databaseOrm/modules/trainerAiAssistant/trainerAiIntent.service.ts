import { Injectable, Logger } from '@nestjs/common';
import { sanitizeTrainerQuery } from './trainerAiSanitizer';

export type TrainerIntent = 'qa' | 'create_lp' | 'upgrade_lp' | 'confirm' | 'cancel' | 'other';

export interface ClassifiedIntent {
  intent: TrainerIntent;
  title?: string;
  confidence: number;
  sanitizedQuery?: string;
}

@Injectable()
export class TrainerAiIntentService {
  private readonly logger = new Logger(TrainerAiIntentService.name);

  /**
   * Fast, contextual intent classification for Trainer AI Assistant.
   * Differentiates between studio direct editor mutations and consultative pedagogical reasoning.
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

    // 1. Pending action resolution takes priority
    if (hasPendingAction) {
      if (/^(confirm|yes|publish|proceed|create\s+it|approve|sure|ok|do\s+it|go\s+ahead)\b/i.test(lower)) {
        return { intent: 'confirm', confidence: 0.99, sanitizedQuery: cleanQuery };
      }
      if (/^(cancel|no|discard|abort|reject|stop|don't|dont)\b/i.test(lower)) {
        return { intent: 'cancel', confidence: 0.99, sanitizedQuery: cleanQuery };
      }
    }

    // 2. Explicit Create LP / Curriculum intent (e.g. "create the curriculum of Devops", "Create LP: ...", "Generate course on ...")
    const createCurriculumRegex =
      /^(?:please\s+)?(?:create|generate|build|start|make|design|roadmap)\s+(?:a\s+|an\s+|the\s+)?(?:new\s+)?(?:brand\s+new\s+)?(?:lp|learning\s+path|course|curriculum|syllabus)\s*(?:titled|named|called|for|on|about|of|:)\s*["'“”]?([^"'“”\n\r]+)["'“”]?/i;
    const createMatch = cleanQuery.match(createCurriculumRegex);
    if (createMatch && createMatch[1]?.trim().length > 1) {
      let title = createMatch[1].trim().replace(/^[:\-\s]+|[:\-\s]+$/g, '');
      title = title.replace(/^(?:of|for|on|about)\s+/i, '').trim();
      return {
        intent: 'create_lp',
        title,
        confidence: 0.98,
        sanitizedQuery: cleanQuery,
      };
    }

    // Direct "Create LP: Title" or "Generate LP: Title" or "Create Curriculum: Title"
    const directLpMatch = cleanQuery.match(
      /^(?:create|generate|build|start|make)\s+(?:a\s+|an\s+|the\s+)?(?:lp|learning\s+path|course|curriculum|syllabus)\s*[:\-]\s*(.+)/i,
    );
    if (directLpMatch && directLpMatch[1]?.trim().length > 1) {
      return {
        intent: 'create_lp',
        title: directLpMatch[1].trim(),
        confidence: 0.98,
        sanitizedQuery: cleanQuery,
      };
    }

    // Direct "Create/Generate [Topic] Curriculum/Course/Learning Path" (e.g. "Create DevOps curriculum", "Generate Python Learning Path")
    const topicCurriculumMatch = cleanQuery.match(
      /^(?:please\s+)?(?:create|generate|build|start|make|design)\s+(?:a\s+|an\s+|the\s+)?(?:new\s+)?(.+?)\s+(?:curriculum|learning\s+path|course|syllabus)$/i,
    );
    if (topicCurriculumMatch && topicCurriculumMatch[1]?.trim().length > 1) {
      return {
        intent: 'create_lp',
        title: topicCurriculumMatch[1].trim(),
        confidence: 0.96,
        sanitizedQuery: cleanQuery,
      };
    }

    // 3. CONSULTATIVE / LOGICAL / PEDAGOGICAL INQUIRIES (QA)
    // When the trainer asks for reasons, suggestions, advice, critique, analysis, or explanations:
    // This MUST ALWAYS be routed to 'qa' (Never mutate the curriculum JSON).
    if (hasAdvisoryIntent && !hasDirectMutationIntent) {
      return { intent: 'qa', confidence: 0.96, sanitizedQuery: cleanQuery };
    }

    // 4. ACTIVE LP CONTEXT (Visual Editor / Curriculum Studio)
    if (hasActiveLp) {
      // Direct mutation command (e.g. "Add lesson Kafka in Module 1", "Delete Module 3", "Rename title")
      if (hasDirectMutationIntent) {
        return { intent: 'upgrade_lp', confidence: 0.98, sanitizedQuery: cleanQuery };
      }

      // Check for imperative action commands that specifically target a structural node
      const isNodeCommand =
        /(?:add|insert|append|attach|put|embed|delete|remove|drop|rename|replace|create|make)\s+(?:the\s+|a\s+|an\s+|one\s+|\d+\s+)?(?:new\s+|more\s+)?(?:lesson|module|assignment|question|quiz|video|resource)s?\b/i.test(
          lower,
        ) ||
        /(?:lesson|module|assignment|question|quiz|video|resource)s?\s*(?:[0-9]+)?\s*.*?\b(?:delete|remove|drop|discard|erase|trash)\b/i.test(
          lower,
        ) ||
        /\b(?:still\s+visible\s+)?(?:remove|delete|drop)\s+(?:it|this|that|them)\b/i.test(
          lower,
        );

      if (isNodeCommand) {
        return { intent: 'upgrade_lp', confidence: 0.92, sanitizedQuery: cleanQuery };
      }

      // Any other query while in Studio is consultative QA (e.g. "what is module 1?", "explain the structure")
      return { intent: 'qa', confidence: 0.92, sanitizedQuery: cleanQuery };
    }

    // 5. OUTSIDE STUDIO (Catalog / Global View)
    if (hasDirectMutationIntent) {
      return { intent: 'upgrade_lp', confidence: 0.88, sanitizedQuery: cleanQuery };
    }

    // Default to Q&A
    return { intent: 'qa', confidence: 0.9, sanitizedQuery: cleanQuery };
  }
}

