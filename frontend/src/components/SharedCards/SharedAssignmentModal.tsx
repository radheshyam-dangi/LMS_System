import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bot, X, ChevronRight, Save } from 'lucide-react';
import DOMPurify from 'dompurify';
import { RichText } from '../common/RichText';
import { DeadlineDisplay } from '../DeadlineDisplay';
import { resolveAssignmentInstructions } from '../../utils/assignmentInstructions';
import { AssignmentChatDrawer } from '../TraineeSubmissionsView/AssignmentChatDrawer';
import { renderMultilineText } from '../../utils/textUtils';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import { useToast } from '../../context/ToastContext';

interface SharedAssignmentModalProps {
  task: any;
  submission: any;
  accessToken: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const SharedAssignmentModal: React.FC<SharedAssignmentModalProps> = ({
  task,
  submission,
  accessToken,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'instructions' | 'questions'>('instructions');
  const [submissionText, setSubmissionText] = useState('');
  const toast = useToast();
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<{ [key: number]: string }>({});
  const [mcqAnswers, setMcqAnswers] = useState<{ [key: number]: number | number[] }>({});
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Track original draft state to detect unsaved changes
  const [initialStateStr, setInitialStateStr] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Focus trap and esc listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isChatDrawerOpen) {
          setIsChatDrawerOpen(false);
        } else {
          handleCloseRequest();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isChatDrawerOpen]);

  useEffect(() => {
    const draftKey = `draft_assignment_${task.id}`;
    const localDraft = localStorage.getItem(draftKey);
    
    let prefilledMcq = {};
    let prefilledSubj = {};
    let prefilledText = '';
    let prefilledAtt = '';

    if (localDraft) {
      try {
        const parsed = JSON.parse(localDraft);
        prefilledMcq = parsed.mcq || {};
        prefilledSubj = parsed.subj || {};
        prefilledText = parsed.text || '';
        prefilledAtt = parsed.att || '';
      } catch (e) {}
    } else if (submission?.submissionText) {
      try {
        prefilledText = submission.submissionText;
        if (submission.submissionText.startsWith('{')) {
          const parsed = JSON.parse(submission.submissionText);
          if (parsed.answers) {
            prefilledMcq = parsed.answers;
            prefilledSubj = parsed.answers; // Shared object in old code
          }
        }
      } catch (e) {}
    }

    setSubmissionText(prefilledText);
    setSubjectiveAnswers(prefilledSubj);
    setMcqAnswers(prefilledMcq);
    setAttachmentUrl(prefilledAtt);
    
    setInitialStateStr(JSON.stringify({ text: prefilledText, subj: prefilledSubj, mcq: prefilledMcq, att: prefilledAtt }));
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [task.id, submission]);

  // Check for unsaved changes
  useEffect(() => {
    const currentStr = JSON.stringify({ text: submissionText, subj: subjectiveAnswers, mcq: mcqAnswers, att: attachmentUrl });
    setHasUnsavedChanges(currentStr !== initialStateStr);
    
    // Autosave
    if (currentStr !== initialStateStr && step === 'questions') {
       localStorage.setItem(`draft_assignment_${task.id}`, currentStr);
    }
  }, [submissionText, subjectiveAnswers, mcqAnswers, attachmentUrl, step, initialStateStr, task.id]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(`draft_assignment_${task.id}`);
  };

  const handleStartTask = async () => {
    if (task.anchorType === 'TASK_START' && (!submission || submission.status === 'AVAILABLE' || submission.rawStatus === 'AVAILABLE')) {
      try {
        await assignmentService.startAssignment(task.id, accessToken);
        // We do not reload the page, but let the user proceed to questions
      } catch (err: any) {
        toast.error(err?.response?.data?.message || err.message || 'Could not start assignment');
        return;
      }
    }
    setStep('questions');
    if (containerRef.current) {
        containerRef.current.scrollTop = 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalSubmissionText = submissionText;
      const questionsArray = task.questions?.length > 0 ? task.questions : (task.mcqConfig?.questions || []);
      
      const structuredAnswers: Array<{ questionId: string; answer: string }> = questionsArray.map((q: any, idx: number) => {
        const qId = q.id || String(idx);
        const isMCQ = (q.type || q.questionType || '').toUpperCase() === 'MCQ' || (task.assignmentType === 'MCQ' && q.options?.length > 0);
        if (isMCQ) {
          const selectedIdx = mcqAnswers[idx];
          return {
            questionId: qId,
            answer: typeof selectedIdx === 'number' ? String(selectedIdx) : '',
          };
        } else {
          return {
            questionId: qId,
            answer: subjectiveAnswers[idx] || submissionText,
          };
        }
      });

      if (questionsArray.length > 0) {
        finalSubmissionText = JSON.stringify({
          answers: mcqAnswers,
          textAnswers: subjectiveAnswers,
          raw: submissionText,
        });
      }
      
      if (!finalSubmissionText.trim()) finalSubmissionText = 'Task completed & submitted';

      await assignmentService.submitAssignment(
        task.id,
        {
          submissionText: finalSubmissionText,
          attachmentUrl: attachmentUrl || undefined,
          answers: structuredAnswers.length > 0 ? structuredAnswers : undefined,
        },
        accessToken
      );
      
      clearDraft();
      toast.success('Assignment submitted successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to submit assignment');
    } finally {
      setIsSubmitting(false); // Fix: was true
    }
  };

  const deadlineAt = task.deadlineAt || submission?.deadlineAt;
  const status = task.status || submission?.status || 'not_started';

  let timeLeftStr = '';
  let isOverdue = false;
  if (status === 'started' && deadlineAt) {
    const diff = new Date(deadlineAt).getTime() - currentTime.getTime();
    if (diff <= 0) {
      isOverdue = true;
      timeLeftStr = 'Time is up!';
    } else {
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
      const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
      const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
      timeLeftStr = `${d > 0 ? d + 'd ' : ''}${h}:${m}:${s}`;
    }
  }

  const { hasCustom, content: instructionContent } = resolveAssignmentInstructions(task);
  // Ensure sanitized rich text
  const safeInstructionHTML = DOMPurify.sanitize(instructionContent);

  const questionsArray = task.questions?.length > 0 ? task.questions : (task.mcqConfig?.questions || []);

  const isResubmit = submission && submission.status !== 'AVAILABLE' && submission.status !== 'LOCKED' && submission.status !== 'Pending';
  const qScores = submission?.questionScores || submission?.aiQuestionScores || {};
  let prevAnswersParsed: Record<string, any> = {};
  if (submission?.submissionText) {
    try {
      const parsed = JSON.parse(submission.submissionText);
      if (parsed.answers) prevAnswersParsed = parsed.answers;
    } catch (e) {}
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '24px' }} onClick={handleCloseRequest}>
      <div 
        ref={containerRef}
        style={{ 
          '--chat-panel-width': '420px',
          width: '100%', 
          maxWidth: isChatDrawerOpen ? 'calc(100vw - var(--chat-panel-width) - 48px)' : 720, 
          height: '90dvh', maxHeight: 900, overflowY: 'hidden', 
          background: '#fff', borderRadius: 24, display: 'flex', flexDirection: 'column', position: 'relative', 
          boxShadow: '0 25px 80px rgba(0,0,0,0.2)',
          margin: 'auto',
          marginRight: isChatDrawerOpen ? 'calc(var(--chat-panel-width) + 24px)' : 'auto',
          transition: 'max-width 0.3s ease, margin-right 0.3s ease'
        } as React.CSSProperties} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Sticky) */}
        <div style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', zIndex: 10, padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{task.title}</h3>
                <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>{task.assignmentType}</span>
                    <span>{task.lessonTitle || 'Module Task'}</span>
                    
                    {timeLeftStr && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: isOverdue || (timeLeftStr && timeLeftStr.includes('0d 00:')) ? '#fee2e2' : '#fef3c7', color: isOverdue || (timeLeftStr && timeLeftStr.includes('0d 00:')) ? '#b91c1c' : '#b45309', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>
                        ⏳ {timeLeftStr}
                      </span>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsChatDrawerOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '8px 14px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <Bot size={16} /> Ask AI
                </button>
                <button type="button" onClick={handleCloseRequest} style={{ border: 'none', background: '#f1f5f9', borderRadius: '10px', width: 36, height: 36, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            
            {/* Step 1: Instructions */}
            <div style={{ display: step === 'instructions' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '32px 24px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📖</div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Assignment Instructions</h4>
                        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Please read carefully before starting</p>
                    </div>
                </div>

                <div className="rich-text-content" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, fontSize: 15, color: '#334155', lineHeight: 1.7, marginBottom: 32 }} dangerouslySetInnerHTML={{ __html: safeInstructionHTML || 'No instructions provided.' }} />

                {task.externalUrl && (
                    <a href={task.externalUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', color: '#2563eb', fontWeight: 600, marginBottom: 32, transition: 'all 0.2s' }}>
                        🔗 Reference Resource: {task.externalUrl}
                    </a>
                )}

                </div>
                <div style={{ padding: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#fff' }}>
                    <button 
                        type="button" 
                        onClick={handleStartTask} 
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,42,0.2)', transition: 'all 0.2s' }}
                    >
                        {task.anchorType === 'TASK_START' && (!submission || submission.status === 'AVAILABLE' || submission.rawStatus === 'AVAILABLE') ? 'Now I will do task' : 'Continue to Questions'} 
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Step 2: Questions & Submit */}
            <div style={{ display: step === 'questions' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '32px 24px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <button type="button" onClick={() => setStep('instructions')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        ← Back to Instructions
                    </button>
                    {hasUnsavedChanges && <span style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}><Save size={14} /> Draft saved locally</span>}
                </div>
                
                <form id="assignment-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    
                    {questionsArray.length > 0 ? (
                      questionsArray.map((q: any, idx: number) => {
                        const hasOptions = q.options && q.options.length > 0;
                        const qId = q.id || String(idx);
                        const previousEvaluation = qScores[qId] || qScores[idx];
                        const prevAnsVal = prevAnswersParsed[idx] ?? prevAnswersParsed[String(idx)];
                        const hasPrevAnswer = isResubmit && prevAnsVal !== undefined && prevAnsVal !== '';
                        const isMcq = (q.type || q.questionType || '').toUpperCase() === 'MCQ' || (task.assignmentType === 'MCQ' && hasOptions);

                        return (
                          <div key={idx} style={{ padding: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                              <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                                <strong style={{ fontSize: 18, color: '#0f172a', background: '#e2e8f0', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</strong>
                                <div style={{ fontSize: 16, color: '#0f172a', fontWeight: 600, paddingTop: 4, lineHeight: 1.5 }}>
                                  {renderMultilineText(q.text || q.questionText || q.question || '') || 'No question text'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700, background: '#f1f5f9', padding: '4px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                                  {q.maxPoints || 10} pts
                                </span>
                                {isResubmit && previousEvaluation !== undefined && (
                                  <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 700, background: '#fee2e2', padding: '4px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                                    Scored: {typeof previousEvaluation === 'object' ? previousEvaluation.score : previousEvaluation} pts
                                  </span>
                                )}
                              </div>
                            </div>

                            {hasPrevAnswer && (
                              <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px dashed #94a3b8', marginBottom: '20px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>Your Previous Answer</span>
                                <div style={{ fontSize: '14px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                                  {isMcq ? (q.options?.[Number(prevAnsVal)] || 'None') : prevAnsVal}
                                </div>
                              </div>
                            )}

                            {isResubmit && previousEvaluation && previousEvaluation.feedback && (
                              <div style={{ marginBottom: 20, padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, fontSize: 14, color: '#92400e', display: 'flex', gap: '12px' }}>
                                <span style={{ fontSize: '20px' }}>💬</span>
                                <div>
                                  <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>Trainer Feedback</strong>
                                  <div style={{ lineHeight: 1.5 }}>{previousEvaluation.feedback}</div>
                                </div>
                              </div>
                            )}

                            {isMcq ? (
                              !hasOptions ? (
                                <div style={{ padding: 12, background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Invalid question configuration: no options provided.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {(q.options || []).map((opt: string, oi: number) => {
                                      const isChecked = q.allowMultipleCorrect
                                            ? (Array.isArray(mcqAnswers[idx]) ? (mcqAnswers[idx] as any as number[]).includes(oi) : false)
                                            : mcqAnswers[idx] === oi;
                                      
                                      return (
                                        <label key={oi} style={{ fontSize: 15, display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer', padding: '14px 16px', borderRadius: 12, background: isChecked ? '#eff6ff' : '#fff', border: `2px solid ${isChecked ? '#3b82f6' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
                                          <input
                                            type={q.allowMultipleCorrect ? "checkbox" : "radio"}
                                            name={`q-${idx}`}
                                            checked={isChecked}
                                            onChange={() => {
                                              if (q.allowMultipleCorrect) {
                                                setMcqAnswers(prev => {
                                                  const current = Array.isArray(prev[idx]) ? (prev[idx] as any as number[]) : [];
                                                  if (current.includes(oi)) {
                                                    return { ...prev, [idx]: current.filter((o: number) => o !== oi) as any };
                                                  } else {
                                                    return { ...prev, [idx]: [...current, oi] as any };
                                                  }
                                                });
                                              } else {
                                                setMcqAnswers(prev => ({ ...prev, [idx]: oi }));
                                              }
                                            }}
                                            style={{ width: 18, height: 18, accentColor: '#3b82f6', cursor: 'pointer' }}
                                          />
                                          <div style={{ flex: 1, color: isChecked ? '#1e3a8a' : '#334155', fontWeight: isChecked ? 600 : 400 }}>
                                            <RichText content={opt || `Option ${oi + 1}`} emptyStateText={`Option ${oi + 1}`} />
                                          </div>
                                        </label>
                                    );
                                  })}
                                </div>
                              )
                            ) : (
                              <textarea
                                className="answer-textarea"
                                rows={6}
                                value={subjectiveAnswers[idx] || ''}
                                onChange={(e) => setSubjectiveAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                                placeholder="Type your detailed answer here..."
                                style={{ width: '100%', padding: 16, borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 15, fontFamily: 'inherit', resize: 'vertical', outline: 'none', transition: 'border-color 0.2s' }}
                                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                              />
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Your Submission</label>
                        <textarea
                          required
                          rows={10}
                          value={submissionText}
                          onChange={(e) => setSubmissionText(e.target.value)}
                          placeholder="Write your comprehensive submission here..."
                          style={{ width: '100%', padding: 20, borderRadius: 16, border: '2px solid #e2e8f0', fontSize: 15, fontFamily: 'inherit', resize: 'vertical', outline: 'none', transition: 'border-color 0.2s', lineHeight: 1.6 }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </div>
                    )}

                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                            🔗 Attachment URL <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                        </label>
                        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>Link to your GitHub repo, Google Drive folder, or external workspace.</p>
                        <input
                            type="url"
                            placeholder="https://..."
                            value={attachmentUrl}
                            onChange={(e) => setAttachmentUrl(e.target.value)}
                            style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 15, outline: 'none', transition: 'border-color 0.2s' }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>
                    
                </form>
              </div>

              {/* Submit Actions */}
              <div style={{ padding: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#fff' }}>
                  <button type="button" onClick={handleCloseRequest} style={{ padding: '14px 24px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}>
                      Cancel
                  </button>
                  <button form="assignment-form" type="submit" disabled={isSubmitting || isOverdue} style={{ padding: '14px 32px', background: isOverdue ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: isOverdue || isSubmitting ? 'not-allowed' : 'pointer', boxShadow: isOverdue ? 'none' : '0 4px 12px rgba(79,70,229,0.3)', opacity: isSubmitting ? 0.7 : 1 }}>
                      {isSubmitting ? 'Submitting...' : isOverdue ? 'Deadline Passed' : 'Submit for Evaluation'}
                  </button>
              </div>

            </div>
        </div>

        {/* Close Confirmation Modal */}
        {showCloseConfirm && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 24, backdropFilter: 'blur(4px)' }}>
                <div style={{ background: '#fff', padding: 32, borderRadius: 20, boxShadow: '0 25px 50px rgba(0,0,0,0.15)', maxWidth: 400, width: '90%', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, background: '#fef3c7', color: '#d97706', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <Save size={32} />
                    </div>
                    <h3 style={{ margin: '0 0 12px', fontSize: 20, color: '#0f172a', fontWeight: 800 }}>Unsaved Changes</h3>
                    <p style={{ margin: '0 0 24px', fontSize: 15, color: '#475569', lineHeight: 1.6 }}>You have started answering this task. What would you like to do with your progress?</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <button type="button" onClick={() => { setShowCloseConfirm(false); onClose(); }} style={{ padding: '14px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                            Save Draft & Close
                        </button>
                        <button type="button" onClick={() => { clearDraft(); setShowCloseConfirm(false); onClose(); }} style={{ padding: '14px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                            Discard Changes & Close
                        </button>
                        <button type="button" onClick={() => setShowCloseConfirm(false)} style={{ padding: '14px', background: 'transparent', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                            Keep Editing
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
      
      {/* AI Chat Drawer */}
      <AssignmentChatDrawer questions={task.questions || task.mcqConfig?.questions || []}
        assignmentId={task.id}
        assignmentTitle={task.title}
        accessToken={accessToken}
        onClose={() => setIsChatDrawerOpen(false)}
        isOpen={isChatDrawerOpen}
      />
    </div>,
    document.body
  );
};
