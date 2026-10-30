import React from 'react';
import { Clock, Lock, AlertCircle, Calendar } from 'lucide-react';

export const DeadlineDisplay = ({ task, submission }: { task: any; submission?: any }) => {
  const deadlineValue =
    submission?.deadline ||
    task?.deadline ||
    task?.dueDate ||
    task?.computedDeadline ||
    submission?.deadlineAt ||
    task?.deadlineAt;

  const rawStatus = String(submission?.status || '').toUpperCase();
  const isApproved = rawStatus === 'APPROVED' || rawStatus === 'EVALUATED' || submission?.isApproved;
  const isPendingReview = rawStatus === 'SUBMITTED' || rawStatus === 'AI_EVALUATED_PENDING_REVIEW' || rawStatus === 'PENDING_MANUAL_REVIEW';

  const isLocked = submission?.status === 'LOCKED' || task?.isLocked;
  const isExpired = Boolean(!isApproved && !isPendingReview && deadlineValue && new Date(deadlineValue).getTime() < Date.now());

  // When deadline has expired, show "Expired" at the place of due date
  if (isExpired) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, minWidth: 0 }}>
        {isLocked && (
          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            <Lock size={14} />
          </span>
        )}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#b91c1c',
            background: '#fef2f2',
            padding: '5px 12px',
            borderRadius: '8px',
            border: '1.5px solid #fca5a5',
            fontWeight: 700,
            fontSize: '12.5px',
            boxShadow: '0 1px 2px rgba(239, 68, 68, 0.05)',
            whiteSpace: 'nowrap',
          }}
        >
          <AlertCircle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
          <span>Expired</span>
        </span>
      </div>
    );
  }

  // Active / Future deadline date
  if (deadlineValue) {
    const deadlineDate = new Date(deadlineValue);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, minWidth: 0 }}>
        {isLocked && (
          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            <Lock size={14} />
          </span>
        )}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            color: '#1e293b',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            padding: '5px 12px',
            borderRadius: '8px',
            fontSize: '12.5px',
            fontWeight: 600,
            letterSpacing: '0.01em',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            whiteSpace: 'nowrap',
          }}
        >
          <Calendar size={14} style={{ color: '#4f46e5', flexShrink: 0 }} />
          <span>Due {deadlineDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        </span>
      </div>
    );
  }

  // Task duration fallback
  if (task?.timerDuration || task?.durationDays || task?.durationHours || task?.durationMinutes) {
    const durationStr = [
      task.durationDays ? `${task.durationDays}d` : '',
      task.durationHours ? `${task.durationHours}h` : '',
      task.durationMinutes ? `${task.durationMinutes}m` : '',
      task.timerDuration ? `${Math.floor(task.timerDuration / 60)}h ${task.timerDuration % 60}m` : '',
    ].filter(Boolean).join(' ');

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          color: '#334155',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          padding: '5px 12px',
          borderRadius: '8px',
          fontSize: '12.5px',
          fontWeight: 600,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          whiteSpace: 'nowrap',
        }}
      >
        <Clock size={14} style={{ color: '#0284c7', flexShrink: 0 }} />
        <span>Duration: {durationStr || 'Flexible'}</span>
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: '#94a3b8',
        background: '#f8fafc',
        border: '1px dashed #cbd5e1',
        padding: '4px 10px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      No deadline
    </span>
  );
};

