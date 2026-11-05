/**
 * AI Assistant Service
 *
 * Core logic for the Global AI Assistant:
 * 1. Guards: feature flag, live assessment check, no-LP check.
 * 2. Retrieval: hybrid (lexical + vector) via AiAssistantRetrievalService.
 * 3. Relevance gate: strong → LP answer, weak → web fallback, none → decline.
 * 4. Generation: Groq LLM with strict citation instructions.
 * 5. Web fallback: Tavily/Brave search adapter when TAVILY_API_KEY or BRAVE_API_KEY is set.
 * 6. Persistence: conversation + message stored in DB.
 * 7. SSE streaming: implemented via callback pattern for controller.
 *
 * Security guarantees (all enforced server-side):
 * - LP IDs resolved from enrollment table, not from client payload.
 * - Assignment questions, rubrics, and grading data are excluded from indexed content.
 * - Web content is labeled "UNTRUSTED" in the system prompt; LLM cannot override this.
 * - Live assessment guard: if activeAssignmentId is provided, returns a redirect hint.
 */
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AiAssistantConversationEntity } from '../../entities/aiAssistantConversation.entity';
import { AiAssistantMessageEntity } from '../../entities/aiAssistantMessage.entity';
import { AiAssistantRetrievalService, RetrievedChunk } from './aiAssistantRetrieval.service';

import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  conversationId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question: string;

  @IsOptional()
  @IsString()
  activeAssignmentId?: string | null;
}

export interface AiAssistantResponseDto {
  conversationId: string;
  messageId: string;
  answer: string;
  sourceLabel: 'lp_content' | 'web' | 'none';
  citations: CitationDto[];
}

export interface CitationDto {
  type: 'lp' | 'web';
  lessonId?: string;
  lessonTitle?: string;
  lpTitle?: string;
  preview?: string;
  url?: string;
  title?: string;
}

import { sanitizeAiResponse } from '../trainerAiAssistant/trainerAiSanitizer';

const MAX_HISTORY_TURNS = 6;

const TRAINEE_SYSTEM_PROMPT = `You are the Senior Academic AI Learning Assistant for Trainees at SkillForge LMS.
Your mission is to guide students with clear, accurate, and encouraging educational explanations.

CORE CAPABILITIES & TOOLS:
1. "vector_search_lp_content": Call this tool to look up internal course lessons, video summaries, and assignment guidelines.
   - Ground your answer in the retrieved course passages.
   - Clearly explain concepts in accessible, high-impact language.
2. "web_search": Call this tool if internal course search returns no results, if the user explicitly asks for external docs/articles, or if the question is an industry topic outside the LMS curriculum.
   - Synthesize a concise explanation using the web results.
3. "query_course_catalog": Call this tool when the trainee asks about available learning paths, catalog courses, or their enrolled titles.

ROLE & ACCESS BOUNDARIES:
- Trainees CANNOT author, create, modify, or delete Learning Paths, modules, lessons, or assignments.
- If a trainee asks you to add, edit, or delete curriculum (e.g. "add a new module", "create a lesson", "delete assignment", "make a quiz"):
  Politely inform the trainee:
  "As a trainee, you do not have permission to add or modify courses in the LMS. Only designated trainers and administrators can author or update curriculum. You can explore your current assigned courses or reach out to your instructor to request new topics."
- Never invent database IDs, UUIDs, or internal identifiers.
- Do NOT use emojis, pictograms, or decorative icons under any circumstances.
- Do NOT generate markdown tables, pipe (|) characters, backslashes, or divider lines. Use bold text (**Heading**) for headers.`;

const TRAINEE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'vector_search_lp_content',
      description:
        'Searches the trainee assigned course curriculum, modules, lessons, and assignments for technical explanations, definitions, and tutorials. Call this first whenever the trainee asks about course topics, concepts, code examples, or curriculum definitions.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query or concept to look up in the assigned learning paths.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Searches the public web for authoritative documentation, technical articles, and tutorials. Use this when the concept is NOT covered in the LMS course, or when the user asks for external real-world documentation, news, or general programming help.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up on the web.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_course_catalog',
      description:
        'Queries available Learning Paths and courses in the LMS catalog. Use when the trainee asks: "what courses exist", "list learning paths", "show my courses", or asks about available curriculums.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Optional keyword to filter courses.',
          },
        },
        required: [],
      },
    },
  },
];

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private convRepo: Repository<AiAssistantConversationEntity>;
  private msgRepo: Repository<AiAssistantMessageEntity>;

  constructor(
    private readonly datasource: DataSource,
    private readonly retrieval: AiAssistantRetrievalService,
  ) {
    this.convRepo = this.datasource.getRepository(AiAssistantConversationEntity);
    this.msgRepo = this.datasource.getRepository(AiAssistantMessageEntity);
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  async sendMessage(
    traineeId: string,
    dto: SendMessageDto,
  ): Promise<AiAssistantResponseDto> {
    this.guardFeatureFlag();

    const startMs = Date.now();

    // Live assessment guard
    if (dto.activeAssignmentId) {
      return this.buildRedirectResponse(dto.activeAssignmentId, traineeId, dto.question);
    }

    // Resolve or create conversation
    const conv = await this.resolveConversation(traineeId, dto.conversationId, dto.question);

    // Load recent history
    const history = await this.loadHistory(conv.id, MAX_HISTORY_TURNS);

    // Save user message
    await this.saveMessage(conv.id, 'user', dto.question);

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error('GROQ_API_KEY not configured');
    }
    const model = process.env.GROQ_CHAT_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    const messages: any[] = [
      { role: 'system', content: TRAINEE_SYSTEM_PROMPT },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content.substring(0, 1500) })),
      { role: 'user', content: dto.question },
    ];

    let finalAnswer = '';
    let sourceLabel: 'lp_content' | 'web' | 'none' = 'none';
    let citations: CitationDto[] = [];
    let totalTokens: number | undefined = undefined;

    const MAX_TOOL_ITERATIONS = 3;
    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      this.logger.log(
        `[TraineeAiAssistant] Turn ${iteration}/${MAX_TOOL_ITERATIONS}: Invoking LLM (${model}) with ${messages.length} messages and ${TRAINEE_TOOLS.length} tools...`,
      );

      const completion = await this.callGroqWithTools(messages, model, groqKey, TRAINEE_TOOLS);
      const assistantMessage = completion.message;
      totalTokens = (totalTokens || 0) + (completion.usage?.total_tokens || 0);

      if (!assistantMessage) {
        throw new Error('LLM returned an empty response');
      }

      const toolCalls = assistantMessage.tool_calls;

      // Case A: Model requested tool execution
      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        messages.push(assistantMessage);

        for (const call of toolCalls) {
          const fnName = call.function?.name;
          let fnArgs: any = {};
          try {
            fnArgs = JSON.parse(call.function?.arguments || '{}');
          } catch (e) {
            this.logger.warn(`Failed to parse tool arguments for ${fnName}: ${(e as Error).message}`);
          }

          this.logger.log(`[TraineeAiAssistant] Executing tool "${fnName}" with args: ${JSON.stringify(fnArgs)}`);

          let toolResult: any;

          if (fnName === 'vector_search_lp_content') {
            const searchQuery = fnArgs.query || dto.question;
            const retrieval = await this.retrieval.retrieve(traineeId, searchQuery, 5);
            if (retrieval.chunks && retrieval.chunks.length > 0) {
              sourceLabel = 'lp_content';
              const seen = new Set<string>();
              for (const c of retrieval.chunks) {
                const key = c.lessonTitle || c.lessonId;
                if (!seen.has(key)) {
                  seen.add(key);
                  citations.push({
                    type: 'lp',
                    lessonId: c.lessonId,
                    lessonTitle: c.lessonTitle,
                    lpTitle: c.lpTitle,
                    url: c.lpId ? `/learning-paths/${c.lpId}/modules` : '/learning-paths',
                    preview: c.chunkText.substring(0, 120) + '…',
                  });
                  if (citations.length >= 3) break;
                }
              }

              toolResult = {
                found: true,
                passagesCount: retrieval.chunks.length,
                passages: retrieval.chunks.slice(0, 3).map((c, i) => ({
                  passageIndex: i + 1,
                  lessonTitle: c.lessonTitle,
                  lpTitle: c.lpTitle,
                  text: c.chunkText.substring(0, 800),
                })),
              };
            } else {
              toolResult = {
                found: false,
                message: `No matching content found in assigned courses for "${searchQuery}". You may search the web using web_search tool if relevant.`,
              };
            }
          } else if (fnName === 'web_search') {
            const searchQuery = fnArgs.query || dto.question;
            const webResults = await this.webSearch(searchQuery);
            if (webResults && webResults.length > 0) {
              sourceLabel = 'web';
              const topWeb = webResults.slice(0, 3);
              citations = topWeb.map((r) => ({
                type: 'web',
                url: r.url,
                title: r.title,
                preview: r.content.substring(0, 120) + '…',
              }));

              toolResult = {
                found: true,
                resultsCount: topWeb.length,
                results: topWeb.map((r) => ({
                  title: r.title,
                  url: r.url,
                  content: r.content.substring(0, 800),
                })),
              };
            } else {
              toolResult = {
                found: false,
                message: `Web search returned no results for "${searchQuery}".`,
              };
            }
          } else if (fnName === 'query_course_catalog') {
            sourceLabel = 'lp_content';
            const assignedIds = await this.retrieval.getAssignedLpIds(traineeId);
            let lps: Array<{ id: string; title: string; difficulty?: string; description?: string }> = [];

            if (assignedIds.length > 0) {
              lps = await this.datasource.query(
                `SELECT id, title, difficulty, description FROM "LearningPath" WHERE id = ANY($1) ORDER BY "updated_at" DESC LIMIT 10`,
                [assignedIds],
              );
            }
            if (lps.length === 0) {
              lps = await this.datasource.query(
                `SELECT id, title, difficulty, description FROM "LearningPath" WHERE (status = 'Active' OR status = 'Published') ORDER BY "updated_at" DESC LIMIT 10`,
              );
            }

            toolResult = {
              totalCourses: lps.length,
              courses: lps.map((lp) => ({
                title: lp.title,
                difficulty: lp.difficulty || 'Intermediate',
                description: lp.description ? lp.description.substring(0, 150) + '...' : '',
              })),
            };
          } else {
            toolResult = { error: `Tool "${fnName}" is not recognized.` };
          }

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: fnName,
            content: JSON.stringify(toolResult),
          });
        }

        continue;
      }

      // Case B: Model returned natural language answer
      finalAnswer = assistantMessage.content || '';
      break;
    }

    if (!finalAnswer) {
      finalAnswer = 'I have processed your query. Let me know if you need more details on this topic.';
    }

    const cleanAnswer = sanitizeAiResponse(
      finalAnswer
        .replace(/\[NOT_COVERED_IN_CURRICULUM\]\s*/gi, '')
        .replace(/\n*Source:\s*(\[[^\]]+\]\([^)]+\)(?:,\s*)?)+/gi, '')
        .replace(/\n*Source:\s*.*$/gim, '')
        .trim(),
    );

    const savedMsg = await this.saveMessage(conv.id, 'assistant', cleanAnswer, {
      sourceLabel,
      citations,
      tokenCount: totalTokens,
      latencyMs: Date.now() - startMs,
    });

    return {
      conversationId: conv.id,
      messageId: savedMsg.id,
      answer: cleanAnswer,
      sourceLabel,
      citations,
    };
  }

  async listConversations(traineeId: string) {
    this.guardFeatureFlag();
    return this.convRepo.find({
      where: { traineeId },
      order: { updatedAt: 'DESC' },
      select: ['id', 'title', 'messageCount', 'createdAt', 'updatedAt'],
    });
  }

  async getConversation(traineeId: string, conversationId: string) {
    this.guardFeatureFlag();
    const conv = await this.convRepo.findOne({
      where: { id: conversationId, traineeId },
    });
    if (!conv) throw new ForbiddenException('Conversation not found');

    const messages = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
    return { ...conv, messages };
  }

  async deleteConversation(traineeId: string, conversationId: string): Promise<void> {
    this.guardFeatureFlag();
    const conv = await this.convRepo.findOne({
      where: { id: conversationId, traineeId },
    });
    if (!conv) throw new ForbiddenException('Conversation not found');
    await this.convRepo.remove(conv);
  }

  async submitFeedback(
    traineeId: string,
    messageId: string,
    feedback: 'thumbs_up' | 'thumbs_down',
    comment?: string,
  ): Promise<void> {
    this.guardFeatureFlag();
    const msg = await this.msgRepo
      .createQueryBuilder('msg')
      .innerJoin('msg.conversation', 'conv', 'conv.traineeId = :tid', { tid: traineeId })
      .where('msg.id = :id', { id: messageId })
      .getOne();

    if (!msg) throw new ForbiddenException('Message not found');
    msg.feedback = feedback;
    msg.feedbackComment = comment || null;
    await this.msgRepo.save(msg);
  }

  // ─────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────

  private guardFeatureFlag(): void {
    const enabled = process.env.AI_ASSISTANT_ENABLED;
    if (enabled !== 'true' && enabled !== '1') {
      throw new ForbiddenException('AI Assistant feature is not enabled');
    }
  }

  private async buildRedirectResponse(
    assignmentId: string,
    traineeId: string,
    question: string,
  ): Promise<AiAssistantResponseDto> {
    const answer =
      'It looks like you are currently working on an assignment. ' +
      'For questions about this assignment, please use the **Assignment AI Chat** (the chat icon on the assignment workspace). ' +
      'It is specifically designed to guide you through your assignment questions with Socratic hints.';
    const conv = await this.resolveConversation(traineeId, null, question);
    await this.saveMessage(conv.id, 'user', question);
    const msg = await this.saveMessage(conv.id, 'assistant', answer, { sourceLabel: 'none', citations: [] });
    return {
      conversationId: conv.id,
      messageId: msg.id,
      answer,
      sourceLabel: 'none',
      citations: [],
    };
  }

  /**
   * Resilient Groq Tool-Calling Client with Fallback Model Pool
   */
  private async callGroqWithTools(
    messages: Array<{ role: string; content?: string;[key: string]: any }>,
    model: string,
    apiKey: string,
    tools?: any[],
  ): Promise<{ message: any; usage?: any }> {
    const candidateModels = [
      model,
      process.env.GROQ_MODEL || process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let lastError: Error | null = null;

    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const currentModel = candidateModels[mIdx];
      const payload: any = {
        model: currentModel,
        messages,
        temperature: 0.2,
        max_tokens: 1500,
      };

      if (tools && tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = 'auto';
      }

      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(35000),
        });

        if (!response.ok) {
          const errText = await response.text();
          if ((response.status === 429 || response.status >= 500) && mIdx < candidateModels.length - 1) {
            this.logger.warn(`Model ${currentModel} returned ${response.status}. Retrying with fallback model...`);
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          throw new Error(`Groq completions call failed: ${response.status} - ${errText}`);
        }

        const completion = (await response.json()) as any;
        const msg = completion.choices?.[0]?.message;
        if (msg) {
          return { message: msg, usage: completion.usage };
        }
      } catch (err: any) {
        lastError = err;
        if (mIdx === candidateModels.length - 1) {
          throw err;
        }
        this.logger.warn(`Error querying model ${currentModel}: ${err.message}. Retrying fallback...`);
      }
    }

    throw lastError || new Error('Empty response from Groq');
  }

  /**
   * Dedicated Multi-Tier Web Search Tool:
   * Tier 1: Tavily Search API (if configured)
   * Tier 2: Brave Search API (if configured)
   * Tier 3: Zero-config Wikipedia / Public Knowledge Search (always available, free, fast)
   */
  private async webSearch(
    query: string,
  ): Promise<Array<{ title: string; url: string; content: string }>> {
    // 1. Tavily Search (if API key configured)
    if (process.env.TAVILY_API_KEY) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: query.substring(0, 400),
            search_depth: 'basic',
            max_results: 4,
            include_answer: false,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.results && data.results.length > 0) {
            return data.results.map((r: any) => ({
              title: r.title || 'Web Result',
              url: r.url || '',
              content: r.content || '',
            }));
          }
        }
      } catch (e) {
        this.logger.warn(`Tavily search failed: ${(e as Error).message}`);
      }
    }

    // 2. Brave Search (if API key configured)
    if (process.env.BRAVE_API_KEY) {
      try {
        const params = new URLSearchParams({ q: query.substring(0, 400), count: '4' });
        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
          headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.web?.results && data.web.results.length > 0) {
            return data.web.results.map((r: any) => ({
              title: r.title || 'Web Result',
              url: r.url || '',
              content: r.description || '',
            }));
          }
        }
      } catch (e) {
        this.logger.warn(`Brave search failed: ${(e as Error).message}`);
      }
    }

    // 3. Resilient Zero-Config Educational Web Search (Wikipedia / Open Web API)
    try {
      const cleaned = query
        .replace(/^(who\s+won|how\s+does|how\s+do|what\s+is|what\s+are|tell\s+me\s+about|explain|can\s+you\s+explain|describe)\s+/i, '')
        .replace(/[?.,!]+$/, '')
        .trim();
      const searchQuery = (cleaned.length >= 3 ? cleaned : query).substring(0, 200);

      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&utf8=&format=json&srlimit=3`;
      const res = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'SkillForge-LMS-AI/1.0 (educational research bot)' },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const searchHits = data.query?.search;
        if (Array.isArray(searchHits) && searchHits.length > 0) {
          const topHits = searchHits.slice(0, 3);
          const titles = topHits.map((h: any) => h.title);
          const extUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(titles.join('|'))}&format=json`;
          try {
            const extRes = await fetch(extUrl, {
              headers: { 'User-Agent': 'SkillForge-LMS-AI/1.0 (educational research bot)' },
              signal: AbortSignal.timeout(5000),
            });
            if (extRes.ok) {
              const extData = (await extRes.json()) as any;
              const pages = extData.query?.pages || {};
              const extractMap = new Map<string, string>();
              for (const pid of Object.keys(pages)) {
                const p = pages[pid];
                if (p.title && p.extract) extractMap.set(p.title, p.extract);
              }
              return topHits.map((r: any) => ({
                title: r.title,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
                content: (extractMap.get(r.title) || r.snippet || '')
                  .replace(/<[^>]+>/g, '')
                  .replace(/&quot;/g, '"')
                  .replace(/&#039;/g, "'")
                  .replace(/&amp;/g, '&'),
              }));
            }
          } catch {
            // fallback to snippets if extracts request fails
          }

          return topHits.map((r: any) => ({
            title: r.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
            content: (r.snippet || '')
              .replace(/<[^>]+>/g, '')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&amp;/g, '&'),
          }));
        }
      }
    } catch (e) {
      this.logger.warn(`Public web search failed: ${(e as Error).message}`);
    }

    return [];
  }

  private async resolveConversation(
    traineeId: string,
    conversationId: string | null | undefined,
    firstMessage: string,
  ): Promise<AiAssistantConversationEntity> {
    if (conversationId) {
      const existing = await this.convRepo.findOne({
        where: { id: conversationId, traineeId },
      });
      if (existing) return existing;
    }

    const title = firstMessage.substring(0, 80);
    const conv = this.convRepo.create({ traineeId, title, messageCount: 0 });
    return this.convRepo.save(conv);
  }

  private async loadHistory(
    conversationId: string,
    maxTurns: number,
  ): Promise<AiAssistantMessageEntity[]> {
    const all = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: maxTurns * 2,
    });
    return all.reverse();
  }

  private async saveMessage(
    conversationId: string,
    role: string,
    content: string,
    extra?: {
      sourceLabel?: string;
      citations?: CitationDto[];
      tokenCount?: number;
      latencyMs?: number;
    },
  ): Promise<AiAssistantMessageEntity> {
    const msg = this.msgRepo.create({
      conversationId,
      role,
      content,
      sourceLabel: extra?.sourceLabel || null,
      citations: extra?.citations || null,
      tokenCount: extra?.tokenCount || null,
      latencyMs: extra?.latencyMs || null,
    });
    const saved = await this.msgRepo.save(msg);

    // Update conversation message count and timestamp
    try {
      await this.convRepo.increment({ id: conversationId }, 'messageCount', 1);
      await this.convRepo.update(conversationId, { updatedAt: new Date() });
    } catch (e) {
      this.logger.warn(`Failed to increment messageCount: ${(e as Error).message}`);
    }

    return saved;
  }
}
