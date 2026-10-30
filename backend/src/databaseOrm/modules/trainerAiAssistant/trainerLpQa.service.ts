import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository, Not, In } from 'typeorm';
import { LearningPathEntity } from '../../entities/learningPath.entity';
import { sanitizeAiResponse, sanitizeTrainerQuery, findReferencedLp } from './trainerAiSanitizer';

export interface LpQaResponse {
  answer: string;
  count: number;
}

@Injectable()
export class TrainerLpQaService {
  private readonly logger = new Logger(TrainerLpQaService.name);
  private lpRepo: Repository<LearningPathEntity>;

  constructor(private readonly datasource: DataSource) {
    this.lpRepo = this.datasource.getRepository(LearningPathEntity);
  }

  /**
   * Senior Curriculum Architect Q&A:
   * Handles specific LP questions, cross-curriculum queries across all existing paths,
   * in-depth node queries (modules, lessons, videos, assignments), and indirect/strategic queries.
   */
  async handleQuery(
    trainerId: string,
    question: string,
    activePathId?: string | null,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  ): Promise<LpQaResponse> {
    const groqKey = process.env.GROQ_API_KEY;

    // 1. Fetch all Learning Paths in system with deep relations
    // (Published paths + trainer's drafts)
    const allPaths = await this.lpRepo.find({
      relations: [
        'modules',
        'modules.lessons',
        'modules.lessons.resources',
        'modules.assignments',
        'createdBy',
      ],
      order: { createdAt: 'DESC' },
    });

    // Filter paths accessible to trainer:
    // Only confirmed, published, active learning paths!
    // NEVER include ai_drafts, unconfirmed drafts, or deleted paths!
    const forbiddenStatuses = new Set(['ai_draft', 'draft', 'deleted', 'archived', 'unconfirmed']);
    const accessiblePaths = allPaths.filter(lp => {
      const st = String(lp.status || '').toLowerCase().trim();
      return !forbiddenStatuses.has(st);
    });

    if (accessiblePaths.length === 0) {
      return {
        answer:
          "There are currently no Learning Paths available in the catalog. You can create your first one by saying: `Create LP: [Course Title]`.",
        count: 0,
      };
    }

    // 2. Determine if the question targets a specific path
    // First, check if the question explicitly mentions any LP title in the catalog
    let targetPath = findReferencedLp(question, accessiblePaths);

    // If no course explicitly mentioned, fall back to the active Studio path
    if (!targetPath && activePathId) {
      targetPath = accessiblePaths.find(p => p.id === activePathId);
    }

    // If still not found, search recent history for context continuity
    if (!targetPath && history.length > 0) {
      const recentHistoryText = history
        .slice(-4)
        .map(h => h.content.toLowerCase())
        .join(' ');
      targetPath = findReferencedLp(recentHistoryText, accessiblePaths);
    }

    // 3. Build rich catalog context for the AI prompt
    const catalogSummary = accessiblePaths.map((p, idx) => {
      const isOwned = p.createdBy?.id === trainerId;
      const isDraft = p.status === 'ai_draft';
      const moduleTitles = (p.modules || []).map(m => m.title).join(', ');
      const totalLessons = (p.modules || []).reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
      const totalAssignments = (p.modules || []).reduce((sum, m) => sum + (m.assignments?.length || 0), 0);

      const ownerName = p.createdBy ? `${p.createdBy.firstName || ''} ${p.createdBy.lastName || ''}`.trim() || p.createdBy.email : 'Institutional Faculty';
      return `[LP ${idx + 1}] Title: "${p.title}"
Status: ${isDraft ? 'AI Draft (Unpublished)' : p.status}, Level: ${p.difficulty || 'Intermediate'}, Duration: ${p.duration || '12 weeks'}
Owner: ${isOwned ? 'You (Current Trainer)' : ownerName}
Skills: ${(p.skillsTags || []).join(', ')}
Description: ${p.description || 'N/A'}
Modules (${p.modules?.length || 0}): ${moduleTitles || 'None'}
Total Lessons: ${totalLessons}, Total Assignments: ${totalAssignments}`;
    }).join('\n\n');

    // 4. If a target path is identified, build an in-depth breakdown of all its nodes
    let focusedPathContext = '';
    if (targetPath) {
      const modDetails = (targetPath.modules || []).map((m, mIdx) => {
        const lessonList = (m.lessons || []).map((l, lIdx) => {
          const videoCount = l.videos?.length || (l.videoUrl ? 1 : 0);
          const videoUrls = (l.videos || []).map(v => v.url).filter(Boolean);
          const resourceList = (l.resources || []).map(r => `${r.title || 'Link'} (${r.url})`);

          return `   Lesson ${lIdx + 1}: "${l.title}"
     Overview: ${l.description || 'N/A'}
     Videos (${videoCount}): ${videoUrls.length > 0 ? videoUrls.join(', ') : 'None attached'}
     Resources: ${resourceList.length > 0 ? resourceList.join(', ') : 'None'}`;
        }).join('\n');

        const assignmentList = (m.assignments || []).map((a, aIdx) => {
          const questions = (a.questions || []).map((q, qIdx) => {
            const opts = q.type === 'MCQ' && q.options ? ` Options: [${q.options.join(', ')}] Correct: ${q.correctIndex}` : '';
            return `     Q${qIdx + 1} (${q.type}, ${q.maxPoints} pts): "${q.text}"${opts}`;
          }).join('\n');

          return `   Assignment: "${a.title}"
     Instructions: ${a.description || a.instructions || 'N/A'}
     Questions (${a.questions?.length || 0}):
${questions || '     (No questions listed)'}`;
        }).join('\n');

        return `Module ${mIdx + 1}: "${m.title}"
Description: ${m.description || 'N/A'}
Objectives: ${(m.objectives || []).join('; ') || 'N/A'}
Outcomes: ${(m.outcomes || []).join('; ') || 'N/A'}
Lessons:
${lessonList || '   (No lessons)'}
Assessments:
${assignmentList || '   (No assignments)'}`;
      }).join('\n\n');

      focusedPathContext = `\nFOCUSED LEARNING PATH IN-DEPTH NODE BREAKDOWN:
Title: "${targetPath.title}"
Status: ${targetPath.status}, Level: ${targetPath.difficulty}
Description: ${targetPath.description}

${modDetails}\n`;
    }

    // 5. Query Groq LLM with Senior Educational AI Architect Persona
    if (groqKey) {
      const { cleanQuery } = sanitizeTrainerQuery(question);
      const systemPrompt = `You are the AI Curriculum Assistant at SkillForge LMS.
You provide clear, concise, and helpful curriculum consultations and course outlines to trainers.

CORE GUIDELINES:
1. CLEAR, CONCISE AND WELL-STRUCTURED RESPONSES:
   - Always keep your responses clear, concise, and easy to read at a glance in the chat drawer.
   - Do NOT provide overwhelming academic dissertations, essays, or unnecessary theoretical jargon.
   - NEVER include Bloom's Revised Taxonomy, Cognitive Load Theory, Scaffolding theory, Spiral Curriculum, gap analysis tables, or implementation checklists UNLESS the trainer explicitly asks for deep pedagogical critique or gap analysis.
   - When asked for details, overview, or info about a Learning Path (e.g. "given the detail of the LP of backend", "tell me about this course", "overview of LP"):
     - Provide a clean, crisp summary with the following concise format:
       - **Title:** Title
       - **Status:** Status, **Level:** Difficulty Level, **Duration:** Duration
       - **Skills:** Key competencies or tags
       - **Overview:** 1-2 crisp sentences summarizing the goal and scope of the course.
       - **Curriculum Outline:** A clean bulleted list of modules with their lesson count, assessment count, and key lesson topics (e.g. "- **Module 1: Title** (2 Lessons, 1 Assessment) - Topics: A, B").
     - Keep it succinct, high-level, and clean. Do NOT dump every resource URL, video link, or quiz question/option unless specifically requested.

2. TARGETED SPECIFIC ANSWERS:
   - If the trainer asks about a specific module, lesson, assessment, or topic, answer only for that specific component concisely without dumping the rest of the course.
   - If the trainer asks a direct question (e.g. "how many lessons are in module 1?", "what is the quiz about?"), answer directly in 1-3 lines.

3. STRICT GROUNDING AND TRUTHFUL BOUNDARIES:
   - Your knowledge of institutional courses is STRICTLY based on the CATALOG DATA and FOCUSED LEARNING PATH BREAKDOWN provided below.
   - If a trainer asks about a course, module, topic, or trainee that is NOT present in the provided catalog:
     - DO NOT invent, hallucinate, or generate random fake courses or lessons.
     - State clearly and directly: "I do not find that course in your current SkillForge catalog. I can only provide details on existing courses or help you generate a new curriculum."
   - If a request is completely outside LMS curriculum architecture or education:
     - Politely decline: "I am specialized in curriculum architecture for SkillForge LMS and cannot assist with external queries outside course creation and educational design."

4. FRESH NEW CHAT VS CONVERSATIONAL CONTINUITY:
   - When starting a new conversation (no previous messages in history), treat the query as completely fresh, clean, and independent.
   - NEVER mix up, recall, or assume references to courses, topics, or details from previous chats.
   - Only resolve pronouns or follow-up references ("it", "the course", "that module", "lesson 2") when there is explicit conversation history present in this current chat session.

5. STRICT SPECIAL CHARACTER AND FORMATTING RULES:
   - NEVER use markdown heading hashtags (#, ##, ###, ####). All section headers must use clean bold text (e.g. **Curriculum Outline**).
   - NEVER use pipe symbols (|) or delimiters (||) anywhere in the response. Use clean commas or bullet items.
   - NEVER use backslashes (\) or escaped characters.
   - NEVER use slash delimiters (/); write "Skills:" instead of "Skills, Focus:".
   - NEVER use emojis, pictograms, or decorative dividers (---, ===, ***).
   - Use clean, standard Markdown only: bold for titles/keys (**Title:**), simple hyphens (- ) for bullet points, and backticks for technical terms or code.
   - Dive straight into the response without conversational filler (no "Hello!", "Certainly!", "I would be glad to help").

6. STUDIO MODE VS GLOBAL ASSISTANT MODE:
   ${activePathId ? '- The trainer currently has this curriculum open in Curriculum Studio. Focus your response directly on this active path.' : '- The trainer is viewing the Global AI Assistant (outside Curriculum Studio). In Global mode, trainers CANNOT mutate, add, edit, or delete modules, lessons, or assessments of existing courses.'}

7. CURRICULUM MUTATIONS IN GLOBAL ASSISTANT:
   ${activePathId ? '' : '- The trainer is currently in the Global AI Assistant. If the trainer asks to add, edit, delete, or update modules, lessons, or assessments in an existing course:\n     - DO NOT ask "In which Learning Path would you like to add it?" or list course IDs.\n     - State clearly and concisely: "To add, edit, or delete modules, lessons, or assignments in an existing course, please open that course in Curriculum Studio (Manage Curriculum > Edit Learning Path) and use the Curriculum AI Assistant there. From the Global Assistant, you can create a brand new course (e.g. \'Create LP: [Title]\') or ask for course details."'}

8. NEVER OUTPUT DATABASE IDS OR UUIDS:
   - NEVER output, mention, or list database IDs, UUIDs, or internal identifiers (such as "ID: 0ba216e6-..." or raw UUID hashes) anywhere in your response.
   - Users and trainers identify courses, modules, lessons, and assignments strictly by their Titles and names. Showing database IDs is strictly prohibited and confuses the user.

9. CURRICULUM CREATION INTENT:
   - When the trainer asks "create the curriculum of [Topic]" (e.g. "create the curriculum of DevOps"):
     - Outline a brief 3-4 module proposed curriculum architecture and state: "To generate and save this entire Learning Path draft directly into your studio, say: Create LP: [Title] (e.g. Create LP: DevOps Engineering)".`;

      const userContent = `CATALOG DATA (${accessiblePaths.length} Learning Paths):\n${catalogSummary}
${focusedPathContext}
CURRENT TRAINER QUESTION:
"${cleanQuery || question}"`;

      const model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';

      // Build recent conversation turns (last 8 messages)
      const recentHistory = history.slice(-8).map(h => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: sanitizeAiResponse(h.content),
      }));

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
              ...recentHistory,
              { role: 'user', content: userContent },
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
            return { answer: sanitizeAiResponse(content), count: accessiblePaths.length };
          }
        }
      } catch (err) {
        this.logger.warn(`Groq LP QA query failed: ${(err as Error).message}`);
      }
    }

    // 6. Graceful Deterministic Fallback if LLM is unreachable
    return this.generateDeterministicFallback(accessiblePaths, targetPath, question);
  }

  /**
   * Deterministic structured summary when LLM is unavailable.
   */
  private generateDeterministicFallback(
    paths: LearningPathEntity[],
    targetPath: LearningPathEntity | undefined,
    question: string,
  ): LpQaResponse {
    if (targetPath) {
      const moduleSummary = (targetPath.modules || []).map((m, i) => {
        const lessonCount = m.lessons?.length || 0;
        const assignmentCount = m.assignments?.length || 0;
        const lessonTitles = (m.lessons || []).map(l => l.title).slice(0, 3).join(', ');
        const lessonNote = lessonTitles ? ` - Topics: ${lessonTitles}${lessonCount > 3 ? '...' : ''}` : '';

        return `- **Module ${i + 1}: ${m.title}** (${lessonCount} Lesson${lessonCount === 1 ? '' : 's'}, ${assignmentCount} Assessment${assignmentCount === 1 ? '' : 's'})${lessonNote}`;
      }).join('\n');

      const skills = (targetPath.skillsTags || []).join(', ');
      const answer = `**${targetPath.title}**\n\n` +
        `- **Status:** ${targetPath.status}, **Level:** ${targetPath.difficulty}, **Duration:** ${targetPath.duration || 'Self-paced'}\n` +
        (skills ? `- **Skills:** ${skills}\n` : '') +
        `- **Overview:** ${targetPath.description || 'Structured learning path.'}\n\n` +
        `**Curriculum Outline (${targetPath.modules?.length || 0} Modules)**\n` +
        (moduleSummary || '- No modules configured yet.');

      return { answer: sanitizeAiResponse(answer), count: 1 };
    }

    const list = paths.slice(0, 8).map((lp, idx) => {
      const totalLessons = (lp.modules || []).reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
      const totalAssignments = (lp.modules || []).reduce((sum, m) => sum + (m.assignments?.length || 0), 0);
      return `- **${idx + 1}. ${lp.title}** (${lp.difficulty || 'Intermediate'}, ${lp.modules?.length || 0} Modules, ${totalLessons} Lessons, ${totalAssignments} Assessments)`;
    }).join('\n');

    const answer = `**Active Learning Path Catalog (${paths.length} Available)**\n\n` +
      list +
      `\n\n*To view details of any path, ask for it by name (e.g. "Details of ${paths[0]?.title || 'course'}"). To generate a new path, say: "Create LP: [Title]".*`;

    return { answer: sanitizeAiResponse(answer), count: paths.length };
  }
}
