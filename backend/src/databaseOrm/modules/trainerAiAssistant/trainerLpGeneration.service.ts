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

    // 3. Prompt Groq for structured curriculum JSON
    const prompt = `You are an expert instructional designer and curriculum architect.
Create a complete, high-quality, professional Learning Path curriculum titled: "${title}".
${webGroundingContext}
You MUST return ONLY a valid, parseable JSON object without markdown code fences, headers, or surrounding text.

Schema Requirements:
{
  "title": "${title}",
  "description": "2-3 comprehensive sentences explaining the goals and target outcome of this learning path.",
  "level": "Intermediate",
  "skillsTags": ["Skill1", "Skill2", "Skill3", "Skill4"],
  "modules": [
    {
      "title": "Module 1: Title",
      "description": "Module overview explaining core concepts.",
      "learningObjectives": ["Objective 1", "Objective 2"],
      "learningOutcomes": ["Outcome 1", "Outcome 2"],
      "lessons": [
        {
          "title": "Lesson 1: Title",
          "description": "Clear, comprehensive lesson content with explanations, best practices, and code concepts where appropriate (2-3 solid educational paragraphs).",
          "videos": [
            {
              "url": "https://www.youtube.com/watch?v=...",
              "title": "Video Tutorial"
            }
          ],
          "resources": [
            {
              "url": "https://...",
              "label": "Official Documentation",
              "type": "Documentation"
            }
          ]
        },
        {
          "title": "Lesson 2: Title",
          "description": "In-depth educational lesson content covering practical aspects and examples (2-3 solid educational paragraphs).",
          "videos": [
            {
              "url": "https://www.youtube.com/watch?v=...",
              "title": "Deep Dive Tutorial"
            }
          ],
          "resources": [
            {
              "url": "https://...",
              "label": "Reference Guide",
              "type": "Guide"
            }
          ]
        }
      ],
      "assignments": [
        {
          "title": "Module 1 Hands-On Assessment",
          "body": "Instructions: Complete the following questions to demonstrate your mastery of this module.",
          "questions": [
            {
              "text": "Practical question testing the concepts in Lesson 1",
              "type": "MCQ",
              "maxPoints": 10,
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctIndex": 0
            },
            {
              "text": "Explain in detail how to apply the core principle taught in Lesson 2.",
              "type": "Subjective",
              "maxPoints": 15,
              "expectedAnswerGuideline": "Clear explanation referencing key mechanisms and architectural reasons."
            }
          ]
        }
      ]
    },
    {
      "title": "Module 2: Advanced Concepts & Integration",
      "description": "Deeper exploration into real-world applications and workflows.",
      "learningObjectives": ["Objective 1", "Objective 2"],
      "learningOutcomes": ["Outcome 1", "Outcome 2"],
      "lessons": [
        {
          "title": "Lesson 1: In-depth Implementation",
          "description": "Detailed lesson content outlining practical architectural patterns and methodologies.",
          "videos": [
            {
              "url": "https://www.youtube.com/watch?v=...",
              "title": "Advanced Walkthrough"
            }
          ],
          "resources": [
            {
              "url": "https://...",
              "label": "Enterprise Best Practices",
              "type": "Article"
            }
          ]
        },
        {
          "title": "Lesson 2: Production Readiness & Troubleshooting",
          "description": "Detailed lesson content focusing on optimization, security, and enterprise standards.",
          "videos": [],
          "resources": []
        }
      ],
      "assignments": [
        {
          "title": "Module 2 Mastery Project",
          "body": "Instructions: Implement and demonstrate understanding of the advanced principles.",
          "questions": [
            {
              "text": "Scenario-based question on production best practices",
              "type": "MCQ",
              "maxPoints": 10,
              "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
              "correctIndex": 1
            },
            {
              "text": "Describe the troubleshooting steps and key metrics to monitor.",
              "type": "Subjective",
              "maxPoints": 15,
              "expectedAnswerGuideline": "Comprehensive answer identifying diagnostic commands and resolution steps."
            }
          ]
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. Generate 2 to 4 modules. Each module must contain 2 to 3 lessons and 1 assignment with 2 to 3 questions.
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
   * Performs live web search via Tavily for YouTube tutorial videos and authoritative documentation.
   */
  private async enrichFromWeb(title: string): Promise<{
    youtubeVideos: Array<{ title: string; url: string }>;
    docLinks: Array<{ title: string; url: string }>;
  }> {
    const apiKey = process.env.TAVILY_API_KEY;
    const youtubeVideos: Array<{ title: string; url: string }> = [];
    const docLinks: Array<{ title: string; url: string }> = [];

    if (!apiKey) {
      return { youtubeVideos, docLinks };
    }

    try {
      // 1. YouTube video search
      const ytRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: `${title} tutorial course site:youtube.com`,
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
      }
    } catch (e) {
      this.logger.warn(`Tavily YouTube search failed for "${title}": ${(e as Error).message}`);
    }

    try {
      // 2. Documentation and tutorial guides search
      const docRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: `${title} official documentation getting started guide`,
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
      }
    } catch (e) {
      this.logger.warn(`Tavily documentation search failed for "${title}": ${(e as Error).message}`);
    }

    return { youtubeVideos, docLinks };
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
  private prepareAuthoringPayload(data: any, webFindings?: { youtubeVideos: any[]; docLinks: any[] }): any {
    let videoIndex = 0;
    let docIndex = 0;
    const availableVideos = webFindings?.youtubeVideos || [];
    const availableDocs = webFindings?.docLinks || [];

    const modules = (data.modules || []).map((m: any, mIdx: number) => {
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

        return {
          id: uuidv4(),
          title: l.title || `Lesson ${lIdx + 1}`,
          description: l.description || 'Lesson overview and fundamental principles.',
          videos: lessonVideos,
          audios: [],
          resources: lessonResources,
        };
      });

      const createdLessonIds = lessons.map((l: any) => l.id);

      const assignments = (m.assignments || []).map((a: any, aIdx: number) => {
        const questions = (a.questions || []).map((q: any) => ({
          id: uuidv4(),
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
          id: uuidv4(),
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
      level: data.level || 'Intermediate',
      status: 'ai_draft', // Critical: saved as ai_draft
      origin: 'ai',
      skillsTags: Array.isArray(data.skillsTags) ? data.skillsTags : ['Curriculum', 'Learning Path'],
      modules,
    };
  }
}
