import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
const uuidv4 = randomUUID;
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { AssistantActionEntity } from '../../entities/assistantAction.entity';
import { LpAuthoringService } from '../lpAuthoring/lpAuthoring.service';

export interface GenerationResult {
  learningPath: LearningPathEntity;
  action: AssistantActionEntity;
  moduleCount: number;
  lessonCount: number;
  assignmentCount: number;
  warning?: string;
}

function inferPathDifficulty(title: string, llmLevel?: string): string {
  if (llmLevel && ['Beginner', 'Intermediate', 'Advanced', 'Mastery'].includes(llmLevel)) {
    return llmLevel;
  }
  const t = (title || '').toLowerCase();
  if (/\b(?:intro(?:duction)?|beginner|basics?|fundamentals?|getting\s+started|101|primer|entry)\b/i.test(t)) {
    return 'Beginner';
  }
  if (/\b(?:advanced|expert|deep\s*dive|mastery|architecture|enterprise|distributed|internals?|production)\b/i.test(t)) {
    return 'Advanced';
  }
  return 'Intermediate';
}

function getFallbackThumbnail(title: string): string {
  const t = (title || '').toLowerCase();
  if (t.includes('python')) return 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80';
  if (t.includes('react') || t.includes('frontend')) return 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=80';
  if (t.includes('docker') || t.includes('kubernetes') || t.includes('devops')) return 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&auto=format&fit=crop&q=80';
  if (t.includes('llm') || t.includes('ai') || t.includes('gpt') || t.includes('machine learning')) return 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=800&auto=format&fit=crop&q=80';
  if (t.includes('cloud') || t.includes('aws') || t.includes('azure')) return 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80';
  if (t.includes('security') || t.includes('cyber')) return 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80';
  if (t.includes('data') || t.includes('sql') || t.includes('database')) return 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&auto=format&fit=crop&q=80';
  return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';
}

function buildDefaultAssignmentInstructions(
  moduleTitle: string,
  lessonTitles: string[],
  level: 'Easy' | 'Medium' | 'Hard',
): string {
  const lessonContext = lessonTitles.length > 0 ? `(${lessonTitles.join(', ')})` : 'in this module';
  return [
    `<ol class="assessment-instructions-list">`,
    `  <li><strong>Prerequisite Review:</strong> Thoroughly review preceding module lessons ${lessonContext} before beginning this assessment. Ensure foundational principles are fully understood.</li>`,
    `  <li><strong>Question Analysis:</strong> For Multiple Choice Questions (MCQs), evaluate all provided technical alternatives and choose the single most optimal engineering solution.</li>`,
    `  <li><strong>Reasoning & Evidence:</strong> For Subjective and scenario-based tasks, articulate structured step-by-step reasoning, citing specific CLI commands, architectural patterns, or API endpoints.</li>`,
    `  <li><strong>Quality Standards:</strong> Your submitted solutions must adhere to enterprise production standards, clean code paradigms, and robust error-handling practices.</li>`,
    `  <li><strong>Evaluation & Feedback:</strong> Upon submission, your responses undergo automated AI evaluation followed by mandatory trainer review against the module grading rubric.</li>`,
    `</ol>`,
  ].join('\n');
}

@Injectable()
export class TrainerLpGenerationService {
  private readonly logger = new Logger(TrainerLpGenerationService.name);
  private lpRepo: Repository<LearningPathEntity>;
  private actionRepo: Repository<AssistantActionEntity>;

  constructor(
    private readonly datasource: DataSource,
    private readonly lpAuthoringService: LpAuthoringService,
  ) {
    this.lpRepo = this.datasource.getRepository(LearningPathEntity);
    this.actionRepo = this.datasource.getRepository(AssistantActionEntity);
  }

  /**
   * Generates a complete learning path from title, validates it, and saves as ai_draft.
   */
  async generateLearningPath(
    title: string,
    trainerId: string,
    conversationId?: string,
  ): Promise<GenerationResult> {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error('GROQ_API_KEY is not configured in environment');
    }

    this.logger.log(`[TrainerLpGenerationService] Generating AI Learning Path for "${title}" (trainer: ${trainerId})...`);

    // 1. Check for similar existing paths to provide a helpful notice
    const existingSimilar = await this.lpRepo
      .createQueryBuilder('lp')
      .where('lp.title ILIKE :q', { q: `%${title.trim()}%` })
      .andWhere('lp.status != :status', { status: 'ai_draft' })
      .getOne();

    let warning: string | undefined;
    if (existingSimilar) {
      warning = `Note: A published Learning Path with a similar title already exists: "${existingSimilar.title}". I generated a fresh draft for you below.`;
    }

    // 2. Perform live web search via Tavily for documentation and real YouTube videos
    const webFindings = await this.enrichFromWeb(title);

    let webGroundingContext = '';
    if (webFindings.youtubeVideos.length > 0 || webFindings.docLinks.length > 0) {
      webGroundingContext = `\nREAL-WORLD VERIFIED MEDIA & REFERENCE LINKS (USE THESE EXACT URLS IN LESSONS):\n` +
        `YouTube Videos:\n` + webFindings.youtubeVideos.map(v => `- "${v.title}": ${v.url}`).join('\n') + '\n' +
        `Official Documentation & Guides:\n` + webFindings.docLinks.map(d => `- "${d.title}": ${d.url}`).join('\n') + '\n';
    }

    // 3. Prompt Groq for structured curriculum JSON with progressive difficulty
    const prompt = `You are a Senior Instructional Designer and Curriculum Architect at SkillForge LMS.
Create a complete, high-quality, professional Learning Path curriculum titled: "${title}".
${webGroundingContext}
You MUST return ONLY a valid, parseable JSON object without markdown code fences, headers, or surrounding text.

PEDAGOGICAL ARCHITECTURE RULES:
1. PROGRESSIVE DIFFICULTY STRUCTURE (Easy -> Medium -> Hard):
   - Module 1 (Foundations & Core Setup): "Easy" difficulty. Focuses on foundational syntax, core principles, environment setup, and baseline mental models.
   - Module 2 (Core Implementation & Practical Patterns): "Medium" difficulty. Focuses on hands-on building, integration, data flow, and real-world workflows.
   - Module 3 & 4 (Enterprise Scale, Security & Capstone): "Hard" difficulty. Focuses on production architecture, performance tuning, security hardening, troubleshooting, and comprehensive capstone project.
2. DYNAMIC DIFFICULTY LEVEL:
   - Choose "Beginner", "Intermediate", "Advanced", or "Mastery" for the overall path level based on the topic scope and technical depth.
3. DETAILED ASSIGNMENT INSTRUCTIONS:
   - For every module's assignment, provide 5 comprehensive, numbered guidelines covering:
     1. Prerequisite lesson review
     2. MCQ critical analysis
     3. Subjective reasoning & code evidence
     4. Enterprise quality & clean-code standards
     5. AI pre-evaluation and trainer rubric review
4. QUESTION LESSON DEPENDENCIES:
   - In each question, specify "targetLessonIndex" (0, 1, or 2) pointing to the exact preceding lesson in that module that grounds the question.
   - For MCQ questions, provide 4 distinct realistic options and accurate correctIndex (0-3).
   - For Subjective questions, provide a clear "expectedAnswerGuideline" for AI rubric evaluation.

Schema Requirements:
{
  "title": "${title}",
  "description": "2-3 comprehensive sentences explaining the goals, practical skills, and target outcome of this learning path.",
  "level": "Beginner" | "Intermediate" | "Advanced" | "Mastery",
  "skillsTags": ["Skill1", "Skill2", "Skill3", "Skill4"],
  "modules": [
    {
      "title": "Module 1: Title (Foundations)",
      "description": "Module overview explaining core foundational concepts.",
      "learningObjectives": ["Objective 1", "Objective 2"],
      "learningOutcomes": ["Outcome 1", "Outcome 2"],
      "lessons": [
        {
          "title": "Lesson 1: Title",
          "description": "Clear, comprehensive lesson content with explanations, best practices, and code concepts where appropriate (2-3 solid educational paragraphs).",
          "videos": [{"url": "https://www.youtube.com/watch?v=...", "title": "Video Tutorial"}],
          "resources": [{"url": "https://...", "label": "Official Documentation", "type": "Documentation"}]
        },
        {
          "title": "Lesson 2: Title",
          "description": "In-depth educational lesson content covering practical aspects and examples (2-3 solid educational paragraphs).",
          "videos": [{"url": "https://www.youtube.com/watch?v=...", "title": "Deep Dive Tutorial"}],
          "resources": [{"url": "https://...", "label": "Reference Guide", "type": "Guide"}]
        }
      ],
      "assignments": [
        {
          "title": "Module 1 Hands-On Assessment (Easy)",
          "body": "Instructions & Submission Guidelines:\n1. Prerequisite Review: Thoroughly review preceding module lessons before beginning this assessment.\n2. Question Analysis: For Multiple Choice Questions, analyze all options and choose the single most optimal engineering solution.\n3. Reasoning & Evidence: Articulate structured step-by-step reasoning citing specific commands or patterns.\n4. Quality Standards: Adhere to enterprise production standards, clean code paradigms, and robust error-handling.\n5. Evaluation & Feedback: Submissions undergo automated AI evaluation followed by mandatory trainer review against the module grading rubric.",
          "questions": [
            {
              "text": "Practical question testing the concepts in Lesson 1",
              "type": "MCQ",
              "targetLessonIndex": 0,
              "maxPoints": 10,
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctIndex": 0
            },
            {
              "text": "Concept verification question testing Lesson 2",
              "type": "MCQ",
              "targetLessonIndex": 1,
              "maxPoints": 10,
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctIndex": 2
            }
          ]
        }
      ]
    },
    {
      "title": "Module 2: Title (Implementation & Workflows)",
      "description": "Deeper exploration into real-world applications and workflows.",
      "learningObjectives": ["Objective 1", "Objective 2"],
      "learningOutcomes": ["Outcome 1", "Outcome 2"],
      "lessons": [
        {
          "title": "Lesson 1: Title",
          "description": "Detailed lesson content outlining practical architectural patterns and methodologies.",
          "videos": [{"url": "https://www.youtube.com/watch?v=...", "title": "Implementation Walkthrough"}],
          "resources": [{"url": "https://...", "label": "Enterprise Best Practices", "type": "Article"}]
        },
        {
          "title": "Lesson 2: Title",
          "description": "Detailed lesson content focusing on integration and practical scenarios.",
          "videos": [],
          "resources": []
        }
      ],
      "assignments": [
        {
          "title": "Module 2 Practical Assessment (Medium)",
          "body": "Instructions & Submission Guidelines:\n1. Prerequisite Review: Thoroughly review preceding module lessons before beginning this assessment.\n2. Question Analysis: For Multiple Choice Questions, analyze all options and choose the single most optimal engineering solution.\n3. Reasoning & Evidence: Articulate structured step-by-step reasoning citing specific commands or patterns.\n4. Quality Standards: Adhere to enterprise production standards, clean code paradigms, and robust error-handling.\n5. Evaluation & Feedback: Submissions undergo automated AI evaluation followed by mandatory trainer review against the module grading rubric.",
          "questions": [
            {
              "text": "Scenario-based question on implementation best practices",
              "type": "MCQ",
              "targetLessonIndex": 0,
              "maxPoints": 15,
              "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
              "correctIndex": 1
            },
            {
              "text": "Explain the architectural trade-offs and step-by-step implementation for this workflow.",
              "type": "Subjective",
              "targetLessonIndex": 1,
              "maxPoints": 20,
              "expectedAnswerGuideline": "Comprehensive answer identifying diagnostic commands, configuration parameters, and architectural patterns."
            }
          ]
        }
      ]
    },
    {
      "title": "Module 3: Title (Production Scale & Capstone)",
      "description": "Advanced production engineering, failure modes, scale, and enterprise deployment.",
      "learningObjectives": ["Objective 1", "Objective 2"],
      "learningOutcomes": ["Outcome 1", "Outcome 2"],
      "lessons": [
        {
          "title": "Lesson 1: Title",
          "description": "Comprehensive guide to production deployment, optimization, and scale.",
          "videos": [],
          "resources": []
        },
        {
          "title": "Lesson 2: Title",
          "description": "Enterprise security, observability, and disaster recovery strategies.",
          "videos": [],
          "resources": []
        }
      ],
      "assignments": [
        {
          "title": "Module 3 Capstone Assessment (Hard)",
          "body": "Instructions & Submission Guidelines:\n1. Prerequisite Review: Thoroughly review preceding module lessons before beginning this assessment.\n2. Question Analysis: For Multiple Choice Questions, analyze all options and choose the single most optimal engineering solution.\n3. Reasoning & Evidence: Articulate structured step-by-step reasoning citing specific commands or patterns.\n4. Quality Standards: Adhere to enterprise production standards, clean code paradigms, and robust error-handling.\n5. Evaluation & Feedback: Submissions undergo automated AI evaluation followed by mandatory trainer review against the module grading rubric.",
          "questions": [
            {
              "text": "High-availability troubleshooting scenario question",
              "type": "MCQ",
              "targetLessonIndex": 0,
              "maxPoints": 15,
              "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
              "correctIndex": 3
            },
            {
              "text": "Design and document the end-to-end production architecture, security controls, and disaster recovery plan.",
              "type": "Subjective",
              "targetLessonIndex": 1,
              "maxPoints": 25,
              "expectedAnswerGuideline": "Detailed architectural specification covering failure domains, monitoring metrics, and recovery playbooks."
            }
          ]
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. Generate 2 to 4 progressive modules (Easy -> Medium -> Hard).
2. For lesson videos, assign the real YouTube URLs provided in the context above whenever possible.
3. For lesson resources, assign the real documentation/guide URLs provided in the context above.
4. Ensure all JSON syntax is valid.`;

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
                content: 'You are a curriculum generation engine. Always output pure valid JSON matching the schema.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 4096,
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
      this.logger.error(`Groq generation failed for "${title}": ${(lastError as Error)?.message}`);
      throw new Error(`Curriculum generation failed: ${(lastError as Error)?.message || 'No response from AI'}`);
    }

    // 4. Extract and parse JSON
    const parsedPayload = this.parseJsonSafely(rawText, title);

    // 5. Validate & format into transactional LP authoring payload
    const formattedPayload = this.prepareAuthoringPayload(parsedPayload, webFindings);

    // 6. Save as ai_draft using transactional LpAuthoringService
    const savedLp = await this.lpAuthoringService.createLearningPathFromDocument(
      formattedPayload,
      trainerId,
    );

    // 7. Create AssistantActionEntity record with 24h TTL
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const action = this.actionRepo.create({
      trainerId,
      actionType: 'confirm_create',
      targetId: savedLp.id,
      status: 'pending',
      expiresAt,
      payload: {
        conversationId,
        lpId: savedLp.id,
        title: savedLp.title,
        moduleCount: formattedPayload.modules.length,
        lessonCount: formattedPayload.modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0),
        assignmentCount: formattedPayload.modules.reduce((sum: number, m: any) => sum + (m.assignments?.length || 0), 0),
      },
    });
    const savedAction = await this.actionRepo.save(action);

    const moduleCount = formattedPayload.modules.length;
    const lessonCount = formattedPayload.modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0);
    const assignmentCount = formattedPayload.modules.reduce((sum: number, m: any) => sum + (m.assignments?.length || 0), 0);

    this.logger.log(
      `[TrainerLpGenerationService] Successfully generated draft LP "${savedLp.title}" (${savedLp.id}) with ${moduleCount} modules, ${lessonCount} lessons, ${assignmentCount} assignments. Staged action: ${savedAction.id}`,
    );

    return {
      learningPath: savedLp,
      action: savedAction,
      moduleCount,
      lessonCount,
      assignmentCount,
      warning,
    };
  }

  /**
   * Performs live web search via Tavily for YouTube tutorial videos, authoritative documentation, and relevant thumbnail image.
   */
  private async enrichFromWeb(title: string): Promise<{
    youtubeVideos: Array<{ title: string; url: string }>;
    docLinks: Array<{ title: string; url: string }>;
    thumbnailUrl?: string;
  }> {
    const apiKey = process.env.TAVILY_API_KEY;
    const youtubeVideos: Array<{ title: string; url: string }> = [];
    const docLinks: Array<{ title: string; url: string }> = [];
    let thumbnailUrl: string | undefined;

    if (!apiKey) {
      return { youtubeVideos, docLinks, thumbnailUrl: getFallbackThumbnail(title) };
    }

    try {
      // 1. YouTube video search with image inclusion
      const ytRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: `${title} tutorial course site:youtube.com`,
          include_images: true,
          max_results: 4,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (ytRes.ok) {
        const ytData = (await ytRes.json()) as any;
        for (const item of ytData.results || []) {
          if (item.url && (item.url.includes('youtube.com/watch') || item.url.includes('youtu.be/'))) {
            youtubeVideos.push({
              title: item.title || 'Video Tutorial',
              url: item.url,
            });
          }
        }
        if (Array.isArray(ytData.images) && ytData.images.length > 0 && !thumbnailUrl) {
          const img = ytData.images.find((u: string) => typeof u === 'string' && u.startsWith('http') && !u.includes('.svg'));
          if (img) thumbnailUrl = img;
        }
      }
    } catch (e) {
      this.logger.warn(`Tavily YouTube search failed for "${title}": ${(e as Error).message}`);
    }

    try {
      // 2. Documentation and tutorial guides search with image inclusion
      const docRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: `${title} official documentation getting started guide`,
          include_images: true,
          max_results: 4,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (docRes.ok) {
        const docData = (await docRes.json()) as any;
        for (const item of docData.results || []) {
          if (item.url && !item.url.includes('youtube.com')) {
            docLinks.push({
              title: item.title || 'Official Documentation',
              url: item.url,
            });
          }
        }
        if (Array.isArray(docData.images) && docData.images.length > 0 && !thumbnailUrl) {
          const img = docData.images.find((u: string) => typeof u === 'string' && u.startsWith('http') && !u.includes('.svg'));
          if (img) thumbnailUrl = img;
        }
      }
    } catch (e) {
      this.logger.warn(`Tavily documentation search failed for "${title}": ${(e as Error).message}`);
    }

    if (!thumbnailUrl) {
      thumbnailUrl = getFallbackThumbnail(title);
    }

    return { youtubeVideos, docLinks, thumbnailUrl };
  }

  /**
   * Cleans up markdown code blocks if the LLM wrapped JSON in ```json ... ```
   */
  private parseJsonSafely(rawText: string, defaultTitle: string): any {
    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      return JSON.parse(clean);
    } catch (e) {
      // Try to find the outermost braces
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
        } catch {
          // fall through
        }
      }
      this.logger.error(`Failed to parse LLM JSON: ${clean.substring(0, 500)}`);
      throw new BadRequestException('Could not parse curriculum output from AI. Please try again.');
    }
  }

  /**
   * Prepares the payload to match what LpAuthoringService requires.
   */
  private prepareAuthoringPayload(
    data: any,
    webFindings?: { youtubeVideos: any[]; docLinks: any[]; thumbnailUrl?: string },
  ): any {
    let videoIndex = 0;
    let docIndex = 0;
    const availableVideos = webFindings?.youtubeVideos || [];
    const availableDocs = webFindings?.docLinks || [];
    const chosenThumbnail = webFindings?.thumbnailUrl || getFallbackThumbnail(data.title || '');

    const resolvedLpLevel = inferPathDifficulty(data.title || '', data.level);

    const modules = (data.modules || []).map((m: any, mIdx: number) => {
      // Progressive difficulty: Module 0 -> Easy, Module 1 -> Medium, Module 2+ -> Hard
      const moduleDifficulty: 'Easy' | 'Medium' | 'Hard' =
        mIdx === 0 ? 'Easy' : (mIdx === 1 ? 'Medium' : 'Hard');

      const lessons = (m.lessons || []).map((l: any, lIdx: number) => {
        let lessonVideos: any[] = [];
        if (Array.isArray(l.videos) && l.videos.length > 0) {
          lessonVideos = l.videos.map((v: any) => ({
            url: typeof v === 'string' ? v : v.url,
            title: v.title || l.title,
          }));
        } else if (availableVideos.length > 0 && videoIndex < availableVideos.length) {
          lessonVideos = [availableVideos[videoIndex++ % availableVideos.length]];
        }

        let lessonResources: any[] = [];
        if (Array.isArray(l.resources) && l.resources.length > 0) {
          lessonResources = l.resources.map((r: any) => ({
            url: typeof r === 'string' ? r : r.url,
            label: r.label || r.title || 'Official Documentation',
            type: r.type || 'Documentation',
          }));
        } else if (availableDocs.length > 0 && docIndex < availableDocs.length) {
          const doc = availableDocs[docIndex++ % availableDocs.length];
          lessonResources = [{
            url: doc.url,
            label: doc.title,
            type: 'Documentation',
          }];
        }

        const durationMinutes = Number(l.durationMinutes) || (mIdx === 0 ? 20 : (mIdx === 1 ? 35 : 50));

        return {
          id: uuidv4(),
          title: l.title || `Lesson ${lIdx + 1}`,
          description: l.description || 'Lesson overview and fundamental principles.',
          durationMinutes,
          videos: lessonVideos,
          audios: [],
          resources: lessonResources,
        };
      });

      const createdLessonIds = lessons.map((l: any) => l.id);
      const lessonTitles = lessons.map((l: any) => l.title);

      // Logical assignment timer duration based on module level
      const timerDays = moduleDifficulty === 'Easy' ? 3 : (moduleDifficulty === 'Medium' ? 5 : 7);

      const assignments = (m.assignments || []).map((a: any, aIdx: number) => {
        // Detailed 5-point instruction guidelines
        const instructions = (a.body && a.body.length > 150 && a.body.includes('\n'))
          ? a.body
          : buildDefaultAssignmentInstructions(m.title || `Module ${mIdx + 1}`, lessonTitles, moduleDifficulty);

        const questions = (a.questions || []).map((q: any, qIdx: number) => {
          // Direct dependency on specific lesson:
          // Question 1 -> Lesson 1, Question 2 -> Lesson 2, Question 3 -> Lesson 2 or 3
          let targetLessonIndex = qIdx;
          if (typeof q.targetLessonIndex === 'number' && q.targetLessonIndex >= 0 && q.targetLessonIndex < createdLessonIds.length) {
            targetLessonIndex = q.targetLessonIndex;
          } else if (targetLessonIndex >= createdLessonIds.length) {
            targetLessonIndex = createdLessonIds.length - 1;
          }
          const specificLessonId = createdLessonIds[targetLessonIndex] || createdLessonIds[0];

          // Point allocation according to difficulty
          const defaultPoints = moduleDifficulty === 'Easy' ? 10 : (q.type === 'Subjective' ? 20 : 15);
          const maxPoints = Number(q.maxPoints) || defaultPoints;

          return {
            id: uuidv4(),
            text: q.text || `Question ${qIdx + 1}`,
            type: q.type === 'Subjective' ? 'Subjective' : 'MCQ',
            maxPoints,
            options: q.type !== 'Subjective' ? (Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']) : undefined,
            correctIndex: q.type !== 'Subjective' ? (Number(q.correctIndex) || 0) : undefined,
            expectedAnswerGuideline: q.expectedAnswerGuideline || (q.type === 'Subjective' ? 'Comprehensive answer referencing key architecture and practical commands.' : undefined),
            requiresLessonGrounding: true,
            lessonDependencies: specificLessonId ? [specificLessonId] : createdLessonIds,
          };
        });

        const hasMcq = questions.some((q: any) => q.type === 'MCQ');
        const hasSub = questions.some((q: any) => q.type === 'Subjective');
        const assignmentType = hasMcq && hasSub ? 'Hybrid' : (hasSub ? 'Subjective' : 'MCQ');

        return {
          id: uuidv4(),
          title: a.title || `Module ${mIdx + 1} Assessment (${moduleDifficulty})`,
          body: instructions,
          assignmentType,
          difficultyLevel: moduleDifficulty,
          questions,
          dependsOnLessonIds: createdLessonIds,
          lockConfig: { enabled: true },
          evaluation: {
            autoEvaluateWithAI: true,
            humanInterventionRequired: true,
          },
          timerDuration: { days: timerDays, hours: 0, minutes: 0 },
          countdownStart: 'taskUnlocked',
        };
      });

      return {
        id: uuidv4(),
        title: m.title || `Module ${mIdx + 1}`,
        description: m.description || '',
        sequentialModuleLock: true,
        sequentialLessonLock: true,
        learningObjectives: m.learningObjectives || [],
        learningOutcomes: m.learningOutcomes || [],
        lessons,
        assignments,
      };
    });

    return {
      title: data.title || 'Untitled Learning Path',
      description: data.description || 'Comprehensive curriculum generated by AI Assistant.',
      level: resolvedLpLevel,
      status: 'ai_draft', // Critical: saved as ai_draft
      origin: 'ai',
      imageUrl: chosenThumbnail,
      skillsTags: Array.isArray(data.skillsTags) && data.skillsTags.length > 0 ? data.skillsTags : ['Curriculum', 'Learning Path'],
      modules,
    };
  }
}
