import React from 'react';
import { Lock } from 'lucide-react';
import { DeadlineDisplay } from '../DeadlineDisplay';

export interface AssignmentContext {
  id: string;
  title: string;
  assignmentType?: string;
  lessonTitle?: string;
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
  onAttempt
}) => {
  const status = submission?.status || 'Pending';
  const isTaskSubmitted = submission && status !== 'AVAILABLE' && status !== 'LOCKED';
  const isExpired = submission?.deadline && new Date(submission.deadline).getTime() < Date.now();
  
  const maxScore = (task as any).maxScore || 100;
  const isBelowCutoff = status.toUpperCase() === 'APPROVED' && typeof submission?.score === 'number' && (submission.score / maxScore) * 100 < 35;
  
  const rawStatus = (submission?.status || 'Pending').trim();
  let displayStatus = 'Pending';
  if (isLocked || rawStatus.toUpperCase() === 'LOCKED') {
    displayStatus = 'Locked';
  } else if (rawStatus.toLowerCase() === 'approved') {
    displayStatus = 'Approved';
  } else if (rawStatus.toUpperCase() === 'NEEDS_IMPROVEMENT' || rawStatus.toLowerCase() === 'needs_improvement') {
    displayStatus = 'Needs Improvement';
  } else if (rawStatus.toLowerCase() === 'evaluating') {
    displayStatus = 'Evaluating';
  } else if (rawStatus === 'ai_evaluated_pending_review' || rawStatus === 'pending_manual_review') {
    displayStatus = 'Under Review';
  } else if (rawStatus.toUpperCase() === 'AVAILABLE') {
    displayStatus = 'Available';
  } else if (rawStatus.toUpperCase() === 'SUBMITTED' || rawStatus.toLowerCase() === 'submitted') {
    displayStatus = 'Submitted';
  } else if (rawStatus.toUpperCase() === 'REJECTED' || rawStatus.toLowerCase() === 'rejected') {
    displayStatus = 'Rejected';
  } else {
    displayStatus = rawStatus.replace(/_/g, ' ');
    displayStatus = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);
  }

  if (isBelowCutoff) {
    displayStatus = 'Needs Improvement';
  }

  const getBadgeStyle = (st: string) => {
    switch (st) {
      case 'Approved':
        return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
      case 'Needs Improvement':
        return { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' };
      case 'Under Review':
        return { bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' };
      case 'Evaluating':
        return { bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' };
      case 'Submitted':
        return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'Rejected':
        return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' };
      case 'Available':
        return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
      case 'Locked':
        return { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' };
      default:
        return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
  };

  const badgeTheme = getBadgeStyle(displayStatus);

  return (
    <div
      className="assignment-card-grid"
      title={isLocked || status === 'LOCKED' ? lockReason || 'Locked task' : undefined}
      onClick={isLocked && onClickLocked ? () => onClickLocked(lockReason) : undefined}
      style={{
        padding: '16px 20px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        opacity: isLocked || status === 'LOCKED' ? 0.6 : 1,
        cursor: isLocked || status === 'LOCKED' ? 'not-allowed' : 'default',
        transition: isLocked || status === 'LOCKED' ? 'none' : 'all 0.15s ease-in-out',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      {/* ── COLUMN 1: TITLE & METADATA ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {isLocked || status === 'LOCKED' ? (
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lock size={15} />
          </div>
        ) : null}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h4
            style={{
              margin: '0 0 4px',
              fontSize: 15,
              fontWeight: 600,
              color: '#0f172a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={task.title}
          >
            {task.title}
          </h4>
          <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>
            {task.assignmentType} · {task.lessonTitle || 'Module task'}
          </span>
        </div>
      </div>
      
      {/* ── COLUMN 2: DUE DATE / DEADLINE (FIXED COLUMN WIDTH) ── */}
      <div className="assignment-card-due-col">
        <DeadlineDisplay task={task} submission={submission} />
      </div>
      
      {/* ── COLUMN 3: STATUS & ACTION BUTTON ── */}
      <div
        className="assignment-card-actions-col"
        style={{ pointerEvents: isLocked || status === 'LOCKED' ? 'none' : 'auto' }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            background: badgeTheme.bg,
            color: badgeTheme.color,
            border: `1px solid ${badgeTheme.border}`,
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}
        >
          {displayStatus}
          {typeof submission?.score === 'number' ? ` · ${submission.score}` : ''}
        </span>
        {isTrainee && displayStatus !== 'Approved' && !isLocked && status !== 'LOCKED' && !isExpired && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAttempt?.(task);
            }}
            style={{ 
              padding: '6px 14px', 
              background: '#4f46e5', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 6, 
              fontSize: 13, 
              fontWeight: 600, 
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
              boxShadow: '0 1px 2px rgba(79,70,229,0.2)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#4338ca'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#4f46e5'}
          >
            {isTaskSubmitted ? 'Resubmit' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  );
};
