import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
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
  progressPercent = 0,
}) => {
  if (isLoading) {
    return (
      <div className="trainee-hero-card skeleton-pulse" style={{ minHeight: '76px' }}>
        <div className="trainee-hero-skeleton-line" style={{ width: '35%', height: '18px' }} />
      </div>
    );
  }

  if (!hasProgress || !pathId) {
    return (
      <div className="trainee-hero-card">
        <div className="trainee-hero-left">
          <div className="trainee-hero-track-row">
            <span className="trainee-hero-badge">Getting Started</span>
            <h2 className="trainee-hero-title">Welcome to SkillForge</h2>
          </div>
          <p className="trainee-hero-subtitle">
            Explore your assigned learning paths to begin your curriculum.
          </p>
        </div>
        <Link to="/learning-paths" className="trainee-hero-btn">
          <span>Browse Learning Paths</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="trainee-hero-card">
      <div className="trainee-hero-left">
        <div className="trainee-hero-track-row">
          <span className="trainee-hero-badge">Current Track</span>
          <h2 className="trainee-hero-title">{lastAccessedTitle}</h2>
        </div>
        <div className="trainee-hero-progress-group">
          <div className="trainee-hero-progress-track">
            <div
              className="trainee-hero-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
          <span className="trainee-hero-progress-text">{progressPercent}% completed</span>
        </div>
      </div>
      <Link
        to={pathId ? `/learning-path/${pathId}/modules` : '/learning-paths'}
        state={{ pathId, pathName: lastAccessedTitle }}
        className="trainee-hero-btn"
      >
        <span>Continue Learning</span>
        <ArrowRight size={14} />
      </Link>
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
                <div className="db-widget-item-title">{a.title}</div>
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
