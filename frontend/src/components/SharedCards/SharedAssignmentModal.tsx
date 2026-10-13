import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bot, X, ChevronRight, Save, CheckCircle2, HelpCircle } from 'lucide-react';
import DOMPurify from 'dompurify';
import { resolveAssignmentInstructions } from '../../utils/assignmentInstructions';
import { AssignmentChatDrawer } from '../TraineeSubmissionsView/AssignmentChatDrawer';
import { renderMultilineText } from '../../utils/textUtils';
import { assignmentService } from '../../services/assignmentService';
import { useToast } from '../../context/ToastContext';

interface SharedAssignmentModalProps {
  task: any;
  submission: any;
  accessToken: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Extracts and normalizes questions from all possible assignment structures:
 * - Direct array: task.questions
 * - MCQ questions: task.mcqConfig.questions
 * - Single MCQ config: task.mcqConfig.options
 * - Stringified JSON in task.questions or task.mcqConfig
 * - Direct options on task
 */
export function extractModalQuestions(task: any): any[] {
  if (!task) return [];

  let rawList: any[] = [];

  // 1. Direct array in task.questions
  if (Array.isArray(task.questions) && task.questions.length > 0) {
    rawList = task.questions;
  }
  // 2. Direct array in task.mcqConfig?.questions
  else if (Array.isArray(task.mcqConfig?.questions) && task.mcqConfig.questions.length > 0) {
    rawList = task.mcqConfig.questions;
  }
  // 3. Stringified task.questions JSON
  else if (typeof task.questions === 'string' && task.questions.trim().length > 0) {
    try {
      const parsed = JSON.parse(task.questions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        rawList = parsed;
      } else if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
        rawList = parsed.questions;
      }
    } catch {}
  }
  // 4. Stringified task.mcqConfig JSON
  else if (typeof task.mcqConfig === 'string' && task.mcqConfig.trim().length > 0) {
    try {
      const parsed = JSON.parse(task.mcqConfig);
      if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
        rawList = parsed.questions;
      } else if (Array.isArray(parsed?.options) && parsed.options.length > 0) {
        rawList = [{
          id: '0',
          text: task.title || task.description || 'Question 1',
          options: parsed.options,
          correctIndex: parsed.correctIndex ?? 0,
          maxPoints: task.maxScore || 10,
          type: 'MCQ',
        }];
      }
    } catch {}
  }
  // 5. task.mcqConfig as a single question object with options & correctIndex
  else if (task.mcqConfig && Array.isArray(task.mcqConfig.options) && task.mcqConfig.options.length > 0) {
    rawList = [{
      id: '0',
      text: task.title || task.description || 'Question 1',
      options: task.mcqConfig.options,
      correctIndex: task.mcqConfig.correctIndex ?? 0,
      maxPoints: task.maxScore || 10,
      type: 'MCQ',
    }];
  }
  // 6. Direct options array on task
  else if (Array.isArray(task.options) && task.options.length > 0) {
    rawList = [{
      id: '0',
      text: task.title || task.description || 'Question 1',
      options: task.options,
      correctIndex: task.correctIndex ?? 0,
      maxPoints: task.maxScore || 10,
      type: 'MCQ',
    }];
  }

  // Normalize each question object
  return rawList.map((q: any, idx: number) => {
    const qId = String(q.id ?? idx);
    let rawText = q.questionText || q.text || q.question || q.prompt || '';
    if (!rawText.trim() && rawList.length === 1) {
      rawText = task.title || task.description || `Question ${idx + 1}`;
    } else if (!rawText.trim()) {
      rawText = `Question ${idx + 1}`;
    }

    let options: string[] = [];
    if (Array.isArray(q.options)) {
      options = q.options.map((opt: any, optIdx: number) => {
        if (typeof opt === 'string') return opt;
        if (opt && typeof opt === 'object') {
          return opt.text || opt.optionText || opt.label || opt.value || `Option ${optIdx + 1}`;
        }
        return String(opt ?? `Option ${optIdx + 1}`);
      });
    }

    const hasOptions = options.length > 0;
    const isMcq = (q.type || q.questionType || '').toUpperCase() === 'MCQ' || (task.assignmentType === 'MCQ') || hasOptions;

    return {
      ...q,
      id: qId,
      text: rawText,
      type: isMcq ? 'MCQ' : (q.type || 'Subjective'),
      options,
      maxPoints: Number(q.maxPoints ?? q.points ?? (task.maxScore && rawList.length === 1 ? task.maxScore : 10)),
      allowMultipleCorrect: Boolean(q.allowMultipleCorrect),
      correctIndex: q.correctIndex,
    };
  });
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

  // Normalize questions once for consistent state & rendering
  const questionsArray = extractModalQuestions(task);

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
    // Clear any cached local draft on open so modal starts with clean state & NO option selected
    localStorage.removeItem(draftKey);

    let prefilledSubj: Record<number, any> = {};
    let prefilledText = '';
    let prefilledAtt = '';

    if (submission?.submissionText) {
      try {
        prefilledText = submission.submissionText;
        if (submission.submissionText.startsWith('{')) {
          const parsed = JSON.parse(submission.submissionText);
          prefilledSubj = parsed.textAnswers || parsed.answers || {};
        }
      } catch (e) {}
    } else if (submission?.answers && Array.isArray(submission.answers)) {
      try {
        submission.answers.forEach((ansItem: any, idx: number) => {
          const num = Number(ansItem.answer);
          if (isNaN(num)) {
            prefilledSubj[idx] = ansItem.answer;
          }
        });
      } catch (e) {}
    }

    setSubmissionText(prefilledText);
    setSubjectiveAnswers(prefilledSubj);
    // 🌟 On initial open, no option is selected so trainee can freshly choose any option
    setMcqAnswers({});
    setAttachmentUrl(prefilledAtt);
    
    setInitialStateStr(JSON.stringify({ text: prefilledText, subj: prefilledSubj, mcq: {}, att: prefilledAtt }));
    
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

    // Validate that each MCQ question has an option selected before submitting
    for (let i = 0; i < questionsArray.length; i++) {
      const q = questionsArray[i];
      const isMCQ = q.type === 'MCQ' || (q.options && q.options.length > 0);
      if (isMCQ) {
        const selected = mcqAnswers[i];
        const hasSelection = q.allowMultipleCorrect
          ? Array.isArray(selected) && selected.length > 0
          : selected !== undefined && selected !== null;
        if (!hasSelection) {
          toast.warning(`Please select an option for Question ${i + 1} before submitting.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      let finalSubmissionText = submissionText;
      
      const structuredAnswers: Array<{ questionId: string; answer: string }> = questionsArray.map((q: any, idx: number) => {
        const qId = q.id || String(idx);
        const isMCQ = q.type === 'MCQ' || (q.options?.length > 0);
        if (isMCQ) {
          const selectedIdx = mcqAnswers[idx];
          if (Array.isArray(selectedIdx)) {
            return {
              questionId: qId,
              answer: selectedIdx.map((i: number) => q.options?.[i] ?? String(i)).join(', '),
            };
          }
          const ansString = typeof selectedIdx === 'number' && q.options?.[selectedIdx] !== undefined
            ? q.options[selectedIdx]
            : (typeof selectedIdx === 'number' ? String(selectedIdx) : '');
          return {
            questionId: qId,
            answer: ansString,
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
      setIsSubmitting(false);
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

  const { content: instructionContent } = resolveAssignmentInstructions(task);
  const safeInstructionHTML = DOMPurify.sanitize(instructionContent);

  const isResubmit = submission && submission.status !== 'AVAILABLE' && submission.status !== 'LOCKED' && submission.status !== 'Pending';
  const qScores = submission?.questionScores || submission?.aiQuestionScores || {};
  let prevAnswersParsed: Record<string, any> = {};
  if (submission?.submissionText) {
    try {
      const parsed = JSON.parse(submission.submissionText);
      if (parsed.answers) prevAnswersParsed = parsed.answers;
    } catch (e) {}
  }

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  const renderQuestionText = (text: string) => {
    if (!text) return <span>No question text</span>;
    const hasHtml = /<[a-z][\s\S]*>/i.test(text);
    if (hasHtml) {
      return (
        <div 
          className="question-html-content"
          style={{ fontSize: 16, lineHeight: 1.6, color: '#0f172a' }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text) }} 
        />
      );
    }
    return (
      <div style={{ fontSize: 16, lineHeight: 1.6, color: '#0f172a', fontWeight: 600 }}>
        {renderMultilineText(text)}
      </div>
    );
  };

  const renderOptionText = (opt: string, oi: number) => {
    if (!opt) return <span>Option {oi + 1}</span>;
    const hasHtml = /<[a-z][\s\S]*>/i.test(opt);
    if (hasHtml) {
      return (
        <div 
          className="option-html-content"
          style={{ fontSize: 15, lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opt) }} 
        />
      );
    }
    return <span>{opt}</span>;
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '24px' }} onClick={handleCloseRequest}>
      <div 
        ref={containerRef}
        style={{ 
          '--chat-panel-width': '420px',
          width: '100%', 
          maxWidth: isChatDrawerOpen ? 'calc(100vw - var(--chat-panel-width) - 48px)' : 780, 
          height: '92dvh', maxHeight: 920, overflowY: 'hidden', 
          background: '#fff', borderRadius: 24, display: 'flex', flexDirection: 'column', position: 'relative', 
          boxShadow: '0 25px 80px rgba(0,0,0,0.22)',
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
                    <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 6, fontWeight: 600, color: '#334155' }}>
                      {task.assignmentType || 'MCQ'}
                    </span>
                    <span>{task.lessonTitle || 'Module Task'}</span>
                    
                    {timeLeftStr && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: isOverdue || (timeLeftStr && timeLeftStr.includes('0d 00:')) ? '#fee2e2' : '#fef3c7', color: isOverdue || (timeLeftStr && timeLeftStr.includes('0d 00:')) ? '#b91c1c' : '#b45309', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>
                        ⏳ {timeLeftStr}
                      </span>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* 🌟 AI Ask button: Removed on instruction modal, only accessible when questions are active */}
                {step === 'questions' && (
                  <button
                    type="button"
                    onClick={() => setIsChatDrawerOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '8px 14px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <Bot size={16} /> Ask AI
                  </button>
                )}
                <button type="button" onClick={handleCloseRequest} style={{ border: 'none', background: '#f1f5f9', borderRadius: '10px', width: 36, height: 36, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            
            {/* Step 1: Instructions */}
            <div style={{ display: step === 'instructions' ? 'flex' : 'none', flexDirection: 'column', minHeight: '100%' }}>
                <div style={{ padding: '32px 28px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📖</div>
                      <div>
                          <h4 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 700 }}>Assignment Instructions</h4>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Please read all requirements carefully before proceeding</p>
                      </div>
                  </div>

                  <div className="rich-text-content" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, fontSize: 15, color: '#334155', lineHeight: 1.7, marginBottom: 28 }} dangerouslySetInnerHTML={{ __html: safeInstructionHTML || 'No instructions provided.' }} />

                  {task.externalUrl && (
                      <a href={task.externalUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', color: '#2563eb', fontWeight: 600, marginBottom: 28, transition: 'all 0.2s' }}>
                          🔗 Reference Resource: {task.externalUrl}
                      </a>
                  )}
                </div>
                
                {/* Step 1 Footer */}
                <div style={{ position: 'sticky', bottom: 0, padding: '18px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
                    <button 
                        type="button" 
                        onClick={handleStartTask} 
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,42,0.2)', transition: 'all 0.15s' }}
                    >
                        {task.anchorType === 'TASK_START' && (!submission || submission.status === 'AVAILABLE' || submission.rawStatus === 'AVAILABLE') ? 'Now I will do task' : 'Continue to Questions'} 
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Step 2: Questions & Submit */}
            <div style={{ display: step === 'questions' ? 'flex' : 'none', flexDirection: 'column', minHeight: '100%' }}>
                <div style={{ padding: '24px 28px', flex: 1 }}>
                  
                  {/* Top Toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                      <button 
                        type="button" 
                        onClick={() => setStep('instructions')} 
                        style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}
                      >
                          ← Back to Instructions
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                          {questionsArray.length} {questionsArray.length === 1 ? 'Question' : 'Questions'}
                        </span>
                        {hasUnsavedChanges && (
                          <span style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                            <Save size={14} /> Draft saved
                          </span>
                        )}
                      </div>
                  </div>
                  
                  <form id="assignment-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      
                      {questionsArray.length > 0 ? (
                        questionsArray.map((q: any, idx: number) => {
                          const options = q.options || [];
                          const hasOptions = options.length > 0;
                          const qId = q.id || String(idx);
                          const previousEvaluation = qScores[qId] || qScores[idx];
                          const prevAnsVal = prevAnswersParsed[idx] ?? prevAnswersParsed[String(idx)];
                          const isMcq = q.type === 'MCQ' || hasOptions;

                          let formattedPrevAns = '';
                          if (isMcq) {
                            if (Array.isArray(prevAnsVal)) {
                              formattedPrevAns = prevAnsVal.map((v: any) => options[Number(v)] || v).filter(Boolean).join(', ');
                            } else if (prevAnsVal !== undefined && prevAnsVal !== null && prevAnsVal !== '') {
                              formattedPrevAns = String(options[Number(prevAnsVal)] ?? prevAnsVal ?? '').trim();
                            }
                          } else if (prevAnsVal !== undefined && prevAnsVal !== null) {
                            formattedPrevAns = String(prevAnsVal).trim();
                          }
                          const hasPrevAnswer = Boolean(isResubmit && formattedPrevAns.length > 0);

                          return (
                            <div 
                              key={idx} 
                              style={{ 
                                padding: '24px 26px', 
                                background: '#ffffff', 
                                border: '1.5px solid #e2e8f0', 
                                borderRadius: 16,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 16,
                              }}
                            >
                              {/* Question Header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                                <div style={{ display: 'flex', gap: 12, flex: 1, alignItems: 'flex-start' }}>
                                  <span 
                                    style={{ 
                                      fontSize: 14, 
                                      color: '#4f46e5', 
                                      background: '#eef2ff', 
                                      border: '1px solid #c7d2fe',
                                      width: 32, 
                                      height: 32, 
                                      borderRadius: '8px', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center', 
                                      flexShrink: 0,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {idx + 1}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {renderQuestionText(q.text)}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                                  <span style={{ fontSize: 11, color: '#475569', fontWeight: 700, background: '#f1f5f9', padding: '4px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {isMcq ? (q.allowMultipleCorrect ? 'Multiple Choice' : 'Single Choice') : 'Subjective'}
                                  </span>
                                  <span style={{ fontSize: 12, color: '#0284c7', fontWeight: 700, background: '#f0f9ff', padding: '3px 8px', borderRadius: 6 }}>
                                    {q.maxPoints || 10} pts
                                  </span>
                                  {isResubmit && previousEvaluation !== undefined && (
                                    <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 700, background: '#fee2e2', padding: '3px 8px', borderRadius: 6 }}>
                                      Score: {typeof previousEvaluation === 'object' ? previousEvaluation.score : previousEvaluation} pts
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Previous Answer (if resubmission and non-empty) */}
                              {hasPrevAnswer && (
                                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>Your Previous Answer</span>
                                  <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>
                                    {formattedPrevAns}
                                  </div>
                                </div>
                              )}

                              {/* Trainer Feedback (if available) */}
                              {isResubmit && previousEvaluation && previousEvaluation.feedback && (
                                <div style={{ padding: '14px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e', display: 'flex', gap: '10px' }}>
                                  <span style={{ fontSize: '18px' }}>💬</span>
                                  <div>
                                    <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.04em' }}>Feedback</strong>
                                    <div style={{ lineHeight: 1.5 }}>{previousEvaluation.feedback}</div>
                                  </div>
                                </div>
                              )}

                              {/* Options List for MCQ */}
                              {isMcq ? (
                                !hasOptions ? (
                                  <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, fontSize: 13, fontWeight: 500 }}>
                                    ⚠️ No options configured for this question.
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                                    {options.map((opt: string, oi: number) => {
                                        const isChecked = q.allowMultipleCorrect
                                          ? (Array.isArray(mcqAnswers[idx]) ? (mcqAnswers[idx] as any as number[]).includes(oi) : false)
                                          : mcqAnswers[idx] === oi;
                                        const letter = optionLetters[oi] || `${oi + 1}`;
                                        
                                        return (
                                          <label 
                                            key={oi} 
                                            style={{ 
                                              fontSize: 15, 
                                              display: 'flex', 
                                              gap: 14, 
                                              alignItems: 'center', 
                                              cursor: 'pointer', 
                                              padding: '14px 18px', 
                                              borderRadius: 12, 
                                              background: isChecked ? '#f0f7ff' : '#ffffff', 
                                              border: isChecked ? '2px solid #3b82f6' : '1.5px solid #e2e8f0', 
                                              boxShadow: isChecked ? '0 2px 8px rgba(59, 130, 246, 0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
                                              transition: 'all 0.18s ease-in-out',
                                            }}
                                            onMouseEnter={(e) => {
                                              if (!isChecked) {
                                                e.currentTarget.style.borderColor = '#93c5fd';
                                                e.currentTarget.style.background = '#f8fafc';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!isChecked) {
                                                e.currentTarget.style.borderColor = '#e2e8f0';
                                                e.currentTarget.style.background = '#ffffff';
                                              }
                                            }}
                                          >
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
                                              style={{ width: 18, height: 18, accentColor: '#3b82f6', cursor: 'pointer', flexShrink: 0 }}
                                            />
                                            <span 
                                              style={{ 
                                                width: 28, 
                                                height: 28, 
                                                borderRadius: '50%', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                fontSize: 13, 
                                                fontWeight: 700, 
                                                flexShrink: 0, 
                                                background: isChecked ? '#3b82f6' : '#f1f5f9', 
                                                color: isChecked ? '#ffffff' : '#475569',
                                                transition: 'all 0.18s ease-in-out',
                                              }}
                                            >
                                              {letter}
                                            </span>
                                            <div style={{ flex: 1, color: isChecked ? '#0f172a' : '#334155', fontWeight: isChecked ? 600 : 400, fontSize: 15, lineHeight: 1.5 }}>
                                              {renderOptionText(opt, oi)}
                                            </div>
                                          </label>
                                      );
                                    })}
                                  </div>
                                )
                              ) : (
                                <textarea
                                  className="answer-textarea"
                                  rows={5}
                                  value={subjectiveAnswers[idx] || ''}
                                  onChange={(e) => setSubjectiveAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                                  placeholder="Type your detailed answer here..."
                                  style={{ width: '100%', padding: 16, borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: 15, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                                  onFocus={(e) => {
                                    e.target.style.borderColor = '#3b82f6';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.borderColor = '#cbd5e1';
                                    e.target.style.boxShadow = 'none';
                                  }}
                                />
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
                          <label style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Your Submission</label>
                          <textarea
                            required
                            rows={10}
                            value={submissionText}
                            onChange={(e) => setSubmissionText(e.target.value)}
                            placeholder="Write your comprehensive submission here..."
                            style={{ width: '100%', padding: 18, borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: 15, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                          />
                        </div>
                      )}

                      {/* Optional Attachment Link */}
                      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                              🔗 Attachment URL <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                          </label>
                          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>Link to your GitHub repo, Google Drive folder, or external workspace.</p>
                          <input
                              type="url"
                              placeholder="https://..."
                              value={attachmentUrl}
                              onChange={(e) => setAttachmentUrl(e.target.value)}
                              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                          />
                      </div>
                      
                  </form>
                </div>

                {/* Step 2 Sticky Footer */}
                <div 
                  style={{ 
                    position: 'sticky', 
                    bottom: 0, 
                    padding: '18px 28px', 
                    borderTop: '1px solid #e2e8f0', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    background: 'rgba(255,255,255,0.96)', 
                    backdropFilter: 'blur(8px)', 
                    zIndex: 10 
                  }}
                >
                    <button 
                      type="button" 
                      onClick={handleCloseRequest} 
                      style={{ padding: '12px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
                    >
                        Cancel
                    </button>
                    <button 
                      form="assignment-form" 
                      type="submit" 
                      disabled={isSubmitting || isOverdue} 
                      style={{ 
                        padding: '12px 28px', 
                        background: isOverdue ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5, #4338ca)', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: 10, 
                        fontSize: 14, 
                        fontWeight: 700, 
                        cursor: isOverdue || isSubmitting ? 'not-allowed' : 'pointer', 
                        boxShadow: isOverdue ? 'none' : '0 4px 12px rgba(79,70,229,0.3)', 
                        opacity: isSubmitting ? 0.7 : 1,
                        transition: 'all 0.15s'
                      }}
                    >
                        {isSubmitting ? 'Submitting...' : isOverdue ? 'Deadline Passed' : 'Submit for Evaluation'}
                    </button>
                </div>

            </div>
        </div>

        {/* Close Confirmation Modal */}
        {showCloseConfirm && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.92)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 24, backdropFilter: 'blur(4px)' }}>
                <div style={{ background: '#fff', padding: 32, borderRadius: 20, boxShadow: '0 25px 50px rgba(0,0,0,0.15)', maxWidth: 400, width: '90%', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ width: 60, height: 60, background: '#fef3c7', color: '#d97706', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                        <Save size={28} />
                    </div>
                    <h3 style={{ margin: '0 0 10px', fontSize: 19, color: '#0f172a', fontWeight: 800 }}>Unsaved Changes</h3>
                    <p style={{ margin: '0 0 22px', fontSize: 14, color: '#475569', lineHeight: 1.6 }}>You have started answering this task. What would you like to do with your progress?</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button type="button" onClick={() => { setShowCloseConfirm(false); onClose(); }} style={{ padding: '12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                            Save Draft & Close
                        </button>
                        <button type="button" onClick={() => { clearDraft(); setShowCloseConfirm(false); onClose(); }} style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                            Discard Changes & Close
                        </button>
                        <button type="button" onClick={() => setShowCloseConfirm(false)} style={{ padding: '12px', background: 'transparent', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                            Keep Editing
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
      
      {/* AI Chat Drawer */}
      <AssignmentChatDrawer 
        questions={questionsArray}
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

