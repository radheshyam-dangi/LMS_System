import React from 'react';
import {
  Lock,
  CheckCircle2,
  CheckSquare,
  Sparkles,
  ClipboardList,
  AlertCircle,
  ArrowRight,
  FileCheck
} from 'lucide-react';
import { DeadlineDisplay } from '../DeadlineDisplay';
import './AssignmentCard.css';

export interface AssignmentContext {
  id: string;
  title: string;
  assignmentType?: string;
  lessonTitle?: string;
  maxScore?: number;
  durationDays?: number;
  durationHours?: number;
  durationMinutes?: number;
  timerDuration?: number;
}

export interface SubmissionContext {
  status?: string;
  score?: number | null;
  deadline?: string | Date;
}

interface Props {
  task: AssignmentContext;
  submission?: SubmissionContext;
  isLocked?: boolean;
  lockReason?: string;
  isTrainee: boolean;
  onClickLocked?: (reason?: string) => void;
  onAttempt?: (task: AssignmentContext) => void;
}

export const AssignmentCard: React.FC<Props> = ({
  task,
  submission,
  isLocked,
  lockReason,
  isTrainee,
  onClickLocked,
  onAttempt,
}) => {
  const status = submission?.status || 'Pending';
  const isExpired = submission?.deadline && new Date(submission.deadline).getTime() < Date.now();

  const maxScore = task.maxScore || (task as any).points || 100;
  const scorePct = typeof submission?.score === 'number' ? (submission.score / maxScore) * 100 : null;
  const isBelow35 = scorePct !== null && scorePct < 35;

  const isEffectiveLocked = isLocked !== undefined ? Boolean(isLocked) : Boolean(status === 'LOCKED');

  const rawStatus = (submission?.status || 'Pending').trim();
  let displayStatus = 'Pending';
  if (isEffectiveLocked) {
    displayStatus = 'Locked';
  } else if (rawStatus.toUpperCase() === 'AVAILABLE' || rawStatus === '') {
    displayStatus = 'Available';
  } else if (rawStatus.toUpperCase() === 'SUBMITTED' || rawStatus.toLowerCase() === 'submitted') {
    displayStatus = 'Submitted';
  } else if (rawStatus === 'ai_evaluated_pending_review' || rawStatus === 'pending_manual_review') {
    displayStatus = 'Under Review';
  } else if (rawStatus.toLowerCase() === 'evaluating') {
    displayStatus = 'Evaluating';
  } else if (isTrainee) {
    if (isBelow35 || (rawStatus.toUpperCase() === 'REJECTED' && scorePct === null)) {
      displayStatus = 'Need Improvement';
    } else if (
      rawStatus.toLowerCase() === 'approved' ||
      rawStatus.toLowerCase() === 'evaluated' ||
      rawStatus.toUpperCase() === 'NEEDS_IMPROVEMENT'
    ) {
      displayStatus = 'Approved';
    } else if (rawStatus.toUpperCase() === 'LOCKED') {
      displayStatus = 'Available';
    } else {
      displayStatus = 'Available';
    }
  } else {
    if (rawStatus.toLowerCase() === 'approved' || rawStatus.toLowerCase() === 'evaluated') {
      displayStatus = 'Approved';
    } else if (rawStatus.toLowerCase() === 'rejected' || isBelow35 || rawStatus.toUpperCase() === 'NEEDS_IMPROVEMENT') {
      displayStatus = 'Rejected';
    } else {
      displayStatus = 'Pending';
    }
  }

  const isApproved = displayStatus === 'Approved';

  const getBadgeStyle = (st: string) => {
    switch (st) {
      case 'Approved':
        return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
      case 'Need Improvement':
      case 'Needs Improvement':
        return { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' };
      case 'Under Review':
        return { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe' };
      case 'Evaluating':
        return { bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff' };
      case 'Submitted':
        return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
      case 'Rejected':
        return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
      case 'Available':
      case 'Pending':
        return { bg: '#f0f9ff', color: '#0284c7', border: '#bae6fd' };
      case 'Locked':
      default:
        return { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
    }
  };

  const badgeTheme = getBadgeStyle(displayStatus);

  // Determine type icon
  const typeStr = (task.assignmentType || '').toLowerCase();
  const isMcq = typeStr === 'mcq' || typeStr.includes('quiz') || typeStr.includes('assessment');
  const isCoding = typeStr.includes('code') || typeStr.includes('ai') || typeStr.includes('mixed');

  const handleCardClick = () => {
    if (isEffectiveLocked) {
      onClickLocked?.(lockReason);
    } else if (onAttempt) {
      onAttempt(task);
    }
  };

  return (
    <div
      className={`assignment-card-executive ${
        isEffectiveLocked
          ? 'assignment-card-executive--locked'
          : isApproved
          ? 'assignment-card-executive--approved'
          : ''
      }`}
      title={isEffectiveLocked ? lockReason || 'Locked assessment' : `Open ${task.title}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={isEffectiveLocked ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCardClick();
        }
      }}
    >
      {/* ── COLUMN 1: ICON + TITLE + METADATA ── */}
      <div className="assignment-card-left-col">
        {!isTrainee && (
          <div
            className={`assignment-type-icon-box ${
              isEffectiveLocked
                ? 'assignment-type-icon--locked'
                : isApproved
                ? 'assignment-type-icon--approved'
                : isMcq
                ? 'assignment-type-icon--mcq'
                : isCoding
                ? 'assignment-type-icon--ai'
                : 'assignment-type-icon--task'
            }`}
          >
            {isEffectiveLocked ? (
              <Lock size={18} strokeWidth={2.2} />
            ) : isApproved ? (
              <CheckCircle2 size={20} strokeWidth={2.2} />
            ) : isMcq ? (
              <CheckSquare size={19} strokeWidth={2.2} />
            ) : isCoding ? (
              <Sparkles size={19} strokeWidth={2.2} />
            ) : (
              <ClipboardList size={19} strokeWidth={2.2} />
            )}
          </div>
        )}

        <div className="assignment-card-details">
          <h4 className="assignment-card-title" title={task.title}>
            {task.title}
          </h4>

          <div className="assignment-card-tags-row">
            <span className="assignment-tag-pill assignment-tag-pill--type">
              {task.assignmentType || 'Assessment'}
            </span>

            {task.lessonTitle && (
              <span className="assignment-tag-pill">
                {task.lessonTitle}
              </span>
            )}

            <span className="assignment-tag-pill assignment-tag-pill--points">
              Max: {maxScore} pts
            </span>
          </div>

          {isEffectiveLocked && lockReason && (
            <div className="assignment-lock-warning">
              <Lock size={12} />
              <span>{lockReason}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── COLUMN 2: DUE DATE / DEADLINE ── */}
      <div className="assignment-card-due-col">
        <DeadlineDisplay task={task} submission={submission} />
      </div>

      {/* ── COLUMN 3: STATUS PILL & ACTION BUTTON ── */}
      <div
        className="assignment-card-actions-col"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="assignment-status-pill"
          style={{
            background: badgeTheme.bg,
            color: badgeTheme.color,
            border: `1.5px solid ${badgeTheme.border}`,
          }}
        >
          {isApproved ? <CheckCircle2 size={13} /> : null}
          <span>{displayStatus}</span>
          {typeof submission?.score === 'number' ? <strong>({submission.score}/{maxScore} pts)</strong> : null}
        </span>

        {isTrainee && !isEffectiveLocked && (
          isApproved || displayStatus === 'Submitted' || displayStatus === 'Under Review' ? (
            <button
              type="button"
              className="assignment-action-btn assignment-action-btn--review"
              onClick={() => onAttempt?.(task)}
              title="Review submission and evaluation results"
            >
              <FileCheck size={14} />
              <span>Review Details</span>
            </button>
          ) : displayStatus === 'Need Improvement' ? (
            <button
              type="button"
              className="assignment-action-btn assignment-action-btn--retry"
              onClick={() => onAttempt?.(task)}
              title="Resubmit improved assignment"
            >
              <span>Resubmit Task</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="assignment-action-btn assignment-action-btn--primary"
              onClick={() => onAttempt?.(task)}
              title="Start assignment"
            >
              <span>Start Assessment</span>
              <ArrowRight size={14} />
            </button>
          )
        )}

        {isEffectiveLocked && (
          <button
            type="button"
            className="assignment-action-btn assignment-action-btn--locked"
            onClick={() => onClickLocked?.(lockReason)}
            title="Complete prerequisites to unlock"
          >
            <Lock size={13} />
            <span>Locked</span>
          </button>
        )}
      </div>
    </div>
  );
};

export const AssignmentCardSkeleton: React.FC = () => {
  return (
    <div className="assignment-skeleton-row" aria-busy="true">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 11,
            background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <div
            style={{
              width: '40%',
              height: 16,
              borderRadius: 4,
              background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
          <div
            style={{
              width: '25%',
              height: 12,
              borderRadius: 4,
              background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      </div>
      <div
        style={{
          width: 140,
          height: 38,
          borderRadius: 8,
          background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }}
      />
    </div>
  );
};
