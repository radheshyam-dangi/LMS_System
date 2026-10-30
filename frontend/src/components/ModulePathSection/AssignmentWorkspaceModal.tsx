/**
 * AssignmentWorkspaceModal.tsx
 *
 * Step 2 of the Trainee Assignment Submission Lifecycle.
 * Active workspace containing question sets (MCQ, Subjective, Attachment),
 * real-time response inputs, integrated contextual AI Chat Drawer (if enabled),
 * draft auto-saving, and the final submission pipeline.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowLeft,
  Send,
  Save,
  HelpCircle,
  Paperclip,
  AlertCircle,
  FileQuestion,
  Lock,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { extractModalQuestions } from '../SharedCards/SharedAssignmentModal';
import { extractAnswersFromSubmission } from '../../utils/assignmentAnswers';
import { AssignmentChatDrawer } from '../TraineeSubmissionsView/AssignmentChatDrawer';
import { assignmentService } from '../../services/assignmentService';
import { useToast } from '../../context/ToastContext';

interface AssignmentWorkspaceModalProps {
  task: any;
  submission: any;
  accessToken: string;
  isOpen: boolean;
  onClose: () => void;
  onBackToInstructions: () => void;
  onSuccess: () => void;
}

export const AssignmentWorkspaceModal: React.FC<AssignmentWorkspaceModalProps> = ({
  task,
  submission,
  accessToken,
  isOpen,
  onClose,
  onBackToInstructions,
  onSuccess,
}) => {
  const toast = useToast();
  const [submissionText, setSubmissionText] = useState('');
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<{ [key: number]: string }>({});
  const [mcqAnswers, setMcqAnswers] = useState<{ [key: number]: number | number[] }>({});
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [chatDrawerWidth, setChatDrawerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('skillforge_assignment_chat_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 360 && parsed <= 850) {
          return parsed;
        }
      }
    } catch {}
    return 440;
  });
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Normalize questions once per task
  const questionsArray = useMemo(() => extractModalQuestions(task), [task]);

  const [activeSubmission, setActiveSubmission] = useState<any>(submission);
  const fetchedAssignmentIdRef = useRef<string | null>(null);
  const initializedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (submission) {
      setActiveSubmission(submission);
    }
  }, [submission]);

  // If no submission is passed or answers are empty, fetch from assignmentService (once per open)
  useEffect(() => {
    if (!isOpen) {
      fetchedAssignmentIdRef.current = null;
      return;
    }
    if (!task?.id || !accessToken || fetchedAssignmentIdRef.current === String(task.id)) return;
    if (submission?.submissionText || submission?.answers) return;

    fetchedAssignmentIdRef.current = String(task.id);
    assignmentService
      .fetchMySubmissions(accessToken)
      .then((subs) => {
        if (Array.isArray(subs)) {
          const found = subs.find(
            (s: any) =>
              String(s.assignment?.id) === String(task.id) ||
              String(s.assignmentId) === String(task.id) ||
              String(s.id) === String(task.id)
          );
          if (found) {
            setActiveSubmission(found);
          }
        }
      })
      .catch(() => {});
  }, [task?.id, accessToken, isOpen, submission]);

  const deadlineValue =
    activeSubmission?.deadline ||
    submission?.deadline ||
    task?.deadline ||
    task?.dueDate ||
    task?.computedDeadline;
  const isExpired = Boolean(deadlineValue && new Date(deadlineValue).getTime() < Date.now());

  // Load previous submissions or drafts once when modal opens or task/submission changes
  useEffect(() => {
    if (!isOpen || !task?.id) {
      initializedIdRef.current = null;
      return;
    }

    const currentKey = `${task.id}_${activeSubmission?.id || 'none'}_${activeSubmission?.submittedAt || 'draft'}`;
    if (initializedIdRef.current === currentKey) return;
    initializedIdRef.current = currentKey;

    const draftKey = `draft_assignment_${task.id}`;

    // 1. Extract answers directly from submission
    const fromSub = extractAnswersFromSubmission(activeSubmission, questionsArray);
    const hasSubmittedData =
      Object.keys(fromSub.subj).length > 0 ||
      Object.keys(fromSub.mcq).length > 0 ||
      Boolean(fromSub.text.trim()) ||
      Boolean(fromSub.att.trim()) ||
      Boolean(activeSubmission?.submittedAt);

    let prefilledSubj = fromSub.subj;
    let prefilledMcq = fromSub.mcq;
    let prefilledText = fromSub.text;
    let prefilledAtt = fromSub.att;

    // 2. Only if NOT expired and no submitted answers exist, check localStorage draft
    if (!isExpired && !hasSubmittedData) {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.subj && Object.keys(parsed.subj).length > 0) prefilledSubj = parsed.subj;
          if (parsed.mcq && Object.keys(parsed.mcq).length > 0) prefilledMcq = parsed.mcq;
          if (parsed.text) prefilledText = parsed.text;
          if (parsed.att) prefilledAtt = parsed.att;
        } catch {}
      }
    }

    setSubmissionText(prefilledText);
    setSubjectiveAnswers(prefilledSubj);
    setMcqAnswers(prefilledMcq);
    setAttachmentUrl(prefilledAtt);
  }, [isOpen, task?.id, activeSubmission, isExpired, questionsArray]);

  // Autosave draft to localStorage (only if NOT expired)
  useEffect(() => {
    if (!task?.id || !isOpen || isExpired) return;
    const draftData = {
      text: submissionText,
      subj: subjectiveAnswers,
      mcq: mcqAnswers,
      att: attachmentUrl,
    };
    localStorage.setItem(`draft_assignment_${task.id}`, JSON.stringify(draftData));
  }, [task?.id, isOpen, isExpired, submissionText, subjectiveAnswers, mcqAnswers, attachmentUrl]);

  // Handle MCQ Selection using functional state update
  const handleMcqSelect = (qIdx: number, optIdx: number, isMulti: boolean) => {
    if (isExpired) return;
    setMcqAnswers((prev) => {
      if (isMulti) {
        const current = Array.isArray(prev[qIdx]) ? (prev[qIdx] as number[]) : [];
        const updated = current.includes(optIdx)
          ? current.filter((x) => x !== optIdx)
          : [...current, optIdx];
        return { ...prev, [qIdx]: updated };
      } else {
        return { ...prev, [qIdx]: optIdx };
      }
    });
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (isExpired) {
      toast.error('The deadline for this assignment has expired. Submissions and resubmissions are closed.');
      return;
    }

    // Check if at least some questions or answers are filled
    const hasSubj = Object.values(subjectiveAnswers).some((val) => typeof val === 'string' && val.trim().length > 0);
    const hasMcq = Object.keys(mcqAnswers).length > 0;
    const hasDirectText = submissionText.trim().length > 0;

    if (!hasSubj && !hasMcq && !hasDirectText && !attachmentUrl.trim()) {
      toast.warning('Please answer the questions before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Build structured submission payload
      const formattedAnswers: { questionId: string; answer: string }[] = questionsArray.map((q, idx) => {
        const isMcq = q.type === 'MCQ' || (Array.isArray(q.options) && q.options.length > 0);
        if (isMcq) {
          const sel = mcqAnswers[idx] !== undefined ? mcqAnswers[idx] : (mcqAnswers as any)[String(idx)];
          let ansStr = '';
          if (typeof sel === 'number') {
            ansStr = q.options?.[sel] ? q.options[sel] : String(sel);
          } else if (Array.isArray(sel)) {
            ansStr = sel.map((i: number) => q.options?.[i] ?? String(i)).join(', ');
          } else if (sel !== undefined && sel !== null) {
            ansStr = String(sel);
          }
          return {
            questionId: String(q.id ?? idx),
            answer: ansStr,
          };
        }
        return {
          questionId: String(q.id ?? idx),
          answer: subjectiveAnswers[idx] || (subjectiveAnswers as any)[String(idx)] || '',
        };
      });

      const normalizedMcqAnswers: Record<string, number> = {};
      Object.entries(mcqAnswers).forEach(([k, v]) => {
        normalizedMcqAnswers[String(k)] = Array.isArray(v) ? (v[0] ?? 0) : Number(v);
      });

      const payload = {
        answers: formattedAnswers,
        mcqAnswers: normalizedMcqAnswers,
        submissionText: JSON.stringify({
          answers: formattedAnswers,
          mcqAnswers: normalizedMcqAnswers,
          textAnswers: subjectiveAnswers,
          raw: submissionText.trim(),
        }),
        attachmentUrl: attachmentUrl.trim(),
      };

      await assignmentService.submitAssignment(task.id, payload, accessToken);

      // Clean draft
      localStorage.removeItem(`draft_assignment_${task.id}`);
      toast.success('Assignment submitted successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to submit assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !task) return null;

  const modalContent = (
    <div
      className="aim-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isChatDrawerOpen ? 'flex-start' : 'center',
        padding: isChatDrawerOpen ? '16px 0 16px 16px' : '16px',
        animation: 'aimFadeIn 0.2s ease-out',
      }}
    >
      <div
        className="aim-modal-container"
        style={{
          width: isChatDrawerOpen ? `calc(100vw - ${chatDrawerWidth}px - 32px)` : '100%',
          maxWidth: isChatDrawerOpen ? `calc(100vw - ${chatDrawerWidth}px - 32px)` : '820px',
          height: '92vh',
          maxHeight: '92vh',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 30px -5px rgba(15, 23, 42, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* ── Workspace Header ── */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onBackToInstructions}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s',
              }}
              title="Return to Instructions"
            >
              <ArrowLeft size={14} /> Instructions
            </button>
            <div style={{ height: '18px', width: '1px', background: '#e2e8f0' }} />
            <div>
              <h4
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0,
                  maxWidth: '420px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {task.title}
              </h4>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Step 2 of 2: Assessment Workspace · {questionsArray.length} {questionsArray.length === 1 ? 'Question' : 'Questions'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* AI Assistant toggle - Always available for trainee questions */}
            <button
              type="button"
              onClick={() => setIsChatDrawerOpen(!isChatDrawerOpen)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: isChatDrawerOpen ? '#6366f1' : '#f5f3ff',
                color: isChatDrawerOpen ? '#ffffff' : '#4f46e5',
                border: '1.5px solid #c7d2fe',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isChatDrawerOpen ? '0 2px 8px rgba(99, 102, 241, 0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="Ask AI Assistant about this Assignment"
            >
              <span>{isChatDrawerOpen ? 'Close AI Chat' : 'Ask AI'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
              }}
              title="Close Workspace"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Expired Deadline Warning Notice */}
        {isExpired && (
          <div
            style={{
              padding: '10px 20px',
              background: '#fef2f2',
              borderBottom: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
            <span>The deadline for this assignment has expired. Responses are displayed in read-only mode and cannot be submitted or resubmitted.</span>
          </div>
        )}

        {/* ── Workspace Questions Body (Scrollable) ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            background: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {questionsArray.map((q: any, qIdx: number) => {
            const isMcq = q.type === 'MCQ';
            const selectedOpt = mcqAnswers[qIdx];
            const currentSubj = subjectiveAnswers[qIdx] || '';

            return (
              <div
                key={q.id || qIdx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* Question Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: '#eef2ff',
                        color: '#4f46e5',
                        fontWeight: 700,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      {qIdx + 1}
                    </span>
                    <div>
                      <h5
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#0f172a',
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        {q.text}
                      </h5>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#64748b',
                      background: '#f1f5f9',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {q.maxPoints || 10} Pts
                  </span>
                </div>

                {/* Question Input: MCQ options or Subjective Textarea */}
                {isMcq && Array.isArray(q.options) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '36px' }}>
                    {q.options.map((optText: string, optIdx: number) => {
                      const isSelected = q.allowMultipleCorrect
                        ? Array.isArray(selectedOpt) && selectedOpt.includes(optIdx)
                        : selectedOpt === optIdx;

                      return (
                        <label
                          key={optIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                            background: isSelected ? '#f5f3ff' : '#ffffff',
                            cursor: isExpired ? 'default' : 'pointer',
                            opacity: isExpired && !isSelected ? 0.7 : 1,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type={q.allowMultipleCorrect ? 'checkbox' : 'radio'}
                            name={`workspace_mcq_q_${qIdx}`}
                            checked={Boolean(isSelected)}
                            disabled={isExpired}
                            onChange={() => {
                              if (!isExpired) {
                                handleMcqSelect(qIdx, optIdx, Boolean(q.allowMultipleCorrect));
                              }
                            }}
                            style={{ accentColor: '#4f46e5', cursor: isExpired ? 'default' : 'pointer' }}
                          />
                          <span
                            style={{
                              fontSize: '13.5px',
                              color: isSelected ? '#312e81' : '#334155',
                              fontWeight: isSelected ? 600 : 400,
                              userSelect: 'none',
                            }}
                          >
                            {optText}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ paddingLeft: '36px' }}>
                    <textarea
                      value={currentSubj}
                      onChange={(e) => !isExpired && setSubjectiveAnswers({ ...subjectiveAnswers, [qIdx]: e.target.value })}
                      disabled={isExpired}
                      placeholder={isExpired ? 'No response submitted.' : 'Type your response here...'}
                      rows={5}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '13.5px',
                        fontFamily: 'inherit',
                        lineHeight: 1.6,
                        color: '#0f172a',
                        resize: isExpired ? 'none' : 'vertical',
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: isExpired ? '#f8fafc' : '#ffffff',
                      }}
                      onFocus={(e) => !isExpired && (e.target.style.borderColor = '#6366f1')}
                      onBlur={(e) => !isExpired && (e.target.style.borderColor = '#cbd5e1')}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Optional Attachment Link */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Paperclip size={14} /> Optional Resource / Repository Link
            </label>
            <input
              type="url"
              value={attachmentUrl}
              disabled={isExpired}
              onChange={(e) => !isExpired && setAttachmentUrl(e.target.value)}
              placeholder="https://github.com/your-username/project or Drive link"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                background: isExpired ? '#f8fafc' : '#ffffff',
              }}
              onFocus={(e) => !isExpired && (e.target.style.borderColor = '#6366f1')}
              onBlur={(e) => !isExpired && (e.target.style.borderColor = '#cbd5e1')}
            />
          </div>
        </div>

        {/* ── Workspace Footer ── */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              {isExpired ? 'Close' : 'Save & Exit'}
            </button>

            {isExpired ? (
              <div
                style={{
                  padding: '9px 18px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#b91c1c',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={15} />
                <span>Deadline Expired (Submissions Closed)</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  padding: '9px 24px',
                  background: isSubmitting
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#ffffff',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: isSubmitting ? 'none' : '0 2px 6px rgba(22, 163, 74, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isSubmitting ? 'Submitting...' : submission?.submittedAt ? 'Resubmit Assignment' : 'Submit Assessment'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Contextual AI Assistant Drawer ── */}
        {isChatDrawerOpen && (
          <AssignmentChatDrawer
            assignmentId={task.id}
            assignmentTitle={task.title}
            isOpen={isChatDrawerOpen}
            onClose={() => setIsChatDrawerOpen(false)}
            accessToken={accessToken}
            questions={questionsArray}
            focusedQuestionId={focusedQuestionId}
            onWidthChange={setChatDrawerWidth}
            initialWidth={chatDrawerWidth}
          />
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
