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
  
  let displayStatus = status.toLowerCase() === 'approved' ? 'Approved' : status === 'NEEDS_IMPROVEMENT' ? 'Needs Improvement' : status === 'EVALUATING' ? 'Evaluating' : (isLocked ? 'Locked' : status);
  if (isBelowCutoff) {
    displayStatus = 'Needs Improvement';
  }

  return (
    <div
      title={isLocked || status === 'LOCKED' ? lockReason || 'Locked task' : undefined}
      onClick={isLocked && onClickLocked ? () => onClickLocked(lockReason) : undefined}
      style={{
        padding: '16px 20px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        opacity: isLocked || status === 'LOCKED' ? 0.5 : 1,
        cursor: isLocked || status === 'LOCKED' ? 'not-allowed' : 'default',
        transition: isLocked || status === 'LOCKED' ? 'none' : 'all 0.15s ease-in-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isLocked || status === 'LOCKED' ? (
          <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={16} />
          </div>
        ) : null}
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: 15, color: '#0f172a' }}>
            {task.title}
          </h4>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {task.assignmentType} · {task.lessonTitle || 'Module task'}
          </span>
        </div>
      </div>
      
      <DeadlineDisplay task={task} submission={submission} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: isLocked || status === 'LOCKED' ? 'none' : 'auto' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            background:
              displayStatus === 'Needs Improvement' ? '#ffedd5'
              : displayStatus === 'Approved' ? '#dcfce7'
              : status.toLowerCase() === 'rejected' ? '#fee2e2'
              : status.toLowerCase() === 'submitted' ? '#fef3c7'
              : '#f1f5f9',
            color:
              displayStatus === 'Needs Improvement' ? '#c2410c'
              : displayStatus === 'Approved' ? '#166534'
              : status.toLowerCase() === 'rejected' ? '#b91c1c'
              : status.toLowerCase() === 'submitted' ? '#b45309'
              : '#475569',
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
              cursor: 'pointer' 
            }}
          >
            {isTaskSubmitted ? 'Resubmit' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  );
};
