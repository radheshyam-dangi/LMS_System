/**
 * AssignmentInstructionModal.tsx
 *
 * Step 1 of the Trainee Assignment Submission Lifecycle.
 * Displays comprehensive assignment metadata, evaluation format (AI-assisted or
 * Instructor-graded), scoring criteria, prerequisites, and clear instructions.
 *
 * Action: Primary "Continue to Questions" transitions the user to Step 2 Workspace.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  Award,
  Calendar,
  AlertCircle,
  ArrowRight,
  ListOrdered,
  Sparkles,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { resolveAssignmentInstructions } from '../../utils/assignmentInstructions';

interface AssignmentInstructionModalProps {
  task: any;
  submission: any;
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export const AssignmentInstructionModal: React.FC<AssignmentInstructionModalProps> = ({
  task,
  submission,
  isOpen,
  onClose,
  onContinue,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  // Resolve assignment instructions and metadata
  const resolved = resolveAssignmentInstructions(task);
  const maxScore = task.maxScore || 100;
  const assignmentType = task.assignmentType || 'Subjective';

  // Questions count
  let questionsCount = 1;
  if (Array.isArray(task.questions)) {
    questionsCount = task.questions.length;
  } else if (task.mcqConfig?.questions && Array.isArray(task.mcqConfig.questions)) {
    questionsCount = task.mcqConfig.questions.length;
  }

  const modalContent = (
    <div
      className="aim-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'aimFadeIn 0.2s ease-out',
      }}
    >
      <div
        className="aim-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'aimSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#eef2ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid #e0e7ff',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#e0e7ff',
                    color: '#4338ca',
                  }}
                >
                  Step 1 of 2: Overview
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#f1f5f9',
                    color: '#475569',
                  }}
                >
                  {assignmentType} Assessment
                </span>
              </div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0,
                  lineHeight: 1.3,
                  letterSpacing: '-0.01em',
                }}
              >
                {task.title || 'Assignment Instructions'}
              </h3>
            </div>
          </div>

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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Modal Body (Scrollable) ── */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
              gap: '12px',
            }}
          >
            {/* Questions count */}
            <div
              style={{
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                <span>Scope</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {questionsCount} {questionsCount === 1 ? 'Question' : 'Questions'}
              </span>
            </div>

            {/* Scoring & Pass mark */}
            <div
              style={{
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                
                <span>Pass Threshold</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {maxScore} Pts (35% Min)
              </span>
            </div>

            {/* Deadline */}
            {task.deadline && (
              <div
                style={{
                  padding: '12px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                  <Calendar size={13} color="#ef4444" />
                  <span>Due Date</span>
                </div>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {new Date(task.deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Guidelines & Instructions Section */}
          <div
            style={{
              padding: '18px 20px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#334155',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Assessment Instructions
            </h4>

            {resolved.content ? (
              <div
                style={{
                  fontSize: '13.5px',
                  lineHeight: 1.65,
                  color: '#334155',
                }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(resolved.content),
                }}
              />
            ) : task.description ? (
              <div
                style={{
                  fontSize: '13.5px',
                  lineHeight: 1.65,
                  color: '#334155',
                }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(task.description),
                }}
              />
            ) : (
              <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
                Please review all prompt questions carefully before submitting your final response.
                Answers can be edited or reviewed prior to final submission.
              </p>
            )}
          </div>

        </div>

        {/* ── Modal Footer ── */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            Back to Module
          </button>

          <button
            type="button"
            onClick={onContinue}
            style={{
              padding: '9px 22px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Continue to Questions</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
