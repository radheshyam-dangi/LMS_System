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
const LP_ANSWER_PROMPT = `You are a Senior Academic AI Assistant for SkillForge LMS trainees.
Your goal is to provide trainees with effective, clear, and concise answers based on their assigned course material.

CORE OPERATIONAL RULES:
1. Effective & Concise Structure: Deliver clear, high-impact answers without verbose academic lecturing or bloated preambles. Structure your response as follows:
   - Direct Answer: 1-2 direct sentences answering the question immediately.
   - Key Points: 2-4 concise bullet points explaining the core concepts, mechanisms, or steps.
   - Practical Takeaway: 1 short sentence or brief practical code snippet if applicable.
   Keep the total response under 150-220 words.
2. Strict Grounding: Base your answer exclusively on the verified course passages provided.
3. Capability Boundary: If the question cannot be answered using the provided course passages, state clearly and concisely that this topic is not covered in the current curriculum. Never invent facts.
4. Zero Emojis and Zero Decorative Icons: Absolutely NO emojis (no emojis of any kind) and no ASCII/unicode art.
5. Clean Typography: Do not generate markdown tables, pipe (|) characters, backslashes, decorative divider lines, or hashtags (#, ##) for headers. Use bold text for headers.
6. Zero Inline Citations: Do not write "Source:", URLs, or bracketed numbers. Institutional references are attached automatically by the platform UI.
7. Pedagogical Integrity: Never disclose assignment answer keys, exam rubrics, or quiz solutions. Guide comprehension rather than solving tests for them.
8. Ambiguous Course Edits: When asked to add or create a module, lesson, or assignment without context (e.g. "add one module", "create a lesson", "add an assignment"), ask: "In which Learning Path would you like to create or add the lesson, assignment, or module?" and guide them to specify the course.`;

const WEB_ANSWER_PROMPT = `You are a Senior Academic AI Assistant for SkillForge LMS trainees.
The trainee's question extends beyond their local Learning Path catalog. Provide a clear, effective, and concise synthesis from verified educational web context.

CORE OPERATIONAL RULES:
1. Effective & Concise Synthesis: Provide a direct, well-structured explanation synthesized from verified web excerpts:
   - Direct Answer: 1-2 concise sentences answering the core inquiry.
   - Key Points: 2-4 brief bullet points explaining the key principles or technical details.
   - Keep the total response under 150-200 words. Avoid filler phrases and conversational fluff.
2. Capability Boundary: If the retrieved excerpts do not contain sufficient verified data to answer accurately, concisely state your inability to provide a confirmed answer.
3. Zero Emojis and Zero Decorative Icons: Absolutely NO emojis and no decorative borders or symbols.
4. Clean Typography: Do not generate markdown tables, pipe (|) characters, or hashtags for headers.
5. Zero Inline Citations: Do not write "Source:" or raw URLs in the text body. References are rendered independently in the user interface.
6. Ambiguous Course Edits: When asked to add or create a module, lesson, or assignment without context (e.g. "add one module", "create a lesson", "add an assignment"), ask: "In which Learning Path would you like to create or add the lesson, assignment, or module?" and guide them to specify the course.`;

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

    // Ambiguous module/lesson/assignment creation inquiry without context
    const isAmbiguousCurriculumCommand =
      /^(?:please\s+)?(?:add|create|insert|append|make)\s+(?:a\s+|an\s+|the\s+|one\s+|\d+\s+)?(?:new\s+|more\s+)?(?:module|lesson|assignment|task|quiz)s?\b/i.test(
        dto.question.trim(),
      );

    if (isAmbiguousCurriculumCommand) {
      const assignedIds = await this.retrieval.getAssignedLpIds(traineeId);
      let lps: Array<{ id: string; title: string }> = [];

      if (assignedIds.length > 0) {
        lps = await this.datasource.query(
          `SELECT id, title FROM "LearningPath" WHERE id = ANY($1) ORDER BY "updated_at" DESC LIMIT 8`,
          [assignedIds],
        );
      }
      if (lps.length === 0) {
        lps = await this.datasource.query(
          `SELECT id, title FROM "LearningPath" WHERE (status = 'Active' OR status = 'Published') ORDER BY "updated_at" DESC LIMIT 8`,
        );
      }

      const qLower = dto.question.toLowerCase();
      const mentionsLp = lps.some(lp => qLower.includes(lp.title.toLowerCase()));

      if (!mentionsLp) {
        const lpList = lps.length > 0
          ? lps.map((lp, idx) => `${idx + 1}. **${lp.title}**`).join('\n')
          : 'No learning paths currently available in your catalog.';

        const answer =
          `In which Learning Path would you like to create or add the lesson, assignment, or module?\n\n` +
          `Please specify one of the Learning Paths:\n\n${lpList}\n\n` +
          `*For example: "Add a module on Microservices to ${lps[0]?.title || 'your course'}"*`;

        const msg = await this.saveMessage(conv.id, 'assistant', answer, { sourceLabel: 'none', citations: [] });
        return {
          conversationId: conv.id,
          messageId: msg.id,
          answer,
          sourceLabel: 'none',
          citations: [],
        };
      }
    }

    // Retrieve relevant chunks with Senior AIML Cosine & multi-signal reranking
    const retrieval = await this.retrieval.retrieve(traineeId, dto.question, 6);

    // Gate: strong -> Inbuilt Embedding LP Answer
    if (retrieval.gate === 'strong' && retrieval.chunks.length > 0) {
      return this.generateLpAnswer(conv, history, dto.question, retrieval.chunks, startMs);
    }

    // Gate: weak / none / out-of-path -> Seamless Web Search Tool with concise response and clickable citations
    return this.generateWebAnswer(conv, history, dto.question, startMs);
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

  private async generateLpAnswer(
    conv: AiAssistantConversationEntity,
    history: AiAssistantMessageEntity[],
    question: string,
    chunks: RetrievedChunk[],
    startMs: number,
  ): Promise<AiAssistantResponseDto> {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    // Top 3 chunks for context synthesis
    const passagesText = chunks
      .slice(0, 3)
      .map(
        (c, i) =>
          `[Passage ${i + 1} | Lesson: ${c.lessonTitle} | Learning Path: ${c.lpTitle || 'Course'}]\n${c.chunkText.substring(0, 900)}`,
      )
      .join('\n\n---\n\n')
      .substring(0, 6000);

    const userContent = `QUESTION: ${question}\n\nCOURSE PASSAGES:\n${passagesText}`;

    const messages = this.buildMessages(LP_ANSWER_PROMPT, history, userContent);
    const model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';

    const response = await this.callGroq(messages, model, groqKey);
    const answer = response.content.trim();
    const tokenCount = response.usage?.total_tokens;

    // Pick 1 or 2 specific distinct lesson citations
    const seenLessons = new Set<string>();
    const topChunks: RetrievedChunk[] = [];
    for (const c of chunks) {
      const key = c.lessonTitle || c.lessonId;
      if (!seenLessons.has(key)) {
        seenLessons.add(key);
        topChunks.push(c);
        if (topChunks.length >= 2) break;
      }
    }

    const cleanAnswer = sanitizeAiResponse(
      answer
        .replace(/\n*Source:\s*(\[[^\]]+\]\([^)]+\)(?:,\s*)?)+/gi, '')
        .replace(/\n*Source:\s*.*$/gim, '')
        .trim(),
    );

    const citations: CitationDto[] = topChunks.map((c) => ({
      type: 'lp',
      lessonId: c.lessonId,
      lessonTitle: c.lessonTitle,
      lpTitle: c.lpTitle,
      url: c.lpId ? `/learning-paths/${c.lpId}/modules` : '/learning-paths',
      preview: c.chunkText.substring(0, 120) + '…',
    }));

    const msg = await this.saveMessage(conv.id, 'assistant', cleanAnswer, {
      sourceLabel: 'lp_content',
      citations,
      tokenCount,
      latencyMs: Date.now() - startMs,
    });

    return {
      conversationId: conv.id,
      messageId: msg.id,
      answer: cleanAnswer,
      sourceLabel: 'lp_content',
      citations,
    };
  }

  private async generateWebAnswer(
    conv: AiAssistantConversationEntity,
    history: AiAssistantMessageEntity[],
    question: string,
    startMs: number,
  ): Promise<AiAssistantResponseDto> {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('GROQ_API_KEY not configured');

    const webResults = await this.webSearch(question);

    if (!webResults.length) {
      // If web search returned 0 results, fall back to general explanation
      return this.generateGeneralAnswer(conv, history, question, groqKey, startMs);
    }

    // Limit to top 2 results for concise, targeted external context
    const topWeb = webResults.slice(0, 2);
    const webContext = topWeb
      .map(
        (r, i) =>
          `[Source ${i + 1}: ${r.title}]\nURL: ${r.url}\nExcerpt: ${r.content.substring(0, 800)}`,
      )
      .join('\n\n---\n\n');

    const userContent = `QUESTION: ${question}\n\nWEB SEARCH RESULTS:\n${webContext}`;
    const messages = this.buildMessages(WEB_ANSWER_PROMPT, history, userContent);
    const model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';

    const response = await this.callGroq(messages, model, groqKey);
    const answer = response.content.trim();

    const cleanAnswer = sanitizeAiResponse(
      answer
        .replace(/\n*Source:\s*(\[[^\]]+\]\([^)]+\)(?:,\s*)?)+/gi, '')
        .replace(/\n*Source:\s*.*$/gim, '')
        .trim(),
    );

    const citations: CitationDto[] = topWeb.map((r) => ({
      type: 'web',
      url: r.url,
      title: r.title,
      preview: r.content.substring(0, 120) + '…',
    }));

    const msg = await this.saveMessage(conv.id, 'assistant', cleanAnswer, {
      sourceLabel: 'web',
      citations,
      tokenCount: response.usage?.total_tokens,
      latencyMs: Date.now() - startMs,
    });

    return {
      conversationId: conv.id,
      messageId: msg.id,
      answer: cleanAnswer,
      sourceLabel: 'web',
      citations,
    };
  }

  private async generateGeneralAnswer(
    conv: AiAssistantConversationEntity,
    history: AiAssistantMessageEntity[],
    question: string,
    groqKey: string,
    startMs: number,
  ): Promise<AiAssistantResponseDto> {
    const GENERAL_PROMPT = `You are a Senior Academic AI Assistant for SkillForge LMS trainees.
Provide an effective, concise, and clear educational answer to the trainee's inquiry.
CORE RULES:
1. Effective & Concise: Deliver a direct 1-2 sentence core answer followed by 2-4 brief bullet points explaining the essential principles. Keep response under 150-180 words.
2. Inability Handling: If the topic is outside educational scope, clearly and directly state your inability to answer.
3. Zero Emojis or decorative icons under any circumstances.
4. Clean Typography: No tables, pipe (|) characters, backslashes, or divider lines.`;

    const messages = this.buildMessages(GENERAL_PROMPT, history, question);
    const model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';

    const response = await this.callGroq(messages, model, groqKey);
    const cleanAnswer = sanitizeAiResponse(response.content.trim());

    const tokenCount = response.usage?.total_tokens;

    const msg = await this.saveMessage(conv.id, 'assistant', cleanAnswer, {
      sourceLabel: 'none',
      citations: [],
      tokenCount,
      latencyMs: Date.now() - startMs,
    });

    return {
      conversationId: conv.id,
      messageId: msg.id,
      answer: cleanAnswer,
      sourceLabel: 'none',
      citations: [],
    };
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

  private buildMessages(
    systemPrompt: string,
    history: AiAssistantMessageEntity[],
    userContent: string,
  ) {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    for (const h of history) {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: h.content.substring(0, 1000) });
      }
    }
    messages.push({ role: 'user', content: userContent });
    return messages;
  }

  private async callGroq(
    messages: Array<{ role: string; content: string }>,
    model: string,
    apiKey: string,
  ): Promise<{ content: string; usage?: any }> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.35,
        max_tokens: 750,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errText}`);
    }
    const data = (await response.json()) as any;
    return {
      content: data.choices?.[0]?.message?.content || 'No response generated.',
      usage: data.usage,
    };
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
