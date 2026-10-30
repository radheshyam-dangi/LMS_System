/**
 * Utility to reliably extract submitted answers (both MCQ and Subjective)
 * from any submission structure (JSON, arrays, objects, plain text, DB entities).
 */
export interface ExtractedAnswers {
  subj: Record<number, string>;
  mcq: Record<number, any>;
  text: string;
  att: string;
}

export function extractAnswersFromSubmission(
  submission: any,
  questionsArray: any[] = []
): ExtractedAnswers {
  const subj: Record<number, string> = {};
  const mcq: Record<number, any> = {};
  let text = '';
  let att = submission?.attachmentUrl || '';

  if (!submission) return { subj, mcq, text, att };

  // 1. Parse rawAnswers (from submission.answers)
  let rawAnswers: any = submission.answers;
  if (typeof rawAnswers === 'string') {
    try {
      rawAnswers = JSON.parse(rawAnswers);
    } catch {}
  }

  // 2. Parse submission.submissionText
  let parsedTextObj: any = null;
  if (submission.submissionText) {
    text = String(submission.submissionText);
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          if (!rawAnswers) rawAnswers = parsed;
        } else if (parsed && typeof parsed === 'object') {
          parsedTextObj = parsed;
          if (parsed.attachmentUrl && !att) att = parsed.attachmentUrl;
          if (parsed.att && !att) att = parsed.att;
        }
      } catch {}
    }
  }

  // 3. Extract MCQ answers from known object keys
  const rawMcqSource =
    submission.mcqAnswers ||
    parsedTextObj?.mcqAnswers ||
    parsedTextObj?.mcq;
  if (rawMcqSource && typeof rawMcqSource === 'object') {
    Object.entries(rawMcqSource).forEach(([k, v]) => {
      const numKey = Number(k);
      if (!isNaN(numKey)) {
        mcq[numKey] = v;
      }
    });
  }

  // 4. Candidate sources for answers
  const candidateSources = [
    rawAnswers,
    parsedTextObj?.answers,
    parsedTextObj?.textAnswers,
    parsedTextObj?.subj,
  ].filter(Boolean);

  questionsArray.forEach((q, idx) => {
    const qIdStr = String(q.id ?? idx);
    const qIdNum = Number(q.id ?? idx);
    let answerFound = false;

    for (const source of candidateSources) {
      if (Array.isArray(source)) {
        // Find matching item in array
        const matched = source.find(
          (item: any, itemIdx: number) =>
            item &&
            (String(item.questionId) === qIdStr ||
             String(item.questionId) === String(idx) ||
             String(item.id) === qIdStr ||
             (item.questionId === undefined && itemIdx === idx))
        );
        if (matched !== undefined) {
          const val = typeof matched === 'object' ? (matched.answer ?? matched.text ?? matched.response ?? matched.val) : matched;
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            const isMcq = q.type === 'MCQ' || (Array.isArray(q.options) && q.options.length > 0);
            if (isMcq) {
              if (mcq[idx] === undefined) {
                const numVal = Number(val);
                mcq[idx] = !isNaN(numVal) ? numVal : val;
              }
            } else {
              subj[idx] = String(val);
            }
            answerFound = true;
            break;
          }
        }
      } else if (typeof source === 'object') {
        // Map lookup by key
        const val =
          source[idx] ??
          source[String(idx)] ??
          source[qIdStr] ??
          (!isNaN(qIdNum) ? source[qIdNum] : undefined);
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const isMcq = q.type === 'MCQ' || (Array.isArray(q.options) && q.options.length > 0);
          if (isMcq) {
            if (mcq[idx] === undefined) {
              const numVal = Number(val);
              mcq[idx] = !isNaN(numVal) ? numVal : val;
            }
          } else {
            subj[idx] = typeof val === 'string' ? val : (val.answer ?? val.text ?? JSON.stringify(val));
          }
          answerFound = true;
          break;
        }
      }
    }

    // Fallback: If only 1 question and text is plain string
    if (!answerFound && questionsArray.length === 1 && text && !parsedTextObj) {
      const isMcq = q.type === 'MCQ' || (Array.isArray(q.options) && q.options.length > 0);
      if (!isMcq) {
        subj[idx] = text;
      }
    }
  });

  return { subj, mcq, text, att };
}
