import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Check,
  FileText,
  Paperclip,
} from 'lucide-react';
import { assignmentService } from '../../services/assignmentService';
import { useToast } from '../../context/ToastContext';

/** Guards against null/undefined/'undefined' strings */
const isValidStr = (v?: string | null): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().toLowerCase() !== 'undefined';

/** Builds safe initials from firstName/lastName with multiple fallback layers */
const getSubmissionTraineeInitials = (
  firstName?: string,
  lastName?: string,
  email?: string
): string => {
  const fn = isValidStr(firstName) ? firstName!.trim() : '';
  const ln = isValidStr(lastName) ? lastName!.trim() : '';
  if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (ln) return ln.slice(0, 2).toUpperCase();
  if (isValidStr(email)) return email!.trim().slice(0, 2).toUpperCase();
  return 'TR';
};

interface SubmissionDetailViewProps {
  submission: any;
  accessToken: string;
  onClose: () => void;
  onEvaluated: () => void;
  isAdminView: boolean;
}

/**
 * Normalizes and extracts all questions from an assignment regardless of whether
 * they are stored in `questions`, `mcqConfig.questions`, legacy `mcqConfig.options`,
 * or stringified JSON representations.
 */
export function extractAssignmentQuestions(assignment: any): any[] {
  if (!assignment) return [];

  let rawList: any[] = [];

  // 1. Direct array in assignment.questions (Tiptap / new structured JSONB questions)
  if (Array.isArray(assignment.questions) && assignment.questions.length > 0) {
    rawList = assignment.questions;
  }
  // 2. Array in assignment.mcqConfig.questions
  else if (Array.isArray(assignment.mcqConfig?.questions) && assignment.mcqConfig.questions.length > 0) {
    rawList = assignment.mcqConfig.questions;
  }
  // 3. Stringified questions JSON
  else if (typeof assignment.questions === 'string') {
    try {
      const p = JSON.parse(assignment.questions);
      if (Array.isArray(p) && p.length > 0) rawList = p;
      else if (Array.isArray(p?.questions) && p.questions.length > 0) rawList = p.questions;
    } catch {}
  }
  // 4. Stringified mcqConfig JSON
  else if (typeof assignment.mcqConfig === 'string') {
    try {
      const p = JSON.parse(assignment.mcqConfig);
      if (Array.isArray(p?.questions) && p.questions.length > 0) rawList = p.questions;
      else if (Array.isArray(p?.options) && p.options.length > 0) {
        rawList = [{
          id: '0',
          text: assignment.title || assignment.description || 'Question 1',
          options: p.options,
          correctIndex: p.correctIndex ?? 0,
          maxPoints: assignment.maxScore || 10,
          type: 'MCQ',
        }];
      }
    } catch {}
  }
  // 5. mcqConfig as a single question object with options & correctIndex
  else if (assignment.mcqConfig && Array.isArray(assignment.mcqConfig.options) && assignment.mcqConfig.options.length > 0) {
    rawList = [{
      id: '0',
      text: assignment.title || assignment.description || 'Question 1',
      options: assignment.mcqConfig.options,
      correctIndex: assignment.mcqConfig.correctIndex ?? 0,
      maxPoints: assignment.maxScore || 10,
      type: 'MCQ',
    }];
  }
  // 6. Direct options array on assignment
  else if (Array.isArray(assignment.options) && assignment.options.length > 0) {
    rawList = [{
      id: '0',
      text: assignment.title || assignment.description || 'Question 1',
      options: assignment.options,
      correctIndex: assignment.correctIndex ?? 0,
      maxPoints: assignment.maxScore || 10,
      type: 'MCQ',
    }];
  }

  // 7. Fallback if rawList is empty but assignment has title/description/instructions
  if (rawList.length === 0 && (assignment.title || assignment.description || assignment.instructions)) {
    const fallbackText = assignment.description || assignment.instructions || assignment.title || 'Assignment Task';
    rawList = [{
      id: '0',
      text: fallbackText,
      questionText: fallbackText,
      question: fallbackText,
      type: assignment.assignmentType === 'MCQ' ? 'MCQ' : 'Subjective',
      options: [],
      maxPoints: assignment.maxScore || 10,
    }];
  }

  // Normalize each question object
  return rawList.map((q, idx) => {
    const qId = String(q.id ?? idx);
    const qText = q.questionText || q.text || q.question || q.title || `Question ${idx + 1}`;
    const qOptions = Array.isArray(q.options) ? q.options : [];
    const qType = q.type || (qOptions.length > 0 ? 'MCQ' : 'Subjective');
    const correctIdx = q.correctIndex != null && !isNaN(Number(q.correctIndex)) ? Number(q.correctIndex) : null;
    const points = Number(q.points ?? q.maxPoints ?? (assignment.maxScore && rawList.length === 1 ? assignment.maxScore : 10));

    return {
      id: qId,
      text: qText,
      questionText: qText,
      question: qText,
      type: qType,
      options: qOptions,
      correctIndex: correctIdx,
      points,
      maxPoints: points,
      expectedAnswerGuideline: q.expectedAnswerGuideline || q.guidelines || '',
    };
  });
}

/**
 * Resolves any representation of an MCQ answer (number, string index, option text, letter like "C")
 * into a 0-based option index matching options[].
 */
export function resolveTraineeOptionIndex(val: any, options: string[] = []): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (!isNaN(val) && val >= 0 && (options.length === 0 || val < options.length)) return val;
  }

  const str = String(val).trim();
  if (!str) return null;

  // 1. Check numeric string e.g. "0", "1", "2"
  const num = Number(str);
  if (!isNaN(num) && num >= 0 && (options.length === 0 || num < options.length)) {
    return num;
  }

  // 2. Check direct option text match
  if (options && options.length > 0) {
    const cleanStr = str.toLowerCase().replace(/^[a-d][\.\)]\s*/i, '').trim();
    for (let i = 0; i < options.length; i++) {
      const opt = String(options[i]).trim();
      const cleanOpt = opt.toLowerCase().replace(/^[a-d][\.\)]\s*/i, '').trim();
      if (opt.toLowerCase() === str.toLowerCase() || cleanOpt === cleanStr) {
        return i;
      }
    }
    for (let i = 0; i < options.length; i++) {
      const cleanOpt = String(options[i]).toLowerCase().replace(/^[a-d][\.\)]\s*/i, '').trim();
      if (cleanOpt.length > 2 && (cleanOpt.includes(cleanStr) || cleanStr.includes(cleanOpt))) {
        return i;
      }
    }
  }

  // 3. Check letter choice e.g. "C", "Option C", "C."
  const letterMatch = str.match(/^(?:option\s+)?([A-D])(?:\.|\)|:|$|\s)/i);
  if (letterMatch) {
    const letterIdx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (letterIdx >= 0 && (options.length === 0 || letterIdx < options.length)) {
      return letterIdx;
    }
  }

  return null;
}

/**
 * Parses submission answer payload from JSON strings, arrays, or objects
 */
export function parseSubmissionData(submission: any) {
  const answersArray: Array<{ questionId?: string; index?: number; answer: any }> = [];
  const mcqMap: Record<string, any> = {};
  const textMap: Record<string, string> = {};
  let rawText = submission?.submissionText || '';

  // 1. Direct submission.answers array or json
  let rawAnswers: any = submission?.answers;
  if (typeof rawAnswers === 'string') {
    try {
      rawAnswers = JSON.parse(rawAnswers);
    } catch {}
  }
  if (Array.isArray(rawAnswers)) {
    rawAnswers.forEach((item, i) => {
      if (item && typeof item === 'object') {
        const qId = item.questionId != null ? String(item.questionId) : undefined;
        const val = item.answer ?? item.selectedOption ?? item.value ?? item.text;
        answersArray.push({ questionId: qId, index: i, answer: val });
        if (qId) {
          textMap[qId] = String(val ?? '');
          mcqMap[qId] = val;
        }
        textMap[String(i)] = String(val ?? '');
        mcqMap[String(i)] = val;
      } else if (item != null) {
        answersArray.push({ index: i, answer: item });
        textMap[String(i)] = String(item);
        mcqMap[String(i)] = item;
      }
    });
  } else if (rawAnswers && typeof rawAnswers === 'object') {
    Object.entries(rawAnswers).forEach(([k, v]) => {
      textMap[k] = String(v ?? '');
      mcqMap[k] = v;
    });
  }

  // 2. Direct mcqAnswers on submission
  const directMcq = submission?.mcqAnswers || (submission as any)?.mcq_answers;
  if (directMcq && typeof directMcq === 'object') {
    Object.entries(directMcq).forEach(([k, v]) => {
      mcqMap[k] = v;
    });
  }

  // 3. Parse submissionText JSON
  if (typeof submission?.submissionText === 'string') {
    const trimmed = submission.submissionText.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsed.forEach((item, i) => {
            if (item && typeof item === 'object') {
              const qId = item.questionId != null ? String(item.questionId) : undefined;
              const val = item.answer ?? item.selectedOption ?? item.value;
              answersArray.push({ questionId: qId, index: i, answer: val });
              if (qId) {
                textMap[qId] = String(val ?? '');
                mcqMap[qId] = val;
              }
              textMap[String(i)] = String(val ?? '');
              mcqMap[String(i)] = val;
            } else if (item != null) {
              answersArray.push({ index: i, answer: item });
              textMap[String(i)] = String(item);
              mcqMap[String(i)] = item;
            }
          });
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.raw) rawText = String(parsed.raw);

          const pMcq = parsed.mcqAnswers || parsed.mcq;
          if (pMcq && typeof pMcq === 'object') {
            Object.entries(pMcq).forEach(([k, v]) => {
              mcqMap[k] = v;
            });
          }

          const pSubj = parsed.textAnswers || parsed.subj;
          if (pSubj && typeof pSubj === 'object') {
            Object.entries(pSubj).forEach(([k, v]) => {
              textMap[k] = String(v ?? '');
            });
          }

          if (Array.isArray(parsed.answers)) {
            parsed.answers.forEach((item: any, i: number) => {
              if (item && typeof item === 'object') {
                const qId = item.questionId != null ? String(item.questionId) : undefined;
                const val = item.answer ?? item.selectedOption ?? item.value;
                answersArray.push({ questionId: qId, index: i, answer: val });
                if (qId) {
                  if (textMap[qId] === undefined) textMap[qId] = String(val ?? '');
                  if (mcqMap[qId] === undefined) mcqMap[qId] = val;
                }
                if (textMap[String(i)] === undefined) textMap[String(i)] = String(val ?? '');
                if (mcqMap[String(i)] === undefined) mcqMap[String(i)] = val;
              }
            });
          } else if (parsed.answers && typeof parsed.answers === 'object') {
            Object.entries(parsed.answers).forEach(([k, v]) => {
              if (mcqMap[k] === undefined) mcqMap[k] = v;
              if (textMap[k] === undefined) textMap[k] = String(v ?? '');
            });
          }
        }
      } catch {}
    }
  }

  return { answersArray, mcqMap, textMap, rawText };
}

/**
 * Matches trainee answer to a specific question by ID or array index
 */
export function getTraineeAnswerForQuestion(parsed: any, q: any, idx: number): any {
  if (!parsed) return null;
  const qId = String(q.id ?? idx);
  const idxStr = String(idx);
  const isMcq = q.type === 'MCQ' || (Array.isArray(q.options) && q.options.length > 0);

  // If MCQ, check mcqMap first
  if (isMcq && parsed.mcqMap) {
    if (parsed.mcqMap[qId] !== undefined) return parsed.mcqMap[qId];
    if (parsed.mcqMap[idxStr] !== undefined) return parsed.mcqMap[idxStr];
    if (parsed.mcqMap[idx] !== undefined) return parsed.mcqMap[idx];
  }

  // Check structured answersArray
  if (Array.isArray(parsed.answersArray)) {
    const match = parsed.answersArray.find(
      (a: any) =>
        (a.questionId && (String(a.questionId) === qId || String(a.questionId) === idxStr)) ||
        (a.index !== undefined && a.index === idx)
    );
    if (match && match.answer !== undefined && match.answer !== null && String(match.answer).trim() !== '') {
      return match.answer;
    }
  }

  // Check textMap
  if (parsed.textMap) {
    if (parsed.textMap[qId] !== undefined && parsed.textMap[qId].trim() !== '') return parsed.textMap[qId];
    if (parsed.textMap[idxStr] !== undefined && parsed.textMap[idxStr].trim() !== '') return parsed.textMap[idxStr];
  }

  // Fallback for single question
  if (idx === 0 && parsed.rawText && parsed.rawText.trim() !== '') {
    return parsed.rawText.trim();
  }

  return null;
}

export function SubmissionDetailView({
  submission,
  accessToken,
  onClose,
  onEvaluated,
  isAdminView,
}: SubmissionDetailViewProps) {
  const questions = useMemo(() => extractAssignmentQuestions(submission.assignment), [submission.assignment]);
  const parsedSubmission = useMemo(() => parseSubmissionData(submission), [submission]);

  // Pre-calculate initial scores per question from AI or past trainer grading
  const initialScores = useMemo(() => {
    const scores: Record<string, number> = {};

    questions.forEach((q, idx) => {
      const traineeAnswer = getTraineeAnswerForQuestion(parsedSubmission, q, idx);
      const isMcq = q.type === 'MCQ' || (q.options && q.options.length > 0);
      if (isMcq) {
        const traineeChoiceIdx = resolveTraineeOptionIndex(traineeAnswer, q.options);
        if (traineeChoiceIdx !== null && q.correctIndex !== null && traineeChoiceIdx === q.correctIndex) {
          scores[q.id] = q.points;
        } else {
          scores[q.id] = 0;
        }
      } else {
        if (submission.questionScores && submission.questionScores[q.id] !== undefined) {
          scores[q.id] = Math.min(q.points, Math.max(0, Number(submission.questionScores[q.id]) || 0));
        } else if (Array.isArray(submission.aiQuestionScores)) {
          const aiQ = submission.aiQuestionScores.find(
            (s: any) => String(s.questionId) === q.id || String(s.questionId) === String(idx)
          );
          if (aiQ && aiQ.score != null) {
            scores[q.id] = Math.min(q.points, Math.max(0, Number(aiQ.score) || 0));
          } else {
            scores[q.id] = 0;
          }
        } else {
          scores[q.id] = 0;
        }
      }
    });

    return scores;
  }, [questions, parsedSubmission, submission.questionScores, submission.aiQuestionScores]);

  const [questionScores, setQuestionScores] = useState<Record<string, number>>(initialScores);

  const [evalScore, setEvalScore] = useState<number | ''>(() => {
    if (questions.length > 0) {
      return Object.values(initialScores).reduce((sum, s) => sum + (Number(s) || 0), 0);
    }
    if (submission.score != null) return submission.score;
    if (submission.totalScore != null) return submission.totalScore;
    if (submission.aiTotalScore != null) return submission.aiTotalScore;
    return '';
  });

  const [evalFeedback, setEvalFeedback] = useState<string>(
    submission.feedback || submission.aiOverallRemark || ''
  );
  const [isEvaluating, setIsEvaluating] = useState(false);
  const toast = useToast();

  // Performance stats for summary pill
  const stats = useMemo(() => {
    let totalQuestions = questions.length;
    let mcqCount = 0;
    let correctCount = 0;
    let totalMaxScore = 0;
    let autoCalculatedScore = 0;

    questions.forEach((q, idx) => {
      totalMaxScore += q.points;
      if (q.type === 'MCQ' && q.options.length > 0) {
        mcqCount++;
        const traineeAnswer = getTraineeAnswerForQuestion(parsedSubmission, q, idx);
        const traineeChoiceIdx = resolveTraineeOptionIndex(traineeAnswer, q.options);
        if (traineeChoiceIdx !== null && q.correctIndex !== null && traineeChoiceIdx === q.correctIndex) {
          correctCount++;
          autoCalculatedScore += q.points;
        }
      }
    });

    return { totalQuestions, mcqCount, correctCount, totalMaxScore, autoCalculatedScore };
  }, [questions, parsedSubmission]);

  const handleEvaluate = async (actionStatus: 'Approved' | 'Rejected') => {
    if (actionStatus === 'Rejected' && !evalFeedback.trim()) {
      toast.warning('A reason/feedback is required to reject a submission.');
      return;
    }

    if (actionStatus === 'Approved' && (evalScore === '' || evalScore == null)) {
      toast.warning('Score is required when approving a submission.');
      return;
    }

    setIsEvaluating(true);
    try {
      await assignmentService.evaluateSubmission(
        submission.id,
        {
          score: evalScore === '' ? null : Number(evalScore),
          feedback: evalFeedback,
          status: actionStatus,
          questionScores: Object.keys(questionScores).length > 0 ? questionScores : undefined,
        },
        accessToken
      );
      toast.success('Assignment evaluated successfully!');
      onEvaluated();
    } catch (err: any) {
      console.error('Failed to evaluate:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to evaluate submission.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSetScore = (qId: string, val: number, maxPoints: number) => {
    const clamped = Math.min(maxPoints, Math.max(0, isNaN(val) ? 0 : val));
    setQuestionScores(prev => {
      const nextScores = { ...prev, [qId]: clamped };
      const total = Object.values(nextScores).reduce((sum, s) => sum + (Number(s) || 0), 0);
      setEvalScore(total);
      return nextScores;
    });
  };

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(6px)',
        padding: '20px',
      }}
    >
      <div
        className="w-full max-w-[880px] h-auto min-h-0"
        style={{
          background: '#ffffff',
          width: '880px',
          maxWidth: '100%',
          maxHeight: '90vh',
          height: 'auto',
          borderRadius: '18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        {/* ═══ MODAL HEADER ═══ */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  background: '#e0e7ff',
                  color: '#4338ca',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  letterSpacing: '0.5px',
                }}
              >
                {submission.assignment?.assignmentType || 'Assignment'}
              </span>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                Evaluate: {submission.assignment?.title || 'Submission'}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '13px', color: '#475569' }}>
              {/* Trainee Avatar */}
              {(() => {
                const avatarSrc: string | undefined =
                  submission.trainee?.avatarUrl ||
                  submission.trainee?.profileImage ||
                  submission.trainee?.avatar ||
                  undefined;
                const initials = getSubmissionTraineeInitials(
                  submission.trainee?.firstName,
                  submission.trainee?.lastName,
                  submission.trainee?.email
                );
                const safeFirstName = isValidStr(submission.trainee?.firstName)
                  ? submission.trainee!.firstName
                  : '';
                const safeLastName = isValidStr(submission.trainee?.lastName)
                  ? submission.trainee!.lastName
                  : '';
                const displayName = `${safeFirstName} ${safeLastName}`.trim() ||
                  submission.trainee?.email ||
                  'Trainee';

                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Avatar circle */}
                    <div
                      style={{
                        position: 'relative',
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                    >
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={displayName}
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #e2e8f0',
                          }}
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.style.display = 'none';
                            const fallback = img.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          display: avatarSrc ? 'none' : 'flex',
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 800,
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid #e0e7ff',
                          flexShrink: 0,
                          letterSpacing: '0.5px',
                        }}
                      >
                        {initials}
                      </div>
                    </div>

                    <div>
                      <strong style={{ color: '#1e293b', display: 'block', fontSize: '14px' }}>
                        {displayName}
                      </strong>
                      {isValidStr(submission.trainee?.email) && (
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          {submission.trainee!.email}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <span style={{ color: '#cbd5e1' }}>•</span>
              <div style={{ color: '#64748b', fontSize: '12px' }}>
                Submitted: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'Recent'}
              </div>
            </div>

            {isAdminView && submission.assignment?.createdBy && (
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Author: {submission.assignment.createdBy.firstName} {submission.assignment.createdBy.lastName}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'background 0.15s',
            }}
            title="Close dialog"
            onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}
          >
            <X size={18} />
          </button>
        </div>

        {/* ═══ MODAL BODY (SCROLLABLE) ═══ */}
        <div
          className="max-h-[80vh] overflow-y-auto min-h-0 h-auto"
          style={{
            padding: '24px',
            maxHeight: '80vh',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* ═══ AI EVALUATION OVERVIEW ═══ */}
          {submission.aiTotalScore != null && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Header Bar */}
              <div
                style={{
                  padding: '12px 18px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} style={{ color: '#4f46e5' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    AI Evaluation Overview
                  </span>
                  {submission.status && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: submission.status === 'Approved' ? '#ecfdf5' : submission.status === 'Rejected' ? '#fff1f2' : '#f1f5f9',
                        color: submission.status === 'Approved' ? '#047857' : submission.status === 'Rejected' ? '#be123c' : '#475569',
                        border: `1px solid ${submission.status === 'Approved' ? '#a7f3d0' : submission.status === 'Rejected' ? '#fecdd3' : '#cbd5e1'}`,
                      }}
                    >
                      {submission.status === 'Submitted' ? 'Review Required' : submission.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Body Content */}
              <div style={{ padding: '16px 18px' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ textAlign: 'center', minWidth: '70px', paddingRight: '12px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      AI Score
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e1b4b', marginTop: '2px' }}>
                      {submission.aiTotalScore}
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                        /{submission.aiTotalMaxScore || submission.assignment?.maxScore || stats.totalMaxScore || 100}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                      AI Feedback Summary
                    </div>
                    <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.45' }}>
                      {submission.aiOverallRemark || 'Completed rubric checks.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ QUESTIONS & SOLUTIONS LIST ═══ */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} style={{ color: '#4f46e5' }} />
                Trainee Solution Breakdown ({questions.length > 0 ? `${questions.length} Question${questions.length > 1 ? 's' : ''}` : 'Submission Content'})
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Review trainee selections and verify scores below
              </span>
            </div>

            {questions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {questions.map((q, idx) => {
                  const traineeAnswer = getTraineeAnswerForQuestion(parsedSubmission, q, idx);
                  const isMcq = q.type === 'MCQ' || (q.options && q.options.length > 0);
                  const traineeChoiceIdx = isMcq ? resolveTraineeOptionIndex(traineeAnswer, q.options) : null;
                  const correctChoiceIdx = q.correctIndex;
                  const isAnswered = isMcq ? traineeChoiceIdx !== null : (traineeAnswer != null && String(traineeAnswer).trim() !== '');
                  const isCorrect = isMcq && isAnswered && correctChoiceIdx !== null && traineeChoiceIdx === correctChoiceIdx;

                  const aiScore = submission.aiQuestionScores?.find(
                    (s: any) => String(s.questionId) === q.id || String(s.questionId) === String(idx)
                  );

                  const assignedScore = questionScores[q.id] !== undefined
                    ? questionScores[q.id]
                    : (isMcq ? (isCorrect ? q.points : 0) : (aiScore?.score != null ? aiScore.score : 0));

                  return (
                    <div
                      key={q.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                      }}
                    >
                      {/* Question Top Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                          <span
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              fontSize: '12px',
                              fontWeight: 800,
                              padding: '4px 8px',
                              borderRadius: '6px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Q{idx + 1}
                          </span>
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', lineHeight: '1.45' }}>
                              {q.text}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                {isMcq ? 'Multiple Choice' : 'Subjective / Text'}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                                Max: {q.points} pts
                              </span>
                            </div>
                          </div>
                        </div>

                        </div>

                      {/* ─── MCQ OPTIONS LIST ─── */}
                      {isMcq && q.options.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                          {q.options.map((opt: string, optIdx: number) => {
                            const isTraineePick = isAnswered && traineeChoiceIdx === optIdx;
                            const isThisCorrect = correctChoiceIdx !== null && correctChoiceIdx === optIdx;

                            // Styling calculation:
                            let cardBg = '#ffffff';
                            let cardBorder = '1px solid #e2e8f0';
                            let letterBg = '#f1f5f9';
                            let letterColor = '#64748b';
                            let textColor = '#334155';
                            let badge: React.ReactNode = null;

                            if (isTraineePick && isThisCorrect) {
                              // Trainee was right!
                              cardBg = '#ecfdf5';
                              cardBorder = '1.5px solid #10b981';
                              letterBg = '#10b981';
                              letterColor = '#ffffff';
                              textColor = '#065f46';
                              badge = (
                                <span
                                  style={{
                                    background: '#10b981',
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <Check size={12} strokeWidth={2.5} /> Trainee Selection
                                </span>
                              );
                            } else if (isTraineePick && !isThisCorrect) {
                              // Trainee was wrong!
                              cardBg = '#fff1f2';
                              cardBorder = '1.5px solid #f43f5e';
                              letterBg = '#f43f5e';
                              letterColor = '#ffffff';
                              textColor = '#9f1239';
                              badge = (
                                <span
                                  style={{
                                    background: '#f43f5e',
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <X size={12} strokeWidth={2.5} /> Trainee Selection
                                </span>
                              );
                            } else if (isThisCorrect) {
                              // Correct answer that trainee missed
                              cardBg = '#f0fdf4';
                              cardBorder = '1.5px dashed #10b981';
                              letterBg = '#dcfce7';
                              letterColor = '#15803d';
                              textColor = '#065f46';
                              badge = (
                                <span
                                  style={{
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #86efac',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <Check size={12} strokeWidth={2.5} /> Correct Answer
                                </span>
                              );
                            }

                            return (
                              <div
                                key={optIdx}
                                style={{
                                  background: cardBg,
                                  border: cardBorder,
                                  borderRadius: '10px',
                                  padding: '10px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span
                                    style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '50%',
                                      background: letterBg,
                                      color: letterColor,
                                      fontSize: '12px',
                                      fontWeight: 800,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {optionLetters[optIdx] || optIdx + 1}
                                  </span>
                                  <span style={{ fontSize: '14px', fontWeight: isTraineePick || isThisCorrect ? 700 : 500, color: textColor }}>
                                    {opt}
                                  </span>
                                </div>

                                {badge}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* ─── SUBJECTIVE QUESTION VIEW ─── */
                        <div className="h-auto min-h-0" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.3px' }}>
                              Trainee Submitted Answer:
                            </div>
                            <div
                              className="whitespace-pre-wrap break-words min-h-0 h-auto"
                              style={{
                                fontSize: '14px',
                                color: '#0f172a',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                lineHeight: '1.6',
                                background: '#ffffff',
                                padding: '14px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                borderLeft: '4px solid #3b82f6',
                              }}
                            >
                              {traineeAnswer ? String(traineeAnswer) : <em style={{ color: '#94a3b8' }}>No answer written.</em>}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Question Score Grading Input */}
                      <div
                        style={{
                          marginTop: '6px',
                          paddingTop: '12px',
                          borderTop: '1px dashed #cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                            Score for Q{idx + 1}:
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={q.points}
                            value={assignedScore}
                            onChange={e => handleSetScore(q.id, e.target.value === '' ? 0 : Number(e.target.value), q.points)}
                            style={{
                              width: '65px',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1.5px solid #cbd5e1',
                              fontSize: '14px',
                              fontWeight: 700,
                              textAlign: 'center',
                              outline: 'none',
                            }}
                          />
                          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>/ {q.points} pts</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Fallback view when no structured questions exist */
              <div className="h-auto min-h-0" style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                  Raw Submission Content:
                </div>
                <div
                  className="whitespace-pre-wrap break-words min-h-0 h-auto"
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    lineHeight: '1.6',
                    color: '#1e293b',
                    fontSize: '13px',
                    background: '#fff',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    borderLeft: '4px solid #3b82f6',
                  }}
                >
                  {parsedSubmission.rawText || submission.submissionText || 'No textual content submitted.'}
                </div>
              </div>
            )}
          </div>

          {/* Attachment Link (if any) */}
          {submission.attachmentUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
              }}
            >
              <Paperclip size={16} style={{ color: '#4f46e5', flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#0f172a' }}>Trainee Attached File: </strong>
                <a
                  href={submission.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline', marginLeft: '6px' }}
                >
                  {submission.attachmentUrl}
                </a>
              </div>
            </div>
          )}

          {/* ═══ EVALUATION CONTROLS ═══ */}
          <div
            style={{
              background: '#f8fafc',
              padding: '20px',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Final Evaluation & Feedback
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Review, upgrade, or finalize the score and feedback for this trainee
                </div>
              </div>

            </div>

            {/* Overall Score Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  Overall Score (Max: {submission.assignment?.maxScore || stats.totalMaxScore || 100} pts)
                </label>
                {evalScore !== '' && (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#4f46e5' }}>
                    Percentage: {Math.round((Number(evalScore) / (submission.assignment?.maxScore || stats.totalMaxScore || 100)) * 100)}%
                  </span>
                )}
              </div>
              <input
                type="number"
                readOnly
                value={evalScore}
                placeholder="Auto-calculated from question scores..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0f172a',
                  outline: 'none',
                  background: '#f8fafc',
                  cursor: 'not-allowed',
                }}
              />
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Overall score is automatically calculated from the individual question scores above.
              </div>
            </div>

            {/* Trainer Feedback Textarea */}
            <div>
              <div style={{ marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  Trainer Feedback
                </label>
              </div>

              <textarea
                rows={3}
                value={evalFeedback}
                onChange={e => setEvalFeedback(e.target.value)}
                placeholder="Write constructive feedback or adjust the AI evaluation..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none',
                  background: '#ffffff',
                }}
              />
            </div>
          </div>
        </div>

        {/* ═══ MODAL FOOTER ACTIONS ═══ */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              disabled={isEvaluating}
              onClick={() => handleEvaluate('Rejected')}
              style={{
                padding: '10px 20px',
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                cursor: isEvaluating ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                opacity: isEvaluating ? 0.6 : 1,
              }}
            >
              Reject Submission
            </button>

            <button
              type="button"
              disabled={isEvaluating}
              onClick={() => handleEvaluate('Approved')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: isEvaluating ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                opacity: isEvaluating ? 0.6 : 1,
              }}
            >
              <Check size={16} />
              {isEvaluating ? 'Submitting Evaluation...' : 'Approve & Submit Evaluation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
