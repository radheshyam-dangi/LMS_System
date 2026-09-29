import React, { useState, useEffect, useMemo } from 'react';
import { assignmentService } from '../../services/assignmentService';

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

  // Normalize each question object
  return rawList.map((q, idx) => {
    const qId = String(q.id ?? idx);
    const qText = q.questionText || q.text || q.question || `Question ${idx + 1}`;
    const qOptions = Array.isArray(q.options) ? q.options : [];
    const qType = q.type || (qOptions.length > 0 ? 'MCQ' : 'Subjective');
    const correctIdx = q.correctIndex != null && !isNaN(Number(q.correctIndex)) ? Number(q.correctIndex) : null;
    const points = Number(q.points ?? q.maxPoints ?? (assignment.maxScore && rawList.length === 1 ? assignment.maxScore : 10));

    return {
      id: qId,
      text: qText,
      type: qType,
      options: qOptions,
      correctIndex: correctIdx,
      points,
      expectedAnswerGuideline: q.expectedAnswerGuideline || q.guidelines || '',
    };
  });
}

/**
 * Parses submission answer payload from JSON strings or objects
 */
export function parseSubmissionData(submission: any) {
  let parsed: any = submission.answers || submission.submissionText;
  let rawText = submission.submissionText || '';

  if (typeof parsed === 'string') {
    try {
      const obj = JSON.parse(parsed);
      parsed = obj.answers ?? obj.mcqAnswers ?? obj.textAnswers ?? obj;
      if (obj.raw) rawText = obj.raw;
    } catch {}
  }

  return { parsed, rawText };
}

/**
 * Matches trainee answer to a specific question by ID or array index
 */
export function getTraineeAnswerForQuestion(parsed: any, q: any, idx: number): any {
  if (parsed == null) return null;
  const qId = String(q.id ?? idx);

  if (Array.isArray(parsed)) {
    const match = parsed.find(
      (item: any) =>
        String(item.questionId) === qId ||
        String(item.questionId) === String(idx) ||
        String(item.id) === qId ||
        String(item.id) === String(idx)
    );
    if (match) return match.answer ?? match.selectedOption ?? match.traineeAnswer;
    if (parsed[idx] !== undefined) {
      const item = parsed[idx];
      return typeof item === 'object' && item !== null ? (item.answer ?? item.selectedOption) : item;
    }
  } else if (typeof parsed === 'object') {
    if (parsed[qId] !== undefined) return parsed[qId];
    if (parsed[String(idx)] !== undefined) return parsed[String(idx)];
    if (parsed[idx] !== undefined) return parsed[idx];
    if (q.id && parsed[q.id] !== undefined) return parsed[q.id];
  } else if (idx === 0) {
    return parsed;
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
  const { parsed: parsedSubmission, rawText } = useMemo(() => parseSubmissionData(submission), [submission]);

  const [questionScores, setQuestionScores] = useState<Record<string, number>>(() => {
    if (submission.questionScores && Object.keys(submission.questionScores).length > 0) {
      return submission.questionScores;
    }

    const initialScores: Record<string, number> = {};

    questions.forEach((q, idx) => {
      const traineeAnswer = getTraineeAnswerForQuestion(parsedSubmission, q, idx);
      if (q.type === 'MCQ' && q.options.length > 0) {
        const traineeChoiceIdx = traineeAnswer != null && traineeAnswer !== '' ? Number(traineeAnswer) : null;
        if (traineeChoiceIdx !== null && q.correctIndex !== null && traineeChoiceIdx === q.correctIndex) {
          initialScores[q.id] = q.points;
        } else {
          initialScores[q.id] = 0;
        }
      }
    });

    return initialScores;
  });

  const [evalScore, setEvalScore] = useState<number | ''>(() => {
    if (submission.aiTotalScore != null) return submission.aiTotalScore;
    if (submission.score != null) return submission.score;
    // Auto-calculate sum from MCQ initial scores if available
    const scoreSum = Object.values(questionScores).reduce((sum, s) => sum + (Number(s) || 0), 0);
    return Object.keys(questionScores).length > 0 ? scoreSum : '';
  });

  const [evalFeedback, setEvalFeedback] = useState<string>(submission.feedback || '');
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Sync overall score when question scores are graded
  useEffect(() => {
    if (Object.keys(questionScores).length > 0) {
      const total = Object.values(questionScores).reduce((sum, s) => sum + (Number(s) || 0), 0);
      setEvalScore(total);
    }
  }, [questionScores]);

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
        const traineeChoiceIdx = traineeAnswer != null && traineeAnswer !== '' ? Number(traineeAnswer) : null;
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
      alert('A reason/feedback is required to reject a submission.');
      return;
    }

    if (actionStatus === 'Approved' && (evalScore === '' || evalScore == null)) {
      alert('Score is required when approving a submission.');
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
      onEvaluated();
    } catch (err: any) {
      console.error('Failed to evaluate:', err);
      alert(err.response?.data?.message || err.message || 'Failed to evaluate submission.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSetScore = (qId: string, val: number) => {
    setQuestionScores(prev => ({ ...prev, [qId]: val }));
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
        style={{
          background: '#ffffff',
          width: '880px',
          maxWidth: '100%',
          maxHeight: '92vh',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px' }}>👤</span>
                <strong style={{ color: '#1e293b' }}>
                  {submission.trainee?.firstName} {submission.trainee?.lastName || ''}
                </strong>
                <span style={{ color: '#64748b' }}>({submission.trainee?.email})</span>
              </div>
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
              fontSize: '18px',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'background 0.15s',
            }}
            title="Close dialog"
            onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}
          >
            ✕
          </button>
        </div>

        {/* ═══ MODAL BODY (SCROLLABLE) ═══ */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick Metrics Bar (for MCQs) */}
          {stats.mcqCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                background: stats.correctCount === stats.mcqCount ? '#ecfdf5' : '#fffbeb',
                borderRadius: '12px',
                border: `1px solid ${stats.correctCount === stats.mcqCount ? '#a7f3d0' : '#fde68a'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '24px' }}>{stats.correctCount === stats.mcqCount ? '🎯' : '📊'}</span>
                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: stats.correctCount === stats.mcqCount ? '#065f46' : '#92400e',
                    }}
                  >
                    MCQ Performance Breakdown
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    Trainee answered{' '}
                    <strong style={{ color: stats.correctCount === stats.mcqCount ? '#047857' : '#b45309' }}>
                      {stats.correctCount} of {stats.mcqCount}
                    </strong>{' '}
                    questions correctly ({stats.mcqCount > 0 ? Math.round((stats.correctCount / stats.mcqCount) * 100) : 0}% accuracy)
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, color: '#64748b' }}>
                  Auto-Graded Score
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {stats.autoCalculatedScore} / {stats.totalMaxScore} pts
                </div>
              </div>
            </div>
          )}

          {/* AI Suggested Evaluation (if available) */}
          {submission.aiTotalScore != null && (
            <div
              style={{
                background: '#eef2ff',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #c7d2fe',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3730a3', fontWeight: 800, fontSize: '14px' }}>
                  <span>🤖</span> AI Evaluation Suggestion
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEvalScore(submission.aiTotalScore);
                    if (submission.aiOverallRemark) {
                      setEvalFeedback(prev => (prev ? `${prev}\n\nAI Note: ${submission.aiOverallRemark}` : submission.aiOverallRemark));
                    }
                  }}
                  style={{
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Apply Suggested Score ({submission.aiTotalScore})
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
                  <div style={{ fontSize: '11px', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase' }}>AI Score</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#312e81' }}>
                    {submission.aiTotalScore} / {submission.aiTotalMaxScore || submission.assignment?.maxScore || 100}
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: '#fff',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e0e7ff',
                    fontSize: '13px',
                    color: '#312e81',
                    lineHeight: '1.4',
                  }}
                >
                  <strong style={{ color: '#4338ca' }}>AI Reasoning: </strong>
                  {submission.aiOverallRemark || 'Completed rubric checks.'}
                </div>
              </div>
            </div>
          )}

          {/* ═══ QUESTIONS & SOLUTIONS LIST ═══ */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📝</span> Trainee Solution Breakdown ({questions.length > 0 ? `${questions.length} Question${questions.length > 1 ? 's' : ''}` : 'Submission Content'})
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
                  const traineeChoiceIdx = traineeAnswer != null && traineeAnswer !== '' ? Number(traineeAnswer) : null;
                  const correctChoiceIdx = q.correctIndex;
                  const isAnswered = traineeChoiceIdx !== null && !isNaN(traineeChoiceIdx);
                  const isCorrect = isAnswered && correctChoiceIdx !== null && traineeChoiceIdx === correctChoiceIdx;

                  const aiScore = submission.aiQuestionScores?.find(
                    (s: any) => String(s.questionId) === q.id || String(s.questionId) === String(idx)
                  );

                  const assignedScore = questionScores[q.id] ?? (isCorrect ? q.points : 0);

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

                        {/* Result Badge */}
                        {isMcq ? (
                          <div style={{ flexShrink: 0 }}>
                            {isCorrect ? (
                              <span
                                style={{
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  padding: '5px 12px',
                                  borderRadius: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  border: '1px solid #86efac',
                                }}
                              >
                                <span>✓</span> Correct (+{q.points} pts)
                              </span>
                            ) : isAnswered ? (
                              <span
                                style={{
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  padding: '5px 12px',
                                  borderRadius: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  border: '1px solid #fca5a5',
                                }}
                              >
                                <span>✗</span> Incorrect (0 pts)
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  padding: '5px 12px',
                                  borderRadius: '20px',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                ⚪ Unanswered
                              </span>
                            )}
                          </div>
                        ) : null}
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
                              cardBorder = '2px solid #10b981';
                              letterBg = '#10b981';
                              letterColor = '#ffffff';
                              textColor = '#065f46';
                              badge = (
                                <span
                                  style={{
                                    background: '#10b981',
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>✓</span> Trainee Answer (Correct)
                                </span>
                              );
                            } else if (isTraineePick && !isThisCorrect) {
                              // Trainee was wrong!
                              cardBg = '#fff1f2';
                              cardBorder = '2px solid #f43f5e';
                              letterBg = '#f43f5e';
                              letterColor = '#ffffff';
                              textColor = '#9f1239';
                              badge = (
                                <span
                                  style={{
                                    background: '#f43f5e',
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>✗</span> Trainee Selected (Incorrect)
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
                                    fontWeight: 800,
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #86efac',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>✓</span> Correct Answer
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

                          {/* Quick Solution Summary Banner */}
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '10px 14px',
                              background: isCorrect ? '#f0fdf4' : '#f8fafc',
                              border: `1px solid ${isCorrect ? '#bbf7d0' : '#e2e8f0'}`,
                              borderRadius: '8px',
                              fontSize: '12px',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <strong>Summary: </strong>
                              {isAnswered ? (
                                <span>
                                  Trainee selected <strong>Option {optionLetters[traineeChoiceIdx] || traineeChoiceIdx + 1} ("{q.options[traineeChoiceIdx]}")</strong>.
                                  {isCorrect
                                    ? ' This matches the correct answer!'
                                    : correctChoiceIdx !== null
                                    ? ` The correct answer is Option ${optionLetters[correctChoiceIdx] || correctChoiceIdx + 1} ("${q.options[correctChoiceIdx]}").`
                                    : ''}
                                </span>
                              ) : (
                                <span style={{ color: '#b45309' }}>No option selected by trainee.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* ─── SUBJECTIVE QUESTION VIEW ─── */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                              Trainee Submitted Answer:
                            </div>
                            <div style={{ fontSize: '14px', color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                              {traineeAnswer ? String(traineeAnswer) : <em style={{ color: '#94a3b8' }}>No answer written.</em>}
                            </div>
                          </div>

                          {q.expectedAnswerGuideline && (
                            <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '13px', color: '#166534' }}>
                              <strong style={{ display: 'block', marginBottom: '4px' }}>📋 Grading Guideline / Expected Rubric:</strong>
                              {q.expectedAnswerGuideline}
                            </div>
                          )}
                        </div>
                      )}

                      {/* AI Question Score (if available) */}
                      {aiScore && (
                        <div style={{ background: '#eef2ff', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #6366f1', fontSize: '13px' }}>
                          <div style={{ fontWeight: 800, color: '#4338ca', marginBottom: '4px' }}>
                            🤖 AI Question Assessment: {aiScore.score} / {aiScore.maxScore || q.points} pts
                          </div>
                          <div style={{ color: '#312e81' }}>{aiScore.remark}</div>
                          {aiScore.matchedKeyPoints?.length > 0 && (
                            <div style={{ color: '#15803d', marginTop: '6px', fontSize: '12px' }}>
                              <strong>Key Points Hit:</strong> {aiScore.matchedKeyPoints.join(', ')}
                            </div>
                          )}
                          {aiScore.missedKeyPoints?.length > 0 && (
                            <div style={{ color: '#b91c1c', marginTop: '4px', fontSize: '12px' }}>
                              <strong>Key Points Missed:</strong> {aiScore.missedKeyPoints.join(', ')}
                            </div>
                          )}
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
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Quick Grade:</span>
                          <button
                            type="button"
                            onClick={() => handleSetScore(q.id, q.points)}
                            style={{
                              background: assignedScore === q.points ? '#dcfce7' : '#f1f5f9',
                              color: assignedScore === q.points ? '#166534' : '#475569',
                              border: `1px solid ${assignedScore === q.points ? '#86efac' : '#cbd5e1'}`,
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Full ({q.points})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetScore(q.id, 0)}
                            style={{
                              background: assignedScore === 0 ? '#fee2e2' : '#f1f5f9',
                              color: assignedScore === 0 ? '#991b1b' : '#475569',
                              border: `1px solid ${assignedScore === 0 ? '#fca5a5' : '#cbd5e1'}`,
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Zero (0)
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                            Score for Q{idx + 1}:
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={q.points}
                            value={assignedScore}
                            onChange={e => handleSetScore(q.id, e.target.value === '' ? 0 : Number(e.target.value))}
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
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                  Raw Submission Content:
                </div>
                <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b', fontSize: '13px', background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  {rawText || submission.submissionText || 'No textual content submitted.'}
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
              <span style={{ fontSize: '18px' }}>📎</span>
              <div>
                <strong>Trainee Attached File: </strong>
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
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
              Final Evaluation & Feedback
            </div>

            {/* Overall Score Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  Overall Score (Max: {submission.assignment?.maxScore || stats.totalMaxScore || 100} pts)
                  <span style={{ color: '#64748b', fontWeight: 'normal', marginLeft: '6px' }}>
                    (Auto-synced with question grades)
                  </span>
                </label>
                {evalScore !== '' && (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#4f46e5' }}>
                    Percentage: {Math.round((Number(evalScore) / (submission.assignment?.maxScore || stats.totalMaxScore || 100)) * 100)}%
                  </span>
                )}
              </div>
              <input
                type="number"
                min={0}
                max={submission.assignment?.maxScore || stats.totalMaxScore || 100}
                value={evalScore}
                onChange={e => setEvalScore(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Enter final score..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0f172a',
                  outline: 'none',
                  background: '#ffffff',
                }}
              />
            </div>

            {/* Trainer Feedback Textarea */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  Trainer Feedback / Remarks
                  <span style={{ color: '#dc2626', marginLeft: '4px' }}>* (Mandatory if Rejecting)</span>
                </label>
              </div>

              {/* Feedback Quick Presets */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEvalFeedback('Excellent work! All questions answered accurately.')}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                    cursor: 'pointer',
                  }}
                >
                  + "Excellent work!"
                </button>
                <button
                  type="button"
                  onClick={() => setEvalFeedback('Good effort! Please review the incorrect answers above.')}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: '#eff6ff',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    cursor: 'pointer',
                  }}
                >
                  + "Good effort, review incorrect"
                </button>
                <button
                  type="button"
                  onClick={() => setEvalFeedback('Submission does not meet passing criteria. Please review learning material and resubmit.')}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: '#fff1f2',
                    color: '#9f1239',
                    border: '1px solid #fecdd3',
                    cursor: 'pointer',
                  }}
                >
                  + "Does not meet criteria"
                </button>
              </div>

              <textarea
                rows={3}
                value={evalFeedback}
                onChange={e => setEvalFeedback(e.target.value)}
                placeholder="Write constructive, encouraging feedback or specific corrections..."
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
              {isEvaluating ? 'Submitting Evaluation...' : '✓ Approve & Submit Evaluation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
