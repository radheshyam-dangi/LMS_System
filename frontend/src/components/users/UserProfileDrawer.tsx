import React, { useEffect, useState } from 'react';
import './UserProfileDrawer.css';
import type { UserDetail } from './UserManagement';
import { API_BASE_URL } from '../../api';

interface UserProfileDrawerProps {
  user: UserDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileDrawer({ user, isOpen, onClose }: UserProfileDrawerProps) {
  const [isRendered, setIsRendered] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setIsRendered(true);
      document.body.style.overflow = 'hidden';
      
      // Fetch dynamic stats
      setIsLoading(true);
      fetch(`${API_BASE_URL}/users/${user.id}/profile-stats`)
        .then(res => res.json())
        .then(data => {
          setProfileData(data);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Failed to load user profile stats', err);
          setIsLoading(false);
        });
    } else {
      const timer = setTimeout(() => {
        setIsRendered(false);
        setProfileData(null);
      }, 300);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
  }, [isOpen, user]);

  if (!isRendered || !user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const isTrainee = user.primaryRole === 'Trainee';
  const isTrainer = user.primaryRole === 'Trainer';

  const getStatusColor = (status: string) => {
    if (status === 'Active') return '#10b981';
    if (status === 'Inactive') return '#64748b';
    return '#ef4444';
  };

  const statusColor = getStatusColor(user.status);

  return (
    <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className={`user-profile-drawer ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-header">
          <div className="drawer-header-actions">
            <button className="drawer-close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="drawer-hero">
            <div className="drawer-avatar">
              {initials}
            </div>
            <div className="drawer-user-info">
              <h2>{user.firstName} {user.lastName}</h2>
              <p className="user-email">{user.email}</p>
              <div className="user-badges">
                <span className={`role-badge ${user.primaryRole.toLowerCase()}`}>{user.primaryRole}</span>
                <span className="status-badge" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                  <span className="status-dot" style={{ backgroundColor: statusColor }}></span>
                  {user.status}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="drawer-content">
          {isLoading ? (
             <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                Loading real-time user insights...
             </div>
          ) : profileData ? (
            <>
              <div className="insight-panel">
                <div className="insight-header">
                  <h3>Key Insights</h3>
                  <span className="insight-status" style={{ color: user.status === 'At Risk' ? '#ef4444' : '#10b981' }}>
                    {user.status === 'At Risk' ? 'Needs Attention' : 'On Track'}
                  </span>
                </div>
                <div className="metrics-grid">
                  {isTrainee ? (
                    <>
                      <div className="metric-box">
                        <span className="metric-value">{profileData.stats?.progress ?? 0}%</span>
                        <span className="metric-label">Overall Progress</span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-value">{profileData.stats?.lpCompleted ?? 0}</span>
                        <span className="metric-label">LPs Completed</span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-value">{profileData.stats?.assignmentsCompleted ?? 0}</span>
                        <span className="metric-label">Tasks Finished</span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-value">{profileData.stats?.score ?? 0}</span>
                        <span className="metric-label">Avg. Score</span>
                      </div>
                      <div className="metric-box full-width">
                        <span className="metric-value small">{profileData.stats?.currentModule || 'None'}</span>
                        <span className="metric-label">Current Module</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="metric-box">
                        <span className="metric-value">{profileData.stats?.pathsCreated ?? 0}</span>
                        <span className="metric-label">LPs Created</span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-value">{profileData.stats?.assignmentsCreated ?? 0}</span>
                        <span className="metric-label">Tasks Created</span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-value">{profileData.stats?.pathsAssigned ?? 0}</span>
                        <span className="metric-label">LPs Assigned to Trainees</span>
                      </div>
                      {isTrainer && (
                        <div className="metric-box">
                          <span className="metric-value">{profileData.stats?.avgTraineeScore ?? 0}%</span>
                          <span className="metric-label">Avg Trainee Score</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="metric-box full-width joined-date-box">
                    <span className="metric-value small">
                      {profileData.stats?.joinedDate 
                        ? new Date(profileData.stats.joinedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : user.joinedDisplay}
                    </span>
                    <span className="metric-label">Officially Joined</span>
                  </div>
                </div>
              </div>

              <div className="timeline-section">
                <h3>Recent Activity</h3>
                <div className="timeline">
                  {profileData.activities?.map((activity: any, idx: number) => {
                    const dateStr = new Date(activity.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    return (
                      <div className="timeline-item" key={idx}>
                        <div className={`timeline-icon ${activity.type}`}>
                           {activity.type === 'complete' ? '✅' : activity.type === 'submit' ? '📤' : activity.type === 'create' ? '✨' : activity.type === 'join' ? '🎉' : '🚪'}
                        </div>
                        <div className="timeline-content">
                          <p dangerouslySetInnerHTML={{ __html: activity.description }}></p>
                          <span className="time">{dateStr}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="timeline-item">
                    <div className="timeline-icon join">🎉</div>
                    <div className="timeline-content">
                      <p>Joined SkillForge platform</p>
                      <span className="time">{user.joinedDisplay}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
             <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
                Failed to load insights.
             </div>
          )}
        </div>
        
        <div className="drawer-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary">Manage User</button>
        </div>
      </div>
    </div>
  );
}
