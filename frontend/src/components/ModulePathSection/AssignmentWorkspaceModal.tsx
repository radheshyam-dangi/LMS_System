/**
 * AssignmentWorkspaceModal.tsx
 *
 * Step 2 of the Trainee Assignment Submission Lifecycle.
 * Active workspace containing question sets (MCQ, Subjective, Attachment),
 * real-time response inputs, integrated contextual AI Chat Drawer (if enabled),
 * draft auto-saving, and the final submission pipeline.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowLeft,
  Send,
  Save,
  Bot,
  HelpCircle,
  Paperclip,
  AlertCircle,
  FileQuestion,
  Lock,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { extractModalQuestions } from '../SharedCards/SharedAssignmentModal';
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
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Normalize questions
  const questionsArray = extractModalQuestions(task);

  // Load drafts or previous submissions
  useEffect(() => {
    if (!task?.id) return;
    const draftKey = `draft_assignment_${task.id}`;
    let prefilledSubj: Record<number, any> = {};
    let prefilledText = '';
    let prefilledAtt = '';
    let prefilledMcq: Record<number, any> = {};

    // Check localStorage draft first
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        prefilledText = parsed.text || '';
        prefilledSubj = parsed.subj || {};
        prefilledMcq = parsed.mcq || {};
        prefilledAtt = parsed.att || '';
      } catch {}
    } else if (submission?.submissionText) {
      try {
        prefilledText = submission.submissionText;
        if (submission.submissionText.startsWith('{')) {
          const parsed = JSON.parse(submission.submissionText);
          prefilledSubj = parsed.textAnswers || parsed.answers || {};
          prefilledMcq = parsed.mcqAnswers || {};
        }
      } catch {}
    }

    setSubmissionText(prefilledText);
    setSubjectiveAnswers(prefilledSubj);
    setMcqAnswers(prefilledMcq);
    setAttachmentUrl(prefilledAtt);
  }, [task?.id, submission]);

  // Autosave draft to localStorage
  useEffect(() => {
    if (!task?.id || !isOpen) return;
    const draftData = {
      text: submissionText,
      subj: subjectiveAnswers,
      mcq: mcqAnswers,
      att: attachmentUrl,
    };
    localStorage.setItem(`draft_assignment_${task.id}`, JSON.stringify(draftData));
  }, [task?.id, isOpen, submissionText, subjectiveAnswers, mcqAnswers, attachmentUrl]);

  // Handle MCQ Selection
  const handleMcqSelect = (qIdx: number, optIdx: number, isMulti: boolean) => {
    if (isMulti) {
      const current = (mcqAnswers[qIdx] as number[]) || [];
      const updated = current.includes(optIdx)
        ? current.filter((x) => x !== optIdx)
        : [...current, optIdx];
      setMcqAnswers({ ...mcqAnswers, [qIdx]: updated });
    } else {
      setMcqAnswers({ ...mcqAnswers, [qIdx]: optIdx });
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (isSubmitting) return;

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
        if (q.type === 'MCQ') {
          return {
            questionId: String(q.id ?? idx),
            answer: mcqAnswers[idx] !== undefined ? String(mcqAnswers[idx]) : '',
          };
        }
        return {
          questionId: String(q.id ?? idx),
          answer: subjectiveAnswers[idx] || '',
        };
      });

      const normalizedMcqAnswers: Record<string, number> = {};
      Object.entries(mcqAnswers).forEach(([k, v]) => {
        normalizedMcqAnswers[String(k)] = Array.isArray(v) ? (v[0] ?? 0) : Number(v);
      });

      const payload = {
        answers: formattedAnswers,
        mcqAnswers: normalizedMcqAnswers,
        submissionText: submissionText.trim() || JSON.stringify({ answers: formattedAnswers, textAnswers: subjectiveAnswers }),
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
        padding: isChatDrawerOpen ? '16px calc(min(450px, 42vw)) 16px 20px' : '16px',
        animation: 'aimFadeIn 0.2s ease-out',
        transition: 'padding 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        className="aim-modal-container"
        style={{
          width: '100%',
          maxWidth: isChatDrawerOpen ? '880px' : '820px',
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
          transition: 'max-width 0.25s ease',
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
              <Bot size={15} />
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
                          onClick={() => handleMcqSelect(qIdx, optIdx, Boolean(q.allowMultipleCorrect))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                            background: isSelected ? '#f5f3ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type={q.allowMultipleCorrect ? 'checkbox' : 'radio'}
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ accentColor: '#4f46e5', cursor: 'pointer' }}
                          />
                          <span
                            style={{
                              fontSize: '13.5px',
                              color: isSelected ? '#312e81' : '#334155',
                              fontWeight: isSelected ? 600 : 400,
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
                      onChange={(e) => setSubjectiveAnswers({ ...subjectiveAnswers, [qIdx]: e.target.value })}
                      placeholder="Type your response here..."
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
                        resize: 'vertical',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                      onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
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
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://github.com/your-username/project or Drive link"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
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
              Save & Exit
            </button>

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
             
              <span>{isSubmitting ? 'Submitting...' : 'Submit Assessment'}</span>
            </button>
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
          />
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
