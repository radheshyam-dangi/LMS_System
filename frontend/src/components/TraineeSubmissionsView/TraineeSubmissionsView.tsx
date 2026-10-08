import React, { useState, useEffect } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { useToast } from '../../context/ToastContext';

interface TraineeSubmissionsViewProps {
  accessToken: string;
  activeRole: string;
}

export function TraineeSubmissionsView({ accessToken, activeRole }: TraineeSubmissionsViewProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  // Resubmission Modal State
  const [resubmitTask, setResubmitTask] = useState<any | null>(null);
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<Record<number, string>>({});
  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState<Record<number, number>>({});
  const [originalSubjectiveAnswers, setOriginalSubjectiveAnswers] = useState<Record<number, string>>({});
  const [originalMcqAnswers, setOriginalMcqAnswers] = useState<Record<number, number>>({});
  const [singleTextAnswer, setSingleTextAnswer] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMySubmissions = async () => {
    setIsLoading(true);
    try {
      const data = await curriculumService.fetchMySubmissions(accessToken, activeRole);
      setSubmissions(data);
    } catch (err: any) {
      console.error('Failed to fetch trainee submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMySubmissions();
  }, []);

  // 🌟 Dynamic Score & Metric Calculations
  const getSubmissionMetrics = (sub: any) => {
    const maxScore = sub.assignment?.maxScore ?? sub.assignment?.max_score ?? 100;
    const score = sub.score;

    if (score === null || score === undefined || sub.status === 'Submitted') {
      return {
        statusText: 'SUBMITTED',
        scoreText: `Pending Evaluation (Out of ${maxScore})`,
        percentage: null,
        color: '#d97706',
        bgColor: '#fef3c7',
        borderColor: '#fde68a',
      };
    }

    const percentage = Math.round((score / maxScore) * 100);

    if (percentage >= 75) {
      return {
        statusText: 'EVALUATED - EXCELLENT',
        scoreText: `${score} / ${maxScore} Points (${percentage}%)`,
        percentage,
        color: '#15803d',
        bgColor: '#dcfce7',
        borderColor: '#86efac',
      };
    }

    if (percentage >= 45) {
      return {
        statusText: 'EVALUATED - GOOD',
        scoreText: `${score} / ${maxScore} Points (${percentage}%)`,
        percentage,
        color: '#c2410c',
        bgColor: '#ffedd5',
        borderColor: '#fed7aa',
      };
    }

    return {
      statusText: 'EVALUATED - NEEDS IMPROVEMENT',
      scoreText: `${score} / ${maxScore} Points (${percentage}%)`,
      percentage,
      color: '#b91c1c',
      bgColor: '#fee2e2',
      borderColor: '#fca5a5',
    };
  };

  // 🌟 PRE-POPULATE QUESTION & ANSWER PAIRS IN RESUBMISSION MODAL
  const handleOpenResubmit = (sub: any) => {
    setResubmitTask(sub);
    setAttachmentUrl(sub.attachmentUrl || '');
    setSubjectiveAnswers({});
    setSelectedMcqAnswers({});
    setOriginalSubjectiveAnswers({});
    setOriginalMcqAnswers({});
    setSingleTextAnswer('');

    if (sub.submissionText) {
      try {
        const parsed = JSON.parse(sub.submissionText);
        if (parsed.answers) {
          if (sub.assignment?.assignmentType === 'MCQ') {
            setSelectedMcqAnswers(parsed.answers);
            setOriginalMcqAnswers(parsed.answers);
          } else {
            setSubjectiveAnswers(parsed.answers);
            setOriginalSubjectiveAnswers(parsed.answers);
          }
        }
      } catch {
        setSingleTextAnswer(sub.submissionText);
      }
    }
  };

  const handleResubmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmitTask || isSubmitting) return;

    let payloadText = '';
    const questionsList = resubmitTask.assignment?.mcqConfig?.questions || [];

    if (resubmitTask.assignment?.assignmentType === 'MCQ') {
      payloadText = JSON.stringify({ answers: selectedMcqAnswers });
    } else if (questionsList.length > 0) {
      payloadText = JSON.stringify({ answers: subjectiveAnswers });
    } else {
      payloadText = singleTextAnswer;
    }

    if (!payloadText.trim() || payloadText === '{"answers":{}}') {
      toast.warning('Please fill in your revised response before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await curriculumService.submitAssignment(
        {
          assignmentId: resubmitTask.assignment.id,
          submissionText: payloadText,
          attachmentUrl: attachmentUrl || undefined,
        },
        accessToken
      );
      // Removed success alert for better UX
      setResubmitTask(null);
      await fetchMySubmissions();
    } catch (err: any) {
      toast.error(err.message || 'Resubmission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🌟 RENDER FORMATTED QUESTION AND SUBMITTED ANSWER PREVIEW
  const renderFormattedSubmittedSolution = (sub: any) => {
    const questions = sub.assignment?.mcqConfig?.questions || [];
    const isMcq = sub.assignment?.assignmentType === 'MCQ';

    let parsedAnswers: Record<string, any> = {};
    let isJson = false;

    try {
      if (sub.submissionText) {
        const obj = JSON.parse(sub.submissionText);
        if (obj && typeof obj === 'object' && obj.answers) {
          parsedAnswers = obj.answers;
          isJson = true;
        }
      }
    } catch {
      isJson = false;
    }

    if (!isJson || questions.length === 0) {
      return (
        <div style={{ fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
          {sub.submissionText || 'No answer submitted.'}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
        {questions.map((q: any, idx: number) => {
          const ansVal = parsedAnswers[idx] ?? parsedAnswers[String(idx)];

          return (
            <div key={idx} style={{ background: '#fff', padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                Q{idx + 1}: {q.questionText || q.question} ({q.points || q.maxPoints || 10} pts)
              </div>
              <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>
                {isMcq ? (
                  <span>Selected: <strong>{q.options?.[Number(ansVal)] || 'None'}</strong></span>
                ) : (
                  <span>Answer: <strong>{ansVal || 'No response'}</strong></span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px 0' }}>My Submitted Tasks & Scores</h2>
        <p style={{ color: '#64748b', margin: 0 }}>
          View graded evaluations, questions, trainer review notes, and resubmit tasks to improve your progress.
        </p>
      </header>

      {isLoading ? (
        <div>Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>
          No submitted tasks found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {submissions.map((sub) => {
            const metrics = getSubmissionMetrics(sub);
            const canResubmit = sub.status === 'Rejected' || (metrics.percentage !== null && metrics.percentage < 50);

            return (
              <div
                key={sub.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '20px',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                        📝 {sub.assignment?.title || 'Assignment Task'}
                      </h3>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: sub.status === 'Approved' ? '#dcfce7' : sub.status === 'Rejected' ? '#fee2e2' : '#e0f2fe',
                          color: sub.status === 'Approved' ? '#15803d' : sub.status === 'Rejected' ? '#b91c1c' : '#0369a1',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        STATUS: {sub.status?.toUpperCase() || 'SUBMITTED'}
                      </span>
                    </div>

                    <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                      Submitted: {new Date(sub.submittedAt || sub.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: metrics.bgColor,
                      color: metrics.color,
                      border: `1px solid ${metrics.borderColor}`,
                      fontWeight: 700,
                      fontSize: '13px',
                      textAlign: 'right',
                    }}
                  >
                    <div>{metrics.scoreText}</div>
                    <div style={{ fontSize: '11px', opacity: 0.85 }}>{metrics.statusText}</div>
                  </div>
                </div>

                {/* Trainee Answer Breakdown */}
                <div style={{ marginTop: '14px', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <strong style={{ fontSize: '12px', color: '#475569' }}>My Submitted Solution Breakdown:</strong>
                  {renderFormattedSubmittedSolution(sub)}
                </div>

                {/* Trainer Feedback Box */}
                {sub.feedback ? (
                  <div style={{ marginTop: '12px', background: '#f0f9ff', padding: '12px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                    <strong style={{ fontSize: '12px', color: '#0369a1' }}>💬 Trainer Review & Feedback:</strong>
                    <p style={{ fontSize: '13px', color: '#0284c7', margin: '4px 0 0 0' }}>{sub.feedback}</p>
                  </div>
                ) : (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8' }}>
                    ⏳ Trainer evaluation pending...
                  </div>
                )}

                {/* Resubmit Banner */}
                {canResubmit && (
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                    <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: 500 }}>
                      ⚠️ Task was rejected or score is under 50%. You can resubmit an updated response!
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenResubmit(sub)}
                      style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      🔄 Resubmit Task
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 🌟 RESUBMIT MODAL WITH INDIVIDUAL QUESTIONS */}
      {resubmitTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', width: '820px', padding: '32px', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '22px', color: '#0f172a' }}>🔄 Resubmit: {resubmitTask.assignment?.title}</h3>
            
            {/* META INFO SECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submitted By</span>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>You (Trainee)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reviewed By</span>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>
                  {resubmitTask.evaluatedBy ? `${resubmitTask.evaluatedBy.firstName || ''} ${resubmitTask.evaluatedBy.lastName || ''}`.trim() || 'Trainer' : (resubmitTask.evaluationMethod === 'ai_auto' ? 'AI Evaluator' : 'Trainer')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evaluated Time</span>
                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>
                  {resubmitTask.evaluatedAt ? new Date(resubmitTask.evaluatedAt).toLocaleString() : (resubmitTask.updatedAt ? new Date(resubmitTask.updatedAt).toLocaleString() : 'N/A')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</span>
                <span style={{ fontSize: '14px', color: resubmitTask.deadline && new Date(resubmitTask.deadline).getTime() < Date.now() ? '#b91c1c' : '#0f172a', fontWeight: 600 }}>
                  {resubmitTask.deadline ? (() => {
                     const dl = new Date(resubmitTask.deadline);
                     const diffDays = Math.ceil((dl.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                     if (diffDays < 0) return 'Expired';
                     if (diffDays === 0) return 'Ends Today';
                     return `In ${diffDays} days (${dl.toLocaleDateString()})`;
                  })() : 'No Deadline'}
                </span>
              </div>
            </div>

            {/* ASSIGNMENT INSTRUCTIONS */}
            {(resubmitTask.assignment?.instructions || resubmitTask.assignment?.description) && (
              <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '24px' }}>
                <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Assignment Instructions</span>
                <div 
                  style={{ fontSize: '13px', color: '#0284c7', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}
                  dangerouslySetInnerHTML={{ __html: resubmitTask.assignment.instructions || resubmitTask.assignment.description }}
                />
              </div>
            )}

            <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 16px 0', fontWeight: 500 }}>
              Review the feedback and previous answers below, then submit your improved responses to gain full points.
            </p>

            <form onSubmit={handleResubmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Question Mapping */}
              {resubmitTask.assignment?.mcqConfig?.questions?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {resubmitTask.assignment.mcqConfig.questions.map((q: any, qIdx: number) => {
                    const maxPts = q.points || q.maxPoints || 10;
                    const qId = q.id || qIdx;
                    
                    let qScore = 0;
                    if (resubmitTask.questionScores && resubmitTask.questionScores[qId] !== undefined) {
                      qScore = resubmitTask.questionScores[qId];
                    } else if (resubmitTask.questionScores && resubmitTask.questionScores[qIdx] !== undefined) {
                      qScore = resubmitTask.questionScores[qIdx];
                    } else if (resubmitTask.aiQuestionScores) {
                       const aiScoreData = resubmitTask.aiQuestionScores.find((aiq: any) => aiq.questionId === qId || aiq.questionIndex === qIdx);
                       if (aiScoreData) qScore = aiScoreData.score || 0;
                    }

                    const isMcq = resubmitTask.assignment?.assignmentType === 'MCQ';
                    const prevAnswerVal = isMcq ? originalMcqAnswers[qIdx] : originalSubjectiveAnswers[qIdx];
                    const hasPrevAnswer = prevAnswerVal !== undefined;
                    
                    const scorePercentage = (qScore / maxPts) * 100;
                    const scoreColor = scorePercentage >= 75 ? '#15803d' : scorePercentage >= 50 ? '#c2410c' : '#b91c1c';
                    const scoreBg = scorePercentage >= 75 ? '#dcfce7' : scorePercentage >= 50 ? '#ffedd5' : '#fee2e2';

                    return (
                      <div key={qIdx} style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#0f172a', flex: 1, margin: 0 }}>
                            Q{qIdx + 1}: {q.questionText || q.question}
                          </label>
                          <div style={{ padding: '6px 10px', borderRadius: '6px', background: scoreBg, color: scoreColor, fontSize: '13px', fontWeight: 700, border: `1px solid ${scoreColor}40`, marginLeft: '16px', whiteSpace: 'nowrap' }}>
                            Score: {qScore} / {maxPts}
                          </div>
                        </div>

                        {hasPrevAnswer && (
                          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px dashed #94a3b8', marginBottom: '16px' }}>
                             <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>Your Previous Answer</span>
                             <div style={{ fontSize: '14px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                               {isMcq ? (q.options?.[Number(prevAnswerVal)] || 'None') : prevAnswerVal}
                             </div>
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '12px' }}>Your Updated Answer</span>
                          {isMcq ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {q.options?.map((opt: string, optIdx: number) => (
                                <label key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', background: selectedMcqAnswers[qIdx] === optIdx ? '#e0f2fe' : '#fff', border: selectedMcqAnswers[qIdx] === optIdx ? '1px solid #7dd3fc' : '1px solid #cbd5e1', transition: 'all 0.2s', margin: 0 }}>
                                  <input
                                    type="radio"
                                    name={`resubmit_q_${qIdx}`}
                                    checked={selectedMcqAnswers[qIdx] === optIdx}
                                    onChange={() => setSelectedMcqAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                                    style={{ margin: 0, width: '16px', height: '16px' }}
                                  />
                                  {opt}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <textarea
                              rows={4}
                              required
                              value={subjectiveAnswers[qIdx] || ''}
                              onChange={(e) => setSubjectiveAnswers((prev) => ({ ...prev, [qIdx]: e.target.value }))}
                              placeholder="Write your improved answer..."
                              style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Updated Solution *</label>
                  <textarea
                    rows={5}
                    required
                    value={singleTextAnswer}
                    onChange={(e) => setSingleTextAnswer(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Attachment Link (Optional GitHub / Workspace URL)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setResubmitTask(null)} style={{ padding: '8px 16px', background: '#cbd5e1', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                  {isSubmitting ? 'Sending...' : 'Send Revised Solution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}