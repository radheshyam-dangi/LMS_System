import React from 'react';
import { Clock, Lock, AlertCircle, Calendar } from 'lucide-react';

export const DeadlineDisplay = ({ task, submission }: { task: any; submission?: any }) => {
  if (!task.timerDuration && !task.durationDays && !task.durationHours && !task.durationMinutes) {
    return <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>No deadline</span>;
  }

  // WITHOUT DEADLINE
  if (!submission || !submission.deadline) {
    if (task.lockUntilLessonsComplete && submission && !submission.taskUnlockedAt) {
      return (
        <span style={{ fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <Lock size={14} /> Unlocks after prerequisite lessons
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
      <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
        <Clock size={14} /> Duration: {durationStr}
      </span>
    );
  }

  // UNLOCKED STATE OR LOCKED BUT DEADLINE IS TICKING
  const deadlineDate = new Date(submission.deadline);
  const isLocked = submission.status === 'LOCKED' || task.isLocked;
  
  // Calculate overdue status
  const isPending = !['SUBMITTED', 'EVALUATED', 'Approved', 'needs_improvement'].includes(submission.status);
  const isOverdue = isPending && (new Date() > deadlineDate);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
      {isLocked && (
        <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
          <Lock size={14} />
        </span>
      )}
      <span style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        color: isOverdue ? '#ef4444' : '#64748b',
        background: isOverdue ? '#fef2f2' : 'transparent',
        padding: isOverdue ? '4px 10px' : '0',
        borderRadius: '6px',
        border: isOverdue ? '1px solid #fca5a5' : 'none'
      }}>
        {isOverdue ? <AlertCircle size={14} /> : <Calendar size={14} />}
        Due {deadlineDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </span>
    </div>
  );
};

