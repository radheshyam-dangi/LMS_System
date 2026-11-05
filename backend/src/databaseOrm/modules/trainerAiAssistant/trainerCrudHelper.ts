import { LearningPathEntity } from '../../entities/learningPath.entity';

export function serializeLpToAuthoringPayload(lp: LearningPathEntity): any {
  return {
    id: lp.id,
    title: lp.title,
    description: lp.description,
    level: lp.difficulty || 'Intermediate',
    status: lp.status || 'ai_draft',
    origin: lp.origin || 'ai',
    duration: lp.duration || '12 weeks',
    skillsTags: Array.isArray(lp.skillsTags) ? lp.skillsTags : [],
    modules: (lp.modules || []).map((m: any, mIdx: number) => {
      const lessons = (m.lessons || []).map((l: any, lIdx: number) => ({
        id: l.id,
        title: l.title || `Lesson ${lIdx + 1}`,
        description: l.description || '',
        videos: Array.isArray(l.videos) ? l.videos : (l.videoUrl ? [{ url: l.videoUrl, title: l.title }] : []),
        audios: Array.isArray(l.audios) ? l.audios : [],
        resources: Array.isArray(l.resources)
          ? l.resources.map((r: any) => ({
              url: r.url,
              label: r.title || r.label || 'Link',
              type: r.type || 'Link',
            }))
          : [],
      }));

      const createdLessonIds = lessons.map((l: any) => l.id);

      const assignments = (m.assignments || []).map((a: any, aIdx: number) => {
        const questions = (a.questions || []).map((q: any) => ({
          id: q.id,
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
          id: a.id,
          title: a.title || `Module ${mIdx + 1} Assessment`,
          body: a.description || a.instructions || a.body || '',
          questions,
          dependsOnLessonIds: createdLessonIds,
          lockConfig: a.lockConfig || { enabled: true },
          evaluation: a.evaluation || {
            autoEvaluateWithAI: true,
            humanInterventionRequired: true,
          },
          timerDuration: a.timerDuration || { days: 7, hours: 0, minutes: 0 },
          countdownStart: a.countdownStart || 'taskUnlocked',
        };
      });

      return {
        id: m.id,
        title: m.title || `Module ${mIdx + 1}`,
        description: m.description || '',
        sequentialModuleLock: m.sequentialModuleLock ?? true,
        sequentialLessonLock: m.sequentialLessonLock ?? true,
        learningObjectives: m.objectives || m.learningObjectives || [],
        learningOutcomes: m.outcomes || m.learningOutcomes || [],
        lessons,
        assignments,
      };
    }),
  };
}

export function summarizeCrudOperation(instruction: string): { operationType: 'delete' | 'create' | 'update'; summary: string } {
  const lower = instruction.toLowerCase();
  const hasDelete = /\b(?:delete[ds]?|deleting|remov(?:e|ed|es|ing)|drop(?:ped|s)?|discard(?:ed|s)?|omit(?:ted|s)?|trash(?:ed|es)?|eras(?:e|ed|es|ing)|still\s+visible)\b/i.test(lower);
  const hasAdd = /\b(?:add[s]?|adding|insert(?:ed|ing|s)?|append(?:ed|ing|s)?|attach(?:ed|ing|s)?|creat(?:e|ed|ing|es)|build(?:ing)?|new|make)\b/i.test(lower);

  const parts: string[] = [];

  // Check additions
  if (hasAdd) {
    const modCountMatch = lower.match(/\b(?:add|insert|create|new)\s*([0-9]+)\s*(?:more\s+)?mod(?:ule)?/i);
    const modCount = modCountMatch ? modCountMatch[1] : null;

    const lessonCountMatch = lower.match(/\b(?:with\s+)?(?:([0-9]+)|one|two|three)\s+less(?:on)?/i);
    let lessonInfo = '';
    if (lessonCountMatch) {
      const rawNum = lessonCountMatch[1] || (lessonCountMatch[0].includes('one') ? '1' : lessonCountMatch[0].includes('two') ? '2' : '3');
      lessonInfo = `${rawNum} lesson${rawNum === '1' ? '' : 's'}`;
    }

    const assignCountMatch = lower.match(/\b(?:and\s+)?(?:([0-9]+)|one|two|three)\s+(?:assignment|assessment|task|quiz)/i);
    let assignInfo = '';
    if (assignCountMatch) {
      const rawNum = assignCountMatch[1] || (assignCountMatch[0].includes('one') ? '1' : assignCountMatch[0].includes('two') ? '2' : '3');
      const isMcq = /\bmcq\b/i.test(lower);
      assignInfo = `${rawNum} ${isMcq ? 'MCQ ' : ''}assessment${rawNum === '1' ? '' : 's'}`;
    }

    if (modCount) {
      const details = [lessonInfo, assignInfo].filter(Boolean).join(' and ');
      parts.push(`Add ${modCount} module${modCount === '1' ? '' : 's'}${details ? ` (with ${details} each)` : ''}`);
    } else {
      const singleModMatch = lower.match(/\bmod(?:ule)?\s*([0-9]+)\b/i);
      const lessonMatch = lower.match(/\bless(?:on)?\s*([0-9]+)?\b/i);
      if (lessonMatch && singleModMatch && !hasDelete) {
        parts.push(`Add lesson to Module ${singleModMatch[1]}`);
      } else if (singleModMatch && !hasDelete) {
        parts.push(`Add Module ${singleModMatch[1]} to the curriculum`);
      } else {
        parts.push(`Add requested curriculum components`);
      }
    }
  }

  // Check deletions
  if (hasDelete) {
    // 1. Question deletion
    const qMatch = lower.match(/\bquest(?:ion)?\s*([0-9]+)\b/i);
    const assignQuote = instruction.match(/["'“]([^"'“”]+)["'”]/i);
    const assignMatch = lower.match(/\b(?:assignment|assessment|task|quiz)\s*([0-9]+)\b/i);

    if (qMatch) {
      const qNum = qMatch[1];
      const assignName = assignQuote ? `"${assignQuote[1]}"` : (assignMatch ? `Assessment ${assignMatch[1]}` : 'the assignment');
      parts.push(`Remove Question ${qNum} from ${assignName}`);
    } else {
      // 2. Module deletion
      const modDelMatch =
        lower.match(/(?:delete[ds]?|remov(?:e|ed|ing)|drop(?:ped)?|omit(?:ted)?|trash(?:ed)?)\s+(?:only\s+)?(?:the\s+)?mod(?:ule)?\s*([0-9]+)/i) ||
        lower.match(/\bmod(?:ule)?\s*([0-9]+)\s*.*?(?:delete[ds]?|remov(?:e|ed|es|ing)|drop|trash)/i);

      const namedModMatch =
        instruction.match(/mod(?:ule)?\s*[0-9]*\s*[-–—:]\s*["'“]([^"'“”]+)["'”]/i) ||
        instruction.match(/["'“]([^"'“”]+)["'”]/i);

      if (modDelMatch) {
        const mNum = modDelMatch[1];
        const titleSuffix = namedModMatch ? ` ("${namedModMatch[1]}")` : '';
        parts.push(`Delete Module ${mNum}${titleSuffix}`);
      } else if (namedModMatch) {
        parts.push(`Delete Module "${namedModMatch[1]}"`);
      } else {
        // 3. Lesson deletion
        const lessDelMatch =
          lower.match(/(?:delete[ds]?|remov(?:e|ed|ing)|drop(?:ped)?|omit(?:ted)?|trash(?:ed)?)\s+(?:the\s+)?less(?:on)?\s*([0-9]+)/i) ||
          lower.match(/\bless(?:on)?\s*([0-9]+)\s*.*?(?:delete[ds]?|remov(?:e|ed|es|ing)|still\s+visible)/i);

        if (lessDelMatch) {
          parts.push(`Delete Lesson ${lessDelMatch[1]}`);
        } else if (assignMatch || (assignQuote && !hasAdd)) {
          const aName = assignQuote ? `"${assignQuote[1]}"` : `Assessment ${assignMatch![1]}`;
          parts.push(`Delete assessment ${aName}`);
        } else {
          parts.push(`Remove specified item`);
        }
      }
    }
  }

  const operationType: 'delete' | 'create' | 'update' =
    hasDelete && hasAdd ? 'update' : (hasDelete ? 'delete' : (hasAdd ? 'create' : 'update'));

  const summary = parts.length > 0 ? parts.join('; ') : `Apply modifications according to: "${instruction}"`;

  return { operationType, summary };
}

