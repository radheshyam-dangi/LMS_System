import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { ModuleEntity } from '../../entities/module.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { AssignmentEntity } from '../../entities/assignment.entity';
import { LpAuthoringService } from '../lpAuthoring/lpAuthoring.service';
import { randomUUID } from 'crypto';
const uuidv4 = randomUUID;

export interface LpUpgradeResult {
  learningPath: LearningPathEntity;
  summary: string;
  moduleCount: number;
  lessonCount: number;
  assignmentCount: number;
}

@Injectable()
export class TrainerLpUpgradeService {
  private readonly logger = new Logger(TrainerLpUpgradeService.name);
  private lpRepo: Repository<LearningPathEntity>;

  constructor(
    private readonly datasource: DataSource,
    private readonly lpAuthoringService: LpAuthoringService,
  ) {
    this.lpRepo = this.datasource.getRepository(LearningPathEntity);
  }

  /**
   * Applies an upgrade or structural modification to an existing or draft Learning Path.
   */
  async upgradeLearningPath(
    lpId: string,
    instruction: string,
    trainerId: string,
  ): Promise<LpUpgradeResult> {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    // 1. Fetch current LP with complete relations
    const lp = await this.lpRepo.findOne({
      where: { id: lpId },
      relations: [
        'modules',
        'modules.lessons',
        'modules.lessons.resources',
        'modules.assignments',
      ],
      order: {
        createdAt: 'ASC',
      },
    });

    if (!lp) {
      throw new NotFoundException(`Learning Path with ID "${lpId}" was not found.`);
    }

    // 2. Perform web search if instruction asks for new videos or documentation
    let searchContext = '';
    if (/(?:video|youtube|resource|link|documentation|tutorial|docs)/i.test(instruction)) {
      try {
        const searchResults = await this.performWebSearch(`${lp.title} ${instruction}`);
        if (searchResults.length > 0) {
          searchContext = `\nREAL WEB & MEDIA RESOURCES TO GROUND YOUR ADDITIONS:\n` +
            searchResults.map(r => `- Title: "${r.title}", URL: "${r.url}"`).join('\n') + '\n';
        }
      } catch (e) {
        this.logger.warn(`Web search for LP upgrade failed: ${(e as Error).message}`);
      }
    }

    // 3. Serialize existing LP into a clean JSON representation
    const existingTree = {
      id: lp.id,
      title: lp.title,
      description: lp.description,
      level: lp.difficulty || 'Intermediate',
      status: lp.status || 'ai_draft',
      skillsTags: lp.skillsTags || [],
      modules: (lp.modules || []).map((m, mIdx) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        learningObjectives: m.objectives || [],
        learningOutcomes: m.outcomes || [],
        lessons: (m.lessons || []).map((l, lIdx) => ({
          id: l.id,
          title: l.title,
          description: l.description,
          videos: l.videos || (l.videoUrl ? [{ url: l.videoUrl, title: l.title }] : []),
          resources: (l.resources || []).map(r => ({ url: r.url, label: r.title, type: r.type || 'Link' })),
        })),
        assignments: (m.assignments || []).map((a, aIdx) => ({
          id: a.id,
          title: a.title,
          body: a.description || a.instructions || '',
          questions: (a.questions || []).map(q => ({
            id: q.id,
            text: q.text,
            type: q.type || 'Subjective',
            maxPoints: q.maxPoints || 10,
            options: q.options || [],
            correctIndex: q.correctIndex ?? 0,
            expectedAnswerGuideline: q.expectedAnswerGuideline || '',
          })),
        })),
      })),
    };

    // 3b. Detect if the instruction requests deletion of specific nodes
    const isDeleteInstruction =
      /\b(?:delete|remove|drop|discard|omit|trash|erase)\b/i.test(instruction) ||
      /\bstill\s+visible\b/i.test(instruction);

    const explicitDeletedLessonIds = new Set<string>();
    const explicitDeletedModuleIds = new Set<string>();
    const explicitDeletedAssignmentIds = new Set<string>();
    const explicitDeletedQuestionIds = new Set<string>();
    let deletionTargetNote = '';

    if (isDeleteInstruction) {
      // Mutual exclusivity check: determine exact target granularity
      const isQuestionDeletion =
        /\b(?:delete|remove|drop|discard|omit|trash|erase)\s+(?:the\s+|a\s+|an\s+|this\s+)?quest(?:ion)?\s*([0-9]+)\b/i.test(instruction) ||
        /\bquest(?:ion)?\s*([0-9]+)\s*.*?\b(?:delete|remove|drop|discard)\b/i.test(instruction);

      const isLessonDeletion = !isQuestionDeletion && (
        /\b(?:delete|remove|drop|discard|omit|trash|erase)\s+(?:the\s+|a\s+|an\s+|this\s+)?less(?:on)?\s*([0-9]+)\b/i.test(instruction) ||
        /\bless(?:on)?\s*([0-9]+)\s*.*?\b(?:delete|remove|drop|discard|still\s+visible)\b/i.test(instruction)
      );

      const isAssignmentDeletion = !isQuestionDeletion && !isLessonDeletion && (
        /\b(?:delete|remove|drop|discard|omit|trash|erase)\s+(?:the\s+|a\s+|an\s+|this\s+)?(?:assignment|assessment|task|quiz)\s*([0-9]+)?\b/i.test(instruction) ||
        /\b(?:assignment|assessment|task|quiz)\s*([0-9]+)?\s*.*?\b(?:delete|remove|drop|discard)\b/i.test(instruction)
      );

      const isModuleDeletion = !isQuestionDeletion && !isLessonDeletion && !isAssignmentDeletion && (
        /\b(?:delete|remove|drop|discard|omit|trash|erase)\s+(?:the\s+|a\s+|an\s+|this\s+)?mod(?:ule)?\s*([0-9]+)\b/i.test(instruction) ||
        /\bmod(?:ule)?\s*([0-9]+)\s*.*?\b(?:delete|remove|drop|discard)\b/i.test(instruction)
      );

      // 1. Check for Question targets (e.g. 'from this assignment "Module 1 Hands-On Assessment" remove question 2')
      if (isQuestionDeletion) {
        const questionNumMatch = instruction.match(/\bquest(?:ion)?\s*([0-9]+)\b/i);
        if (questionNumMatch) {
          const qNum = parseInt(questionNumMatch[1], 10);
          const assignQuoteMatch = instruction.match(/["'“]([^"'“”]+)["'”]/i);
          const assignNamed = assignQuoteMatch ? assignQuoteMatch[1].toLowerCase().trim() : null;

          for (const m of existingTree.modules) {
            for (const a of (m.assignments || [])) {
              const assignTitleLower = (a.title || '').toLowerCase().trim();
              const matchesAssign = !assignNamed || assignTitleLower.includes(assignNamed) || assignNamed.includes(assignTitleLower);
              if (matchesAssign && Array.isArray(a.questions)) {
                if (qNum >= 1 && qNum <= a.questions.length) {
                  explicitDeletedQuestionIds.add(a.questions[qNum - 1].id);
                }
              }
            }
          }
        }
      }

      // 2. Check for Lesson targets (e.g. "lesson 4 still visible remove it", "remove lesson 3")
      if (isLessonDeletion) {
        const lessonNumMatch = instruction.match(/\bless(?:on)?\s*([0-9]+)\b/i);
        if (lessonNumMatch) {
          const num = parseInt(lessonNumMatch[1], 10);
          for (const m of existingTree.modules) {
            for (let lIdx = 0; lIdx < (m.lessons || []).length; lIdx++) {
              const l = m.lessons[lIdx];
              const titleLower = (l.title || '').toLowerCase();
              if (
                titleLower.includes(`lesson ${num}`) ||
                new RegExp(`\\b${num}[.:\\s]`, 'i').test(titleLower) ||
                lIdx + 1 === num
              ) {
                explicitDeletedLessonIds.add(l.id);
              }
            }
          }
        }
      }

      // 3. Check for Assignment targets (e.g. "remove assignment 2", "delete Module 1 Assessment")
      if (isAssignmentDeletion) {
        const assignNumMatch = instruction.match(/\b(?:assignment|assessment|task|quiz)\s*([0-9]+)\b/i);
        if (assignNumMatch) {
          const aNum = parseInt(assignNumMatch[1], 10);
          for (const m of existingTree.modules) {
            for (let aIdx = 0; aIdx < (m.assignments || []).length; aIdx++) {
              const a = m.assignments[aIdx];
              const titleLower = (a.title || '').toLowerCase();
              if (
                titleLower.includes(`assignment ${aNum}`) ||
                titleLower.includes(`assessment ${aNum}`) ||
                aIdx + 1 === aNum
              ) {
                explicitDeletedAssignmentIds.add(a.id);
              }
            }
          }
        }
      }

      // 4. Check for Module targets (e.g. "delete module 2", "remove module 1")
      if (isModuleDeletion) {
        const moduleNumMatch = instruction.match(/\bmod(?:ule)?\s*([0-9]+)\b/i);
        if (moduleNumMatch) {
          const num = parseInt(moduleNumMatch[1], 10);
          for (let mIdx = 0; mIdx < existingTree.modules.length; mIdx++) {
            const m = existingTree.modules[mIdx];
            const titleLower = (m.title || '').toLowerCase();
            if (
              titleLower.includes(`module ${num}`) ||
              new RegExp(`\\b${num}[.:\\s]`, 'i').test(titleLower) ||
              mIdx + 1 === num
            ) {
              explicitDeletedModuleIds.add(m.id);
            }
          }
        }
      }

      if (
        explicitDeletedLessonIds.size > 0 ||
        explicitDeletedModuleIds.size > 0 ||
        explicitDeletedAssignmentIds.size > 0 ||
        explicitDeletedQuestionIds.size > 0
      ) {
        deletionTargetNote = `\nEXPLICIT DELETION MANDATE:
The trainer explicitly commanded the removal of:
${explicitDeletedLessonIds.size > 0 ? `- Lessons to permanently delete (IDs: ${Array.from(explicitDeletedLessonIds).join(', ')})` : ''}
${explicitDeletedModuleIds.size > 0 ? `- Modules to permanently delete (IDs: ${Array.from(explicitDeletedModuleIds).join(', ')})` : ''}
${explicitDeletedAssignmentIds.size > 0 ? `- Assignments to permanently delete (IDs: ${Array.from(explicitDeletedAssignmentIds).join(', ')})` : ''}
${explicitDeletedQuestionIds.size > 0 ? `- Questions to permanently remove (IDs: ${Array.from(explicitDeletedQuestionIds).join(', ')})` : ''}
YOU MUST COMPLETELY OMIT THESE ITEMS from the output JSON! Do NOT include them anywhere in the response.\n`;
      }
    }

    // 4. Construct prompt for Groq
    const prompt = `You are a Senior Curriculum Architect and Automated Upgrade Engine at SkillForge LMS.
The trainer has given a direct command to update this Learning Path inside the visual editor.

TRAINER COMMAND:
"${instruction}"
${deletionTargetNote}${searchContext}
CURRENT CURRICULUM DATA:
${JSON.stringify(existingTree, null, 2)}

CRITICAL EXECUTION RULES:
1. DIRECTLY EXECUTE the trainer's command on the curriculum data structure. Do NOT provide textual suggestions, advice, or ideas.
2. PRESERVE all existing modules, lessons, and assignments that the trainer did not ask to remove or replace.
3. PRESERVE all existing valid UUIDs. For newly added modules, lessons, or assignments, assign new standard UUIDs (e.g. "${uuidv4()}").
4. STRICT DELETION & REMOVAL MANDATE:
   - When the trainer asks to delete, remove, drop, discard, or eliminate any module, lesson, assignment, question, or resource (e.g. "lesson 4 still visible remove it", "delete lesson 4", "remove module 2", "drop assignment 1"):
   - YOU MUST COMPLETELY OMIT AND EXCLUDE that item from the returned "modules", "lessons", or "assignments" arrays!
   - DO NOT return the removed node in the output JSON.
   - In "upgradeSummary", explicitly state: "Confirmed: Successfully removed [Lesson/Module Title] from the curriculum."
5. If adding new lessons, provide rich educational descriptions (2-3 solid paragraphs), real YouTube video links if available, and documentation links.
6. If adding assignments or questions, provide realistic MCQ or Subjective questions with options, expected guidelines, and maxPoints.
7. Provide an "upgradeSummary" attribute with a definitive, crystal-clear final confirmation statement of what was created, deleted, or modified.
8. Return ONLY the modified JSON object. No markdown fences, no explanatory chat outside the JSON.

SCHEMA REQUIRED:
{
  "title": string,
  "description": string,
  "level": string,
  "skillsTags": string[],
  "upgradeSummary": "A definitive, crystal-clear final confirmation statement of what was created, deleted, or modified (e.g. 'Confirmed: Successfully removed Lesson 4 from Module 1.')",
  "modules": [
    {
      "id": string,
      "title": string,
      "description": string,
      "learningObjectives": string[],
      "learningOutcomes": string[],
      "lessons": [
        {
          "id": string,
          "title": string,
          "description": string,
          "videos": [{"url": string, "title": string}],
          "resources": [{"url": string, "label": string, "type": string}]
        }
      ],
      "assignments": [
        {
          "id": string,
          "title": string,
          "body": string,
          "questions": [
            {
              "id": string,
              "text": string,
              "type": "MCQ" | "Subjective",
              "maxPoints": number,
              "options": string[],
              "correctIndex": number,
              "expectedAnswerGuideline": string
            }
          ]
        }
      ]
    }
  ]
}`;

    const primaryModel = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';
    const modelsToTry = [primaryModel, 'openai/gpt-oss-20b'];
    let rawText = '';
    let lastError: any;

    for (const model of modelsToTry) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are the Automated Curriculum Upgrade Engine for SkillForge LMS visual editor. Your job is to DIRECTLY apply changes to the curriculum structure according to the trainer command. NEVER provide chat advice or recommendations. Output ONLY valid JSON matching the schema.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.2,
            max_tokens: 8192,
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (response.status === 429) {
          this.logger.warn(`Model ${model} hit rate limit (429). Retrying with secondary model...`);
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Groq API error ${response.status}: ${errText}`);
        }

        const resData = (await response.json()) as any;
        rawText = resData.choices?.[0]?.message?.content?.trim() || '';
        if (rawText) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!rawText) {
      this.logger.error(`Groq LP upgrade failed for LP ${lpId}: ${(lastError as Error)?.message}`);
      throw new Error(`Failed to apply upgrade: ${(lastError as Error)?.message || 'No response from AI'}`);
    }

    // 5. Parse JSON
    const parsed = this.parseJsonSafely(rawText);

    // Deterministic post-processing filter for deletions:
    // Guarantee that any explicitly commanded deleted items are 100% removed from the payload
    if (
      explicitDeletedLessonIds.size > 0 ||
      explicitDeletedModuleIds.size > 0 ||
      explicitDeletedAssignmentIds.size > 0 ||
      explicitDeletedQuestionIds.size > 0
    ) {
      if (Array.isArray(parsed.modules)) {
        if (explicitDeletedModuleIds.size > 0) {
          parsed.modules = parsed.modules.filter((m: any) => !explicitDeletedModuleIds.has(m.id));
        }
        for (const mod of parsed.modules) {
          if (Array.isArray(mod.lessons) && explicitDeletedLessonIds.size > 0) {
            mod.lessons = mod.lessons.filter((l: any) => !explicitDeletedLessonIds.has(l.id));
          }
          if (Array.isArray(mod.assignments)) {
            if (explicitDeletedAssignmentIds.size > 0) {
              mod.assignments = mod.assignments.filter((a: any) => !explicitDeletedAssignmentIds.has(a.id));
            }
            if (explicitDeletedQuestionIds.size > 0) {
              for (const a of mod.assignments) {
                if (Array.isArray(a.questions)) {
                  a.questions = a.questions.filter((q: any) => !explicitDeletedQuestionIds.has(q.id));
                }
              }
            }
          }
        }
      }
    }

    let upgradeSummary = parsed.upgradeSummary || 'Updated curriculum structure according to your instructions.';
    if (explicitDeletedQuestionIds.size > 0) {
      const qNumMatch = instruction.match(/\bquest(?:ion)?\s*([0-9]+)\b/i);
      upgradeSummary = `Confirmed: Successfully removed Question ${qNumMatch ? qNumMatch[1] : ''} from the assignment.`;
    } else if (isDeleteInstruction && !upgradeSummary.toLowerCase().includes('removed') && !upgradeSummary.toLowerCase().includes('deleted')) {
      upgradeSummary = `Confirmed: Successfully removed the requested curriculum item.`;
    }

    // 6. Defensive Merging: Ensure existing modules and lessons are preserved if omitted by LLM
    let rawModules: any[] = Array.isArray(parsed.modules) && parsed.modules.length > 0
      ? parsed.modules
      : existingTree.modules;

    // Filter out explicitly deleted modules
    rawModules = rawModules.filter((m: any) => !explicitDeletedModuleIds.has(m.id));

    // If an existing module was dropped by the LLM without explicit deletion request, restore it
    for (const existingMod of existingTree.modules) {
      if (!explicitDeletedModuleIds.has(existingMod.id)) {
        const found = rawModules.find(
          (m: any) => m.id === existingMod.id || (m.title && m.title.toLowerCase() === existingMod.title.toLowerCase())
        );
        if (!found) {
          rawModules.push(existingMod);
        }
      }
    }

    // Ensure lessons and assignments within each module are not empty if they existed
    for (const m of rawModules) {
      const existingMod = existingTree.modules.find(em => em.id === m.id || (em.title && em.title.toLowerCase() === (m.title || '').toLowerCase()));
      if (existingMod) {
        if (!m.lessons || m.lessons.length === 0) {
          m.lessons = (existingMod.lessons || []).filter(l => !explicitDeletedLessonIds.has(l.id));
        }
        if (!m.assignments || m.assignments.length === 0) {
          m.assignments = (existingMod.assignments || []).filter(a => !explicitDeletedAssignmentIds.has(a.id));
        }
      }
    }

    // Format payload for LpAuthoringService upsert
    const formattedPayload = {
      id: lp.id,
      title: parsed.title || lp.title,
      description: parsed.description || lp.description,
      level: parsed.level || lp.difficulty,
      status: lp.status, // preserve status (ai_draft stays ai_draft)
      origin: lp.origin || 'ai',
      skillsTags: Array.isArray(parsed.skillsTags) ? parsed.skillsTags : lp.skillsTags,
      modules: rawModules.map((m: any, mIdx: number) => {
        const lessons = (m.lessons || []).map((l: any, lIdx: number) => ({
          id: l.id && /^[0-9a-f]{8}-/i.test(l.id) ? l.id : uuidv4(),
          title: l.title || `Lesson ${lIdx + 1}`,
          description: l.description || 'Lesson overview and fundamental principles.',
          videos: Array.isArray(l.videos) ? l.videos : (l.videoUrl ? [{ url: l.videoUrl, title: l.title }] : []),
          audios: Array.isArray(l.audios) ? l.audios : [],
          resources: Array.isArray(l.resources) ? l.resources : [],
        }));

        const createdLessonIds = lessons.map((l: any) => l.id);

        const assignments = (m.assignments || []).map((a: any, aIdx: number) => {
          const questions = (a.questions || []).map((q: any) => ({
            id: q.id && /^[0-9a-f]{8}-/i.test(q.id) ? q.id : uuidv4(),
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
            id: a.id && /^[0-9a-f]{8}-/i.test(a.id) ? a.id : uuidv4(),
            title: a.title || `Module ${mIdx + 1} Assessment`,
            body: a.body || 'Complete the tasks and questions based on this module.',
            questions,
            dependsOnLessonIds: createdLessonIds,
            lockConfig: { enabled: true },
            evaluation: {
              autoEvaluateWithAI: true,
              humanInterventionRequired: true,
            },
            timerDuration: { days: 7, hours: 0, minutes: 0 },
            countdownStart: 'taskUnlocked',
          };
        });

        return {
          id: m.id && /^[0-9a-f]{8}-/i.test(m.id) ? m.id : uuidv4(),
          title: m.title || `Module ${mIdx + 1}`,
          description: m.description || '',
          sequentialModuleLock: true,
          sequentialLessonLock: true,
          learningObjectives: m.learningObjectives || [],
          learningOutcomes: m.learningOutcomes || [],
          lessons,
          assignments,
        };
      }),
    };

    // 7. Save via transactional LpAuthoringService (upsert mode since formattedPayload.id is set)
    const savedLp = await this.lpAuthoringService.createLearningPathFromDocument(
      formattedPayload,
      trainerId,
    );

    const moduleCount = formattedPayload.modules.length;
    const lessonCount = formattedPayload.modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0);
    const assignmentCount = formattedPayload.modules.reduce((sum: number, m: any) => sum + (m.assignments?.length || 0), 0);

    return {
      learningPath: savedLp,
      summary: upgradeSummary,
      moduleCount,
      lessonCount,
      assignmentCount,
    };
  }

  private async performWebSearch(query: string): Promise<Array<{ title: string; url: string }>> {
    if (!process.env.TAVILY_API_KEY) return [];
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: query.substring(0, 300),
          max_results: 3,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return (data.results || []).map((r: any) => ({
          title: r.title || 'Resource',
          url: r.url || '',
        }));
      }
    } catch {
      // ignore
    }
    return [];
  }

  private parseJsonSafely(rawText: string): any {
    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      return JSON.parse(clean);
    } catch (e) {
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
        } catch {
          // fall through
        }
      }
      this.logger.error(`Failed to parse upgrade JSON: ${clean.substring(0, 500)}`);
      throw new BadRequestException('Could not parse upgrade response from AI.');
    }
  }
}
