import React from 'react';
import { Lock } from 'lucide-react';

export interface LessonContext {
  id: string;
  title: string;
  durationMinutes?: number;
  videoUrl?: string;
  articleUrl?: string;
}

interface Props {
  lesson: LessonContext;
  isDone: boolean;
  isLocked?: boolean;
  isTrainee: boolean;
  onMarkWatched?: (id: string) => void;
  onClickLocked?: () => void;
}

export const LessonCard: React.FC<Props> = ({
  lesson,
  isDone,
  isLocked,
  isTrainee,
  onMarkWatched,
  onClickLocked
}) => {
  return (
    <div
      onClick={isLocked && onClickLocked ? onClickLocked : undefined}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 22px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        opacity: isLocked ? 0.5 : 1,
        cursor: isLocked ? 'not-allowed' : 'default',
        transition: isLocked ? 'none' : 'all 0.15s ease-in-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {isLocked ? (
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#f1f5f9', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Lock size={12} />
          </div>
        ) : (
          <div
            onClick={(e) => {
              if (isTrainee && !isLocked && !isDone) {
                e.stopPropagation();
                onMarkWatched?.(lesson.id);
              }
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: isDone ? 'none' : '2px solid #cbd5e1',
              background: isDone ? '#22c55e' : 'transparent',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              cursor: (isTrainee && !isDone) ? 'pointer' : 'default',
              transition: 'all 0.2s'
            }}
          >
            {isDone && '✓'}
          </div>
        )}
        
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: isDone ? '#64748b' : '#0f172a', textDecoration: isDone ? 'line-through' : 'none' }}>
            {lesson.title}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {isDone ? 'Watched' : (isLocked ? 'Locked' : 'Pending')} · {lesson.durationMinutes || 15} min
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', pointerEvents: isLocked ? 'none' : 'auto' }}>
        {lesson.videoUrl && (
          <a href={lesson.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>
            Video
          </a>
        )}
        {lesson.articleUrl && (
          <a href={lesson.articleUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>
            Article
          </a>
        )}
        {isDone && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>Completed</span>}
      </div>
    </div>
  );
};
