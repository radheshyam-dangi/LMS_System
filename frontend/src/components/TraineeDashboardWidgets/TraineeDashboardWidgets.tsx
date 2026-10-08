import React from 'react';
import { Link } from 'react-router-dom';
import './TraineeDashboardWidgets.css';

// ---------------------------------------------------------
// TraineeHeroCard
// ---------------------------------------------------------
export const TraineeHeroCard = ({ isLoading, hasProgress, lastAccessedTitle, pathId }: { isLoading: boolean, hasProgress: boolean, lastAccessedTitle?: string, pathId?: string }) => {
  if (isLoading) {
    return (
      <div className="trainee-hero-card skeleton-pulse" style={{ background: '#e2e8f0', minHeight: '160px' }}>
        <div style={{ width: '40%', height: '24px', background: '#cbd5e1', borderRadius: '4px', marginBottom: '16px' }} />
        <div style={{ width: '60%', height: '16px', background: '#cbd5e1', borderRadius: '4px' }} />
      </div>
    );
  }

  if (!hasProgress || !pathId) {
    return (
      <div className="trainee-hero-card">
        <div className="trainee-hero-content">
          <h2 className="trainee-hero-title">Welcome to SkillForge!</h2>
          <p className="trainee-hero-subtitle">
            You haven't started any modules yet. Get started by exploring your assigned learning paths.
          </p>
          <Link to="/learning-paths" className="trainee-hero-btn">
            Browse Learning Paths
          </Link>
        </div>
        <div className="trainee-hero-image">🚀</div>
      </div>
    );
  }

  return (
    <div className="trainee-hero-card">
      <div className="trainee-hero-content">
        <h2 className="trainee-hero-title">Continue Learning</h2>
        <p className="trainee-hero-subtitle">
          Jump right back in! You left off at <strong>{lastAccessedTitle}</strong>.
        </p>
        <Link to={`/learning-paths`} state={{ pathId }} className="trainee-hero-btn">
          Resume Module
        </Link>
      </div>
      <div className="trainee-hero-image">📚</div>
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
          <div className="db-widget-empty-icon">🎉</div>
          <div className="db-widget-empty-text">You're all caught up — no deadlines coming up!</div>
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
          <div className="db-widget-empty-icon">📝</div>
          <div className="db-widget-empty-text">No recent feedback to display.</div>
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
