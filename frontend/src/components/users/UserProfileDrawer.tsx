import React, { useEffect, useState } from 'react';
import './UserProfileDrawer.css';
import type { UserDetail } from './UserManagement';
import { API_BASE_URL } from '../../api';

// ManageUser actions
async function deactivateUser(id: string) {
  return fetch(`${API_BASE_URL}/users/${id}/deactivate`, { method: 'PUT' });
}
async function reactivateUser(id: string) {
  return fetch(`${API_BASE_URL}/users/${id}/reactivate`, { method: 'PUT' });
}
async function deleteUser(id: string) {
  return fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' });
}


interface UserProfileDrawerProps {
  user: UserDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileDrawer({ user, isOpen, onClose }: UserProfileDrawerProps) {
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
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
              {user.primaryRole !== 'Admin' && (
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
                          <span className="metric-label">Lesson Progress</span>
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
              )}

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

        <div className="drawer-footer" style={{ position: 'relative' }}>
          {errorMsg && <div style={{ position: 'absolute', top: '-40px', left: 0, right: 0, color: 'red', textAlign: 'center', background: '#fee2e2', padding: '4px', borderRadius: '4px' }}>{errorMsg}</div>}
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <div style={{ position: 'relative' }}>
            <button className="btn-primary" onClick={() => setShowManageMenu(!showManageMenu)}>
              Manage User
            </button>
            {showManageMenu && (
              <div style={{
                position: 'absolute', bottom: '110%', right: '0',
                background: 'white', border: '1px solid #e2e8f0',
                borderRadius: '8px', padding: '8px', display: 'flex',
                flexDirection: 'column', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                minWidth: '150px', zIndex: 10
              }}>
                {user.status === 'Active' ? (
                  <button onClick={async () => {
                    await deactivateUser(user.id);
                    onClose(); // and ideally trigger list refresh
                  }} style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    Deactivate User
                  </button>
                ) : (
                  <button onClick={async () => {
                    await reactivateUser(user.id);
                    onClose();
                  }} style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    Reactivate User
                  </button>
                )}
                <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                {!isDeleting ? (
                  <button onClick={() => setIsDeleting(true)} style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'red', borderRadius: '4px' }} onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    Delete User
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'red' }}>Are you sure?</span>
                    <button onClick={async () => {
                      const res = await deleteUser(user.id);
                      if (!res.ok) {
                        const err = await res.json();
                        setErrorMsg(err.message || 'Failed to delete');
                        setIsDeleting(false);
                      } else {
                        onClose();
                      }
                    }} style={{ padding: '4px', background: 'red', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Confirm Delete</button>
                    <button onClick={() => setIsDeleting(false)} style={{ padding: '4px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
