import { Injectable, Logger } from '@nestjs/common';
import { PostgresMcpService, TraineesQueryResult } from './postgres-mcp.service';

export interface ExtractedTraineeParams {
  status: 'all' | 'active' | 'inactive';
  search?: string;
  limit: number;
  isCountOnly: boolean;
}

@Injectable()
export class McpBridgeService {
  private readonly logger = new Logger(McpBridgeService.name);

  constructor(private readonly postgresMcpService: PostgresMcpService) { }

  /**
   * Deprecated intent check: Retained for backward-compatibility.
   * LLM ReAct agent autonomously selects the 'query_database_trainees' tool natively.
   */
  isTraineeInquiry(message: string): boolean {
    const normalized = (message || '').toLowerCase().trim();
    return /\btrainees?\b/i.test(normalized);
  }

  /**
   * Intelligently extracts structured query parameters (status, search keywords, limits, count-only)
   * from natural language trainer inquiries.
   */
  extractTraineeQueryParams(question: string): ExtractedTraineeParams {
    const lower = question.toLowerCase().trim();

    // 1. Status extraction (active vs inactive vs all)
    let status: 'all' | 'active' | 'inactive' = 'all';
    if (
      /\b(?:active|currently\s+active|online|ongoing|enabled|studying|learning)\b/i.test(lower) &&
      !/\binactive\b/i.test(lower)
    ) {
      status = 'active';
    } else if (
      /\b(?:inactive|disabled|suspended|deactivated|dormant|dropped(?:\s+out)?|idle|left)\b/i.test(lower)
    ) {
      status = 'inactive';
    }

    // 2. Numeric limit extraction (e.g. 'top 5', 'first 10', 'show 20 trainees')
    let limit = 50;
    const limitMatch =
      lower.match(/\b(?:top|first|limit|give\s+me|show)\s+(\d{1,3})\b/i) ||
      lower.match(/\b(\d{1,3})\s+(?:trainees?|students?|learners?)\b/i);
    if (limitMatch && limitMatch[1]) {
      const parsed = parseInt(limitMatch[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 100);
      }
    }

    // 3. Search keyword / trainee name / email extraction (e.g. 'named Alex', 'catherine@ethereal.email')
    let search: string | undefined = undefined;
    const nameMatch =
      lower.match(/\b(?:named|name|keyword|called)\s+['"]?([a-zA-Z0-9._-]+)['"]?/i) ||
      lower.match(/\b(?:search(?:ing)?(?:\s+for)?|find|look\s*up)\s+(?:trainee|student|learner)\s+['"]?([a-zA-Z0-9._-]+)['"]?/i) ||
      lower.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i);

    if (nameMatch && nameMatch[1]) {
      const rawTerm = nameMatch[1].trim();
      const STOP_WORDS = new Set([
        'all',
        'the',
        'trainee',
        'trainees',
        'student',
        'students',
        'learner',
        'learners',
        'user',
        'users',
        'system',
        'database',
        'db',
        'active',
        'inactive',
        'in',
        'on',
        'for',
      ]);
      if (!STOP_WORDS.has(rawTerm.toLowerCase())) {
        search = rawTerm;
      }
    }

    // 4. Count-only flag (e.g. 'how many trainees are there', 'total count of students')
    const isCountOnly = /\b(?:how\s+many|count\s+of|number\s+of|total\s+count|headcount)\b/i.test(lower);

    return { status, limit, search, isCountOnly };
  }

  /**
   * Handles a trainee inquiry by extracting query parameters, invoking the FastMCP Postgres tool,
   * feeding the resulting JSON to the LLM, and reframing it into an engaging, structured list.
   */
  async handleTraineeInquiry(
    question: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  ): Promise<string> {
    // 1. Intelligently extract parameters from natural language
    const { status, limit, search, isCountOnly } = this.extractTraineeQueryParams(question);

    this.logger.log(
      `Invoking FastMCP get_trainee_users tool with params: status="${status}", search="${search || 'none'}", limit=${limit}, countOnly=${isCountOnly}`,
    );

    // 2. Execute FastMCP Tool to fetch PostgreSQL data in JSON format
    const toolResult: TraineesQueryResult = await this.postgresMcpService.executeTool('get_trainee_users', {
      status,
      search,
      limit,
    });

    // 3. Reframe JSON with LLM into a conversational, formatted response
    return await this.reframeWithLlm(question, toolResult, history, { isCountOnly, search });
  }

  /**
   * Dual-pass Tool Calling Execution via Groq / OpenAI:
   * Passes MCP tools into LLM chat completions and executes tool calls if returned.
   */
  async processChatWithTools(
    question: string,
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  ): Promise<{ answer: string; toolUsed?: string }> {
    const groqKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';

    if (!groqKey) {
      // Fallback directly to trainee inquiry handler
      if (this.isTraineeInquiry(question)) {
        const answer = await this.handleTraineeInquiry(question, history);
        return { answer, toolUsed: 'get_trainee_users' };
      }
      return { answer: 'AI Assistant is currently operating in offline mode.' };
    }

    const tools = this.postgresMcpService.getToolsForLlm();
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: question },
    ];

    try {
      // Pass 1: Call LLM with FastMCP tools
      const firstResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.3,
          max_tokens: 1200,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!firstResponse.ok) {
        throw new Error(`Groq tool completion error: HTTP ${firstResponse.status}`);
      }

      const firstData = (await firstResponse.json()) as any;
      const choice = firstData.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;

      // If model triggered a tool call
      if (toolCalls && toolCalls.length > 0) {
        const toolCall = toolCalls[0];
        const functionName = toolCall.function?.name;
        let functionArgs = {};
        try {
          functionArgs = JSON.parse(toolCall.function?.arguments || '{}');
        } catch { }

        this.logger.log(`LLM decided to call MCP tool: ${functionName}`);

        // Execute tool through FastMCP
        const toolOutput = await this.postgresMcpService.executeTool(functionName, functionArgs);

        // Pass 2: Send tool output back to LLM to reframe response into conversational list
        const secondMessages = [
          ...messages,
          choice.message,
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: functionName,
            content: JSON.stringify(toolOutput),
          },
        ];

        const secondResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            messages: secondMessages,
            temperature: 0.3,
            max_tokens: 1200,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (secondResponse.ok) {
          const secondData = (await secondResponse.json()) as any;
          const content = secondData.choices?.[0]?.message?.content?.trim();
          if (content) {
            return { answer: content, toolUsed: functionName };
          }
        }
      }

      // If model answered directly without tool calls
      if (choice?.message?.content?.trim()) {
        return { answer: choice.message.content.trim() };
      }
    } catch (err) {
      this.logger.warn(`Tool calling loop encountered error: ${(err as Error).message}. Falling back.`);
    }

    // Fallback: If tool inquiry was intended, execute directly
    if (this.isTraineeInquiry(question)) {
      const answer = await this.handleTraineeInquiry(question, history);
      return { answer, toolUsed: 'get_trainee_users' };
    }

    return { answer: 'I was unable to retrieve that information right now. Please try again.' };
  }

  /**
   * Reframes the tool JSON response into a formatted, visualized markdown list
   */
  private async reframeWithLlm(
    question: string,
    toolResult: TraineesQueryResult,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: { isCountOnly?: boolean; search?: string },
  ): Promise<string> {
    const groqKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';

    if (toolResult.totalCount === 0) {
      if (options?.search) {
        return (
          `**Trainee Directory Search**\n\n` +
          `No registered users with the **Trainee** role were found matching "${options.search}" in the PostgreSQL database.`
        );
      }
      return (
        `**Trainee Directory**\n\n` +
        `No registered users with the **Trainee** role were found matching your criteria in the PostgreSQL database.`
      );
    }

    if (groqKey) {
      const countGuidance = options?.isCountOnly
        ? `\n- The trainer specifically asked for a count/quantity. Highlight the total count and active/inactive breakdown prominently at the beginning.`
        : '';
      const searchGuidance = options?.search
        ? `\n- The trainer searched for a specific keyword/name ("${options.search}"). State clearly that these results match the search for "${options.search}".`
        : '';

      const systemPrompt = `You are the Senior Curriculum & Faculty Assistant in an enterprise Learning Management System.
You have just received real-time PostgreSQL database records about users who have the "Trainee" role via the FastMCP Postgres tool.

TASK:
Reframe the provided JSON data into a clean, professional, and visually engaging response.

STRICT FORMATTING & PRIVACY RULES:
1. NEVER output or invent database IDs, UUIDs, or hashes. Users must be identified strictly by their Name and Email.
2. Present the trainees in a structured Markdown list with:
   - Full Name in bold
   - Status badge (e.g. \`Active\` or \`Inactive\`)
   - Email address
   - Number of enrolled courses / learning paths
   - Join Date
3. Include an executive summary at the top stating the total count of trainees, along with active and inactive breakdowns.${countGuidance}${searchGuidance}
4. Conclude with a helpful, context-relevant follow-up prompt (e.g., offering to inspect an enrolled learning path or assign training).
5. Do NOT use markdown heading hashtags (#, ##). Use bold section titles instead (e.g. **Registered Trainees**).
6. Do NOT use decorative emojis, pictograms, or table pipes. Use clean bullet points (- ) and backticks.`;

      const userPrompt = `ORIGINAL TRAINER QUESTION: "${question}"
POSTGRES MCP TOOL RESPONSE (JSON):
${JSON.stringify(toolResult, null, 2)}`;

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
              { role: 'system', content: systemPrompt },
              ...history.slice(-4).map((h) => ({ role: h.role, content: h.content })),
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 1200,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
          const resData = (await response.json()) as any;
          const content = resData.choices?.[0]?.message?.content?.trim();
          if (content) {
            return content;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to reframe trainees with LLM: ${(err as Error).message}. Using deterministic fallback.`);
      }
    }

    // Deterministic High-Quality Fallback (Used if LLM is offline or fails)
    return this.buildDeterministicTraineeList(toolResult, options);
  }

  /**
   * Deterministic clean list formatting when LLM API is unavailable
   */
  private buildDeterministicTraineeList(
    result: TraineesQueryResult,
    options?: { isCountOnly?: boolean; search?: string },
  ): string {
    const { totalCount, activeCount, inactiveCount, trainees } = result;

    const searchNotice = options?.search ? ` matching "${options.search}"` : '';
    const summaryLine = `**Trainee Roster**\n\nFound **${totalCount} registered trainee${totalCount === 1 ? '' : 's'
      }**${searchNotice} (${activeCount} active, ${inactiveCount} inactive):\n\n`;

    const listItems = trainees
      .map((t, idx) => {
        const statusBadge = t.isActive ? '`Active`' : '`Inactive`';
        const enrollText = t.enrolledPathsCount === 1 ? '1 course' : `${t.enrolledPathsCount} courses`;
        return `${idx + 1}. **${t.fullName}** - ${statusBadge}\n   - Email: ${t.email}\n   - Enrolled: ${enrollText}\n   - Joined: ${t.joinedDate}`;
      })
      .join('\n\n');

    const footer = `\n\n*To view a specific trainee's curriculum progress or assign a Learning Path, let me know the course title or student name.*`;

    return summaryLine + listItems + footer;
  }
}

