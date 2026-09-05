import React, { useEffect, useState } from 'react';
import { Clock, Lock } from 'lucide-react';

export const DeadlineDisplay = ({ task, submission }: { task: any; submission?: any }) => {
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [urgency, setUrgency] = useState<'neutral' | 'amber' | 'red'>('neutral');
  
  useEffect(() => {
    if (!submission?.deadline || submission.status === 'LOCKED' || submission.status === 'SUBMITTED' || submission.status === 'EVALUATED') {
       if (submission?.deadline && (submission.status === 'SUBMITTED' || submission.status === 'EVALUATED')) {
           setTimeLeftStr('Submitted');
           setUrgency('neutral');
       }
       return;
    }

    const updateTimer = () => {
      const now = new Date();
      const deadline = new Date(submission.deadline);
      const diffMs = deadline.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setTimeLeftStr('Overdue');
        setUrgency('red');
        return;
      }
      
      const hours = diffMs / 3600000;
      if (hours < 6) setUrgency('red');
      else if (hours < 48) setUrgency('amber');
      else setUrgency('neutral');

      const d = Math.floor(hours / 24);
      const h = Math.floor(hours % 24);
      const m = Math.floor((diffMs % 3600000) / 60000);
      
      let str = '';
      if (d > 0) str += `${d}d `;
      if (h > 0) str += `${h}h `;
      str += `${m}m left`;
      setTimeLeftStr(str);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // update every minute
    
    return () => clearInterval(interval);
  }, [submission]);

  if (!task.durationDays && !task.durationHours && !task.durationMinutes) {
    return <span style={{ fontSize: 12, color: '#64748b' }}>No deadline</span>;
  }

  // LOCKED OR AVAILABLE (NOT STARTED) STATE
  if (!submission || submission.status === 'LOCKED' || (submission.status === 'AVAILABLE' && !submission.deadline)) {
    if ((submission && submission.taskUnlockedAt === null && task.anchorType === 'TASK_UNLOCKED') || (!submission && task.anchorType === 'TASK_UNLOCKED')) {
      return null;
    }
    
    // Mode A locked or Mode B available but not started
    const durationStr = [
      task.durationDays ? `${task.durationDays}d` : '',
      task.durationHours ? `${task.durationHours}h` : '',
      task.durationMinutes ? `${task.durationMinutes}m` : ''
    ].filter(Boolean).join(' ');

    return (
      <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Lock size={12} /> {submission?.deadline ? `Due ${new Date(submission.deadline).toLocaleDateString()}` : `Duration: ${durationStr}`}
      </span>
    );
  }

  // UNLOCKED STATE
  const deadlineDate = new Date(submission.deadline);
  const colorMap = {
    neutral: { text: '#334155', bg: '#e2e8f0' },
    amber: { text: '#b45309', bg: '#fef3c7' },
    red: { text: '#b91c1c', bg: '#fee2e2' }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: '#475569' }}>
        Due: {deadlineDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </span>
      {timeLeftStr && (
        <span style={{
          background: colorMap[urgency].bg,
          color: colorMap[urgency].text,
          padding: '2px 8px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontWeight: 600
        }}>
          {timeLeftStr !== 'Submitted' && <Clock size={12} />} {timeLeftStr}
        </span>
      )}
    </div>
  );
};
