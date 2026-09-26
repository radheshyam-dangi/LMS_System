import React from 'react';
import { Clock, Lock } from 'lucide-react';
import { Countdown } from './SharedCards/Countdown';

export const DeadlineDisplay = ({ task, submission }: { task: any; submission?: any }) => {
  if (!task.timerDuration && !task.durationDays && !task.durationHours && !task.durationMinutes) {
    return <span style={{ fontSize: 12, color: '#64748b' }}>No deadline</span>;
  }

  // WITHOUT DEADLINE
  if (!submission || !submission.deadline) {
    if (task.lockUntilLessonsComplete && submission && !submission.taskUnlockedAt) {
      return (
        <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Lock size={12} /> Unlocks after prerequisite lessons
        </span>
      );
    }
    
    const durationStr = [
      task.durationDays ? `${task.durationDays}d` : '',
      task.durationHours ? `${task.durationHours}h` : '',
      task.durationMinutes ? `${task.durationMinutes}m` : '',
      task.timerDuration ? `${Math.floor(task.timerDuration / 60)}h ${task.timerDuration % 60}m` : ''
    ].filter(Boolean).join(' ');

    return (
      <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Lock size={12} /> Duration: {durationStr}
      </span>
    );
  }

  // UNLOCKED STATE OR LOCKED BUT DEADLINE IS TICKING
  const deadlineDate = new Date(submission.deadline);
  const isLocked = submission.status === 'LOCKED' || task.isLocked;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      {isLocked && (
        <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
          <Lock size={14} />
        </span>
      )}
      <span style={{ color: '#475569' }}>
        Due: {deadlineDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
      </span>
      {submission.status !== 'SUBMITTED' && submission.status !== 'EVALUATED' && submission.status !== 'Approved' ? (
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          background: '#f1f5f9',
          borderRadius: 999,
          border: '1px solid #e2e8f0'
        }}>
          <Clock size={12} />
          <Countdown deadline={submission.deadline} />
        </span>
      ) : (
        <span style={{ color: '#16a34a', fontWeight: 600 }}>Submitted</span>
      )}
    </div>
  );
};

