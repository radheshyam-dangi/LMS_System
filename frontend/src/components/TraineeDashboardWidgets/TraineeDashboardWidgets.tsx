import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, FileText } from 'lucide-react';
import './TraineeDashboardWidgets.css';

// ---------------------------------------------------------
// TraineeHeroCard
// ---------------------------------------------------------
export interface TraineeHeroCardProps {
  isLoading: boolean;
  hasProgress: boolean;
  lastAccessedTitle?: string;
  pathId?: string;
  progressPercent?: number;
}

export const TraineeHeroCard: React.FC<TraineeHeroCardProps> = ({
  isLoading,
  hasProgress,
  lastAccessedTitle,
  pathId,
  progressPercent,
}) => {
  if (isLoading) {
    return (
      <div className="trainee-hero-card skeleton-pulse">
        <div className="trainee-hero-skeleton-line" style={{ width: '35%', height: '22px', marginBottom: '14px' }} />
        <div className="trainee-hero-skeleton-line" style={{ width: '60%', height: '16px', marginBottom: '22px' }} />
        <div className="trainee-hero-skeleton-line" style={{ width: '150px', height: '42px', borderRadius: '10px' }} />
      </div>
    );
  }

  if (!hasProgress || !pathId) {
    return (
      <div className="trainee-hero-card welcome-mode">
        <div className="trainee-hero-content">
          <div className="trainee-hero-badge">
            <span>Getting Started</span>
          </div>
          <h2 className="trainee-hero-title">Welcome to SkillForge</h2>
          <p className="trainee-hero-subtitle">
            You haven't started any modules yet. Explore your assigned learning paths to begin your curriculum.
          </p>
          <Link to="/learning-paths" className="trainee-hero-btn">
            <span>Browse Learning Paths</span>
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="trainee-hero-graphic">
          <div className="hero-icon-orb">
            <BookOpen size={32} strokeWidth={1.75} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="trainee-hero-card">
      <div className="trainee-hero-content">
        <div className="trainee-hero-badge">
          <span>{typeof progressPercent === 'number' && progressPercent > 0 ? `${progressPercent}% Complete` : 'In Progress'}</span>
        </div>
        <h2 className="trainee-hero-title">Continue Learning</h2>
        <p className="trainee-hero-subtitle">
          Jump right back in. You left off at <strong>{lastAccessedTitle}</strong>.
        </p>
        <Link to="/learning-paths" state={{ pathId }} className="trainee-hero-btn">
          <span>Resume Module</span>
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="trainee-hero-graphic">
        <div className="hero-icon-orb">
          <BookOpen size={32} strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
};



// ---------------------------------------------------------
// UpcomingDeadlinesWidget
// ---------------------------------------------------------
export const UpcomingDeadlinesWidget = ({ isLoading, assignments }: { isLoading: boolean, assignments: any[] }) => {
  return (
    <div className="db-widget">
      <div className="db-widget-header">
        <h3 className="db-widget-title">Upcoming Deadlines</h3>
      </div>
      
      {isLoading ? (
        <div className="db-widget-list skeleton-pulse">
          <div style={{ height: '60px', background: '#f1f5f9', borderRadius: '8px' }} />
          <div style={{ height: '60px', background: '#f1f5f9', borderRadius: '8px' }} />
        </div>
      ) : assignments.length === 0 ? (
        <div className="db-widget-empty">
          <div className="db-widget-empty-icon">
            <CheckCircle2 size={24} color="#10b981" strokeWidth={1.75} />
          </div>
          <div className="db-widget-empty-text">All caught up — no upcoming deadlines.</div>
        </div>
      ) : (
        <div className="db-widget-list">
          {assignments.slice(0, 3).map((a, i) => (
            <div key={i} className="db-widget-item">
              <div className="db-widget-item-content">
                <div className="db-widget-item-title" title={a.title}>{a.title}</div>
                <div className="db-widget-item-meta" style={{ display: 'flex', gap: '8px' }}>
                  <span>Due: {new Date(a.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              </div>
              <div className="db-widget-item-action">
                <span style={{ fontSize: '12px', background: '#fef3c7', color: '#d97706', padding: '4px 8px', borderRadius: '12px', fontWeight: 600 }}>Pending</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// RecentFeedbackWidget
// ---------------------------------------------------------
export const RecentFeedbackWidget = ({ isLoading, feedback }: { isLoading: boolean, feedback: any[] }) => {
  return (
    <div className="db-widget">
      <div className="db-widget-header">
        <h3 className="db-widget-title">Recent Feedback</h3>
      </div>
      
      {isLoading ? (
        <div className="db-widget-list skeleton-pulse">
          <div style={{ height: '60px', background: '#f1f5f9', borderRadius: '8px' }} />
          <div style={{ height: '60px', background: '#f1f5f9', borderRadius: '8px' }} />
        </div>
      ) : feedback.length === 0 ? (
        <div className="db-widget-empty">
          <div className="db-widget-empty-icon">
            <FileText size={24} color="#94a3b8" strokeWidth={1.75} />
          </div>
          <div className="db-widget-empty-text">No recent evaluation feedback recorded.</div>
        </div>
      ) : (
        <div className="db-widget-list">
          {feedback.slice(0, 3).map((f, i) => (
            <div key={i} className="db-widget-item">
              <div className="db-widget-item-content">
                <div className="db-widget-item-title" title={f.assignmentTitle}>{f.assignmentTitle}</div>
                <div className="db-widget-item-meta" title={`Evaluator: ${f.evaluatorName || 'Trainer'}`}>
                  {f.score !== undefined ? `${Math.round(f.score)}%` : 'Graded'} • {f.evaluatorName ? (f.evaluatorName.length > 20 ? f.evaluatorName.slice(0, 18) + '...' : f.evaluatorName) : 'Trainer'}
                </div>
              </div>
              <div className="db-widget-item-action">
                {f.passed ? (
                  <span style={{ fontSize: '12px', background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: '12px', fontWeight: 600 }}>Passed</span>
                ) : (
                  <span style={{ fontSize: '12px', background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '12px', fontWeight: 600 }}>Needs Revision</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
