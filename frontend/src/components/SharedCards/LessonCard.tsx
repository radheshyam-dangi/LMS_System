import React from 'react';
import { Lock } from 'lucide-react';

export interface LessonContext {
  id: string;
  title: string;
  durationMinutes?: number;
  videoUrl?: string;
  articleUrl?: string;
  videos?: { url: string; title?: string }[];
  audios?: { url: string; title?: string }[];
  description?: string;
  keyPoints?: string[];
}
import DOMPurify from 'dompurify';

interface Props {
  lesson: LessonContext;
  isDone: boolean;
  isLocked?: boolean;
  isTrainee: boolean;
  onMarkWatched?: (id: string) => void;
  onClickLocked?: () => void;
  resources?: any[];
  onVisitResource?: (res: any) => void;
}

export const LessonCard: React.FC<Props> = ({
  lesson,
  isDone,
  isLocked,
  isTrainee,
  onMarkWatched,
  onClickLocked,
  resources,
  onVisitResource
}) => {
  return (
    <div
      onClick={isLocked && onClickLocked ? onClickLocked : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '18px 22px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        opacity: isLocked ? 0.5 : 1,
        cursor: isLocked ? 'not-allowed' : 'default',
        transition: isLocked ? 'none' : 'all 0.15s ease-in-out',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
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
      
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', pointerEvents: isLocked ? 'none' : 'auto', flexWrap: 'wrap', marginTop: '4px' }}>
        {lesson.videoUrl && (
          <a href={lesson.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#4f46e5', background: '#e0e7ff', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            🎬 Video
          </a>
        )}
        {lesson.articleUrl && (
          <a href={lesson.articleUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#4f46e5', background: '#e0e7ff', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            📄 Article
          </a>
        )}
        {/* {lesson.videos?.map((v, i) => (
          <a key={`vid-${i}`} href={v.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#4f46e5', background: '#e0e7ff', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            🎬 {v.title || 'Video'}
          </a>
        ))} */}
        {lesson.audios?.map((a, i) => (
          <a key={`aud-${i}`} href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#9333ea', background: '#f3e8ff', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            🎵 {a.title || 'Audio'}
          </a>
        ))}
        {isDone && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, marginLeft: '4px' }}>✓ Completed</span>}
      </div>
      </div>

      {(lesson.description || (lesson.keyPoints && lesson.keyPoints.length > 0)) && (
        <div style={{ paddingLeft: '36px', marginTop: '8px', pointerEvents: isLocked ? 'none' : 'auto' }}>
          {lesson.description && (
            <div 
              style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, marginBottom: lesson.keyPoints?.length ? '8px' : '0' }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(lesson.description) }}
            />
          )}
          {lesson.keyPoints && lesson.keyPoints.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
              {lesson.keyPoints.map((kp, idx) => (
                <li key={idx} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(kp) }} />
              ))}
            </ul>
          )}
        </div>
      )}

      {resources && resources.length > 0 && (
        <div style={{ paddingLeft: '36px', display: 'flex', gap: '8px', flexWrap: 'wrap', pointerEvents: isLocked ? 'none' : 'auto', marginTop: '-4px' }}>
          {resources.map(res => (
            <a 
              key={res.id} 
              href={res.url} 
              target="_blank" 
              rel="noreferrer"
              onClick={() => onVisitResource && onVisitResource(res)}
              style={{ fontSize: 12, color: '#3b82f6', background: '#eff6ff', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, border: '1px solid #bfdbfe' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
            >
              📎 {res.title || 'Resource'}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
