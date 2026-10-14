import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import './UserProfileDrawer.css';
import type { UserDetail, AppRole, UserStatus } from './UserManagement';
import { API_BASE_URL } from '../../api';
import { userService } from '../../services/userService';
import {
  X,
  Check,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Plus,
  UserPlus,
  Key,
  Trash2,
  Layers,
  GraduationCap,
  Compass,
  Shield,
  BarChart2,
  FileText,
  Users,
  Award,
  BookOpen
} from 'lucide-react';

export interface UserProfileDrawerProps {
  user: UserDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: (updatedUser: UserDetail) => void;
  onUserDeleted?: (userId: string) => void;
  accessToken?: string;
}

export function UserProfileDrawer({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  onUserDeleted,
  accessToken,
}: UserProfileDrawerProps) {
  const [isRendered, setIsRendered] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // User persistent status and role
  const [status, setStatus] = useState<UserStatus>('Active');
  const [primaryRole, setPrimaryRole] = useState<AppRole>('Trainee');

  // Dynamic Selected Role Tab View (restricted to roles this user actually possesses)
  const [selectedRoleTab, setSelectedRoleTab] = useState<AppRole>('Trainee');

  // Extract strictly the roles that exist for this user (NO irrelevant roles)
  const userRoles: AppRole[] = useMemo(() => {
    if (!user) return ['Trainee'];
    const list: AppRole[] = [];

    // Prioritize primary role
    if (user.primaryRole) {
      list.push(user.primaryRole);
    }

    // Include all assigned roles from user.roles
    if (Array.isArray(user.roles)) {
      user.roles.forEach((r: any) => {
        const name = typeof r === 'string' ? r : r?.name;
        if (name && ['Trainee', 'Trainer', 'Admin'].includes(name)) {
          list.push(name as AppRole);
        }
      });
    }

    const unique = Array.from(new Set(list));
    return unique.length > 0 ? unique : (['Trainee'] as AppRole[]);
  }, [user]);

  // Admin action states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Copy tooltips & feedback
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch telemetry stats for specific role
  const fetchProfileStats = useCallback(async (userId: string, targetRole: AppRole) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/profile-stats?role=${encodeURIComponent(targetRole)}`);
      if (!res.ok) throw new Error('Failed to load telemetry stats');
      const data = await res.json();
      setProfileData(data);
    } catch (err) {
      console.error('Failed to load user profile stats', err);
      setFeedbackMsg({ type: 'error', text: 'Unable to load real-time telemetry metrics.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync state when modal opens or user prop changes
  useEffect(() => {
    if (user && isOpen) {
      setIsRendered(true);
      document.body.style.overflow = 'hidden';

      const initialRole = (user.primaryRole && userRoles.includes(user.primaryRole))
        ? user.primaryRole
        : userRoles[0] || 'Trainee';

      setStatus(user.status);
      setPrimaryRole(initialRole);
      setSelectedRoleTab(initialRole);
      setConfirmDelete(false);
      setFeedbackMsg(null);

      // Load initial role stats
      fetchProfileStats(user.id, initialRole);
    } else if (!isOpen) {
      const timer = setTimeout(() => {
        setIsRendered(false);
        setProfileData(null);
        setFeedbackMsg(null);
      }, 220);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
  }, [isOpen, user, userRoles, fetchProfileStats]);

  if (!isRendered || !user) return null;

  const initials = `${user.firstName?.[0] || 'U'}${user.lastName?.[0] || ''}`.toUpperCase();
  const isActive = status === 'Active';

  // Role perspective flags
  const isViewingTrainee = selectedRoleTab === 'Trainee';
  const isViewingTrainer = selectedRoleTab === 'Trainer';
  const isViewingAdmin = selectedRoleTab === 'Admin';
  const isViewingCurrentRole = selectedRoleTab === primaryRole;

  // Tab switch handler
  const handleSelectRoleTab = (role: AppRole) => {
    if (role === selectedRoleTab) return;
    setSelectedRoleTab(role);
    setFeedbackMsg(null);
    fetchProfileStats(user.id, role);
  };

  // Toggle user status: Active <-> Inactive
  const handleToggleStatus = async () => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setFeedbackMsg(null);

    const nextStatus: UserStatus = isActive ? 'Inactive' : 'Active';
    try {
      if (isActive) {
        await userService.deactivateUser(user.id, accessToken);
      } else {
        await userService.reactivateUser(user.id, accessToken);
      }
      setStatus(nextStatus);
      const updated = { ...user, status: nextStatus };
      onUserUpdated?.(updated);
      setFeedbackMsg({
        type: 'success',
        text: `User access updated to ${nextStatus}.`,
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to update user status.',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Assign currently selected tab as the primary role
  const handleAssignPrimaryRole = async () => {
    if (isUpdatingRole || selectedRoleTab === primaryRole) return;
    setIsUpdatingRole(true);
    setFeedbackMsg(null);

    try {
      await userService.updateUserRole(user.id, selectedRoleTab, accessToken);
      setPrimaryRole(selectedRoleTab);
      const updated: UserDetail = {
        ...user,
        primaryRole: selectedRoleTab,
        roles: [selectedRoleTab],
      };
      onUserUpdated?.(updated);
      setFeedbackMsg({
        type: 'success',
        text: `${user.firstName} assigned to ${selectedRoleTab} role.`,
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to reassign user role.',
      });
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Delete user account
  const handleDeleteUser = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    setFeedbackMsg(null);
    try {
      if (accessToken) {
        await userService.deleteUser(user.id, accessToken);
      } else {
        const res = await fetch(`${API_BASE_URL}/users/${user.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete user');
      }
      onUserDeleted?.(user.id);
      onClose();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to delete user. Ensure no active assignments depend on them.',
      });
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Copy email helper
  const handleCopyEmail = () => {
    navigator.clipboard.writeText(user.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Dynamic telemetry calculations
  const stats = profileData?.stats || {};
  const lessonProgress = stats.progress ?? (isViewingTrainee ? user.progress ?? 0 : 0);
  const lpCompleted = stats.lpCompleted ?? 0;
  const assignmentsCompleted = stats.assignmentsCompleted ?? 0;
  const averageScore = stats.score ?? (isViewingTrainee ? user.score ?? 0 : 0);
  const currentModule = stats.currentModule || (isViewingTrainee ? user.currentModule : 'None');

  const joinedDisplay = stats.joinedDate
    ? new Date(stats.joinedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : user.joinedDisplay || '—';

  return (
    <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose} role="presentation">
      <div
        className={`user-profile-drawer ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="User Profile Details"
      >
        {/* 1. HERO PROFILE HEADER */}
        <header className="drawer-header">
          <div className="drawer-header-actions">
            <button
              className="drawer-close-btn"
              onClick={onClose}
              type="button"
              aria-label="Close user profile"
            >
              <X size={16} />
            </button>
          </div>

          <div className="drawer-hero">
            <div className="drawer-avatar-wrap">
              <div className={`drawer-avatar role-${selectedRoleTab.toLowerCase()}`}>
                {initials}
              </div>
            </div>

            <div className="drawer-user-info">
              <h2>{user.firstName} {user.lastName}</h2>
              <div className="user-email-row">
                <span className="user-email-text">{user.email}</span>
                <button
                  type="button"
                  className={`btn-copy-chip ${copiedEmail ? 'copied' : ''}`}
                  onClick={handleCopyEmail}
                  title="Copy email to clipboard"
                >
                  {copiedEmail ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
                <span className="user-joined-dot">•</span>
                <span className="user-joined-meta">Joined {joinedDisplay}</span>
              </div>

              <div className="user-badges">
                {userRoles.map((r) => (
                  <span key={r} className={`role-badge ${r.toLowerCase()}`}>
                    {r} {r === primaryRole && userRoles.length > 1 ? '• Primary' : ''}
                  </span>
                ))}
                <span className={`status-badge ${status.toLowerCase().replace(' ', '-')}`}>
                  <span className={`status-dot-pulse ${status.toLowerCase().replace(' ', '-')}`} />
                  {status}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* 2. ADMIN CONTROLS STRIP (ACCOUNT TOGGLE & ROLE SELECTOR TABS) */}
        <section className="admin-control-strip">
          {/* Account Status Toggle Switch */}
          <div className="control-group">
            <span className="control-label">Account Access</span>
            <div
              className={`admin-toggle-switch ${isUpdatingStatus ? 'disabled' : ''}`}
              onClick={handleToggleStatus}
              role="switch"
              aria-checked={isActive}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleStatus();
                }
              }}
            >
              <div className={`toggle-pill-track ${isActive ? 'is-on' : ''}`}>
                <div className="toggle-pill-knob" />
              </div>
              <span className={`toggle-state-text ${isActive ? 'is-active' : ''}`}>
                {isUpdatingStatus ? 'Updating…' : isActive ? 'Active' : 'Deactivated'}
              </span>
            </div>
          </div>

          {/* Role Tabs: Strictly ONLY roles that exist for this specific user */}
          {userRoles.length > 1 ? (
            <div className="control-group">
              <span className="control-label">Role View</span>
              <div className="role-segmented-control" role="tablist" aria-label="Select role perspective">
                {userRoles.map((roleOption) => {
                  const isSelected = selectedRoleTab === roleOption;
                  const isUserRole = primaryRole === roleOption;
                  return (
                    <button
                      key={roleOption}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      className={`role-segment-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectRoleTab(roleOption)}
                    >
                      {isUserRole && <span className="role-current-indicator" title="Current Assigned Role" />}
                      {roleOption}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="control-group">
              <span className="control-label">User Role</span>
              <div className="single-role-pill">
                {selectedRoleTab}
              </div>
            </div>
          )}
        </section>

        {/* 3. DYNAMIC SCROLLABLE CONTENT BODY (ROLE SPECIFIC ONLY) */}
        <div className="drawer-content">
          {/* Role Perspective Switch Notification & Quick Action */}
          {!isViewingCurrentRole && (
            <div className="role-perspective-banner">
              <span>
                Viewing <strong>{selectedRoleTab}</strong> perspective for {user.firstName} (Current: {primaryRole}).
              </span>
              <button
                type="button"
                className="btn-assign-role-action"
                onClick={handleAssignPrimaryRole}
                disabled={isUpdatingRole}
              >
                {isUpdatingRole ? 'Assigning…' : `Set as ${selectedRoleTab}`}
              </button>
            </div>
          )}

          {/* Feedback message banner */}
          {feedbackMsg && (
            <div className={`drawer-banner-alert ${feedbackMsg.type}`}>
              <span>{feedbackMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}</span>
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {isLoading ? (
            /* Shimmer Skeleton Loading State */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="insight-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div className="skeleton-shimmer" style={{ width: '110px', height: '16px' }} />
                  <div className="skeleton-shimmer" style={{ width: '75px', height: '16px', borderRadius: '999px' }} />
                </div>
                <div className="metrics-grid">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton-metric-box">
                      <div className="skeleton-shimmer" style={{ width: '50px', height: '24px' }} />
                      <div className="skeleton-shimmer" style={{ width: '90px', height: '12px' }} />
                    </div>
                  ))}
                  {isViewingTrainee && (
                    <div className="skeleton-metric-box" style={{ gridColumn: '1 / -1' }}>
                      <div className="skeleton-shimmer" style={{ width: '130px', height: '20px' }} />
                      <div className="skeleton-shimmer" style={{ width: '160px', height: '12px' }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="timeline-section">
                <div className="skeleton-shimmer" style={{ width: '120px', height: '16px', marginBottom: '14px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1, 2].map((i) => (
                    <div key={i} className="skeleton-timeline-row">
                      <div className="skeleton-shimmer" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="skeleton-shimmer" style={{ width: '65%', height: '13px' }} />
                        <div className="skeleton-shimmer" style={{ width: '30%', height: '11px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Telemetry Key Insights Container */}
              <div className="insight-panel">
                <div className="insight-header">
                  <div className="insight-header-left">
                    <h3>
                      {isViewingTrainee
                        ? 'Trainee Progress Telemetry'
                        : isViewingTrainer
                        ? 'Trainer Curriculum Telemetry'
                        : 'Administrative Governance'}
                    </h3>
                  </div>
                  <span className={`insight-status-tag ${status === 'At Risk' ? 'at-risk' : 'on-track'}`}>
                    {status === 'At Risk' ? 'Needs Attention' : 'On Track'}
                  </span>
                </div>

                {/* 1. TRAINEE ONLY VIEW */}
                {isViewingTrainee && (
                  <div className="metrics-grid">
                    <div className="metric-box">
                      <div className="metric-top-row">
                        <span className="metric-value">{lessonProgress}%</span>
                        <span className="metric-icon-badge"><BarChart2 size={15} /></span>
                      </div>
                      <span className="metric-label">Lesson Progress</span>
                      <div className="metric-mini-progress">
                        <div
                          className="metric-mini-progress-fill"
                          style={{ width: `${Math.min(100, Math.max(0, lessonProgress))}%` }}
                        />
                      </div>
                    </div>

                    <div className="metric-box">
                      <div className="metric-top-row">
                        <span className="metric-value">{lpCompleted}</span>
                        <span className="metric-icon-badge"><GraduationCap size={15} /></span>
                      </div>
                      <span className="metric-label">LPs Completed</span>
                    </div>

                    <div className="metric-box">
                      <div className="metric-top-row">
                        <span className="metric-value">{assignmentsCompleted}</span>
                        <span className="metric-icon-badge"><FileText size={15} /></span>
                      </div>
                      <span className="metric-label">Tasks Finished</span>
                    </div>

                    <div className="metric-box">
                      <div className="metric-top-row">
                        <span className="metric-value">{averageScore}%</span>
                        <span className="metric-icon-badge"><Award size={15} /></span>
                      </div>
                      <span className="metric-label">Avg. Score</span>
                    </div>

                    <div className="metric-box full-width module-card">
                      <div className="metric-top-row">
                        <span className="metric-label" style={{ fontWeight: 600, color: '#15803d' }}>
                          Current Module
                        </span>
                        <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: '999px', fontWeight: 700 }}>
                          Active
                        </span>
                      </div>
                      <span className="metric-value">{currentModule}</span>
                    </div>
                  </div>
                )}

                {/* 2. TRAINER ONLY VIEW */}
                {isViewingTrainer && (
                  <div className="metrics-grid">
                    <div className="metric-box">
                      <div className="metric-top-row">
                        <span className="metric-value">{stats.pathsCreated ?? 0}</span>
                        <span className="metric-icon-badge"><Layers size={15} /></span>
                      </div>
                      <span className="metric-label">LPs Created</span>
                    </div>

                    <div className="metric-box">
                      <div className="metric-top-row">
                        <span className="metric-value">{stats.assignmentsCreated ?? 0}</span>
                        <span className="metric-icon-badge"><FileText size={15} /></span>
                      </div>
                      <span className="metric-label">Tasks Created</span>
                    </div>

                    <div className="metric-box">
                      <div className="metric-top-row">
                        <span className="metric-value">{stats.pathsAssigned ?? stats.activeTrainees ?? 0}</span>
                        <span className="metric-icon-badge"><Users size={15} /></span>
                      </div>
                      <span className="metric-label">Assigned Trainees</span>
                    </div>

                    <div className="metric-box">
                      <div className="metric-top-row">
                        <span className="metric-value">{stats.avgTraineeScore ?? 0}%</span>
                        <span className="metric-icon-badge"><BarChart2 size={15} /></span>
                      </div>
                      <span className="metric-label">Cohort Avg. Score</span>
                    </div>
                  </div>
                )}

                {/* 3. ADMIN ONLY VIEW */}
                {isViewingAdmin && (
                  <div className="metric-box full-width admin-summary-card">
                    <div className="metric-top-row">
                      <span className="metric-label" style={{ fontWeight: 700, color: '#92400e' }}>
                        Administrative Privileges
                      </span>
                      <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                        Full Access
                      </span>
                    </div>
                    <span className="metric-value" style={{ marginTop: '4px' }}>
                      {stats.usersManaged ?? 'Directory Active'} Members Managed
                    </span>
                    <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#78350f', lineHeight: 1.4 }}>
                      Full administrative authority over user lifecycle, role assignments, system-wide notifications, and curriculum publishing.
                    </p>
                  </div>
                )}
              </div>

              {/* Recent Activity Timeline (Filtered by Selected Role) */}
              <div className="timeline-section">
                <div className="timeline-section-header">
                  <h3>
                    Recent {isViewingTrainee ? 'Learning' : isViewingTrainer ? 'Instruction' : 'Platform'} Activity
                  </h3>
                </div>

                <div className="timeline">
                  {profileData?.activities && profileData.activities.length > 0 ? (
                    profileData.activities.map((activity: any, idx: number) => {
                      const dateStr = new Date(activity.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const iconType = activity.type || 'complete';
                      const renderActivityIcon = () => {
                        switch (iconType) {
                          case 'complete': return <CheckCircle2 size={13} strokeWidth={2} />;
                          case 'submit': return <Upload size={13} strokeWidth={2} />;
                          case 'create': return <Plus size={13} strokeWidth={2} />;
                          case 'join': return <UserPlus size={13} strokeWidth={2} />;
                          default: return <Key size={13} strokeWidth={2} />;
                        }
                      };

                      return (
                        <div className="timeline-item" key={idx}>
                          <div className={`timeline-icon-pill ${iconType}`}>{renderActivityIcon()}</div>
                          <div className="timeline-content">
                            <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activity.description) }} />
                            <span className="time">{dateStr}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="timeline-item">
                      <div className="timeline-icon-pill join"><UserPlus size={13} strokeWidth={2} /></div>
                      <div className="timeline-content">
                        <p>Joined SkillForge platform</p>
                        <span className="time">{joinedDisplay}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 4. MODAL FOOTER */}
        <footer className="drawer-footer">
          <div className="footer-left-actions">
            <button
              type="button"
              className={`btn-danger-outline ${confirmDelete ? 'confirm-mode' : ''}`}
              onClick={handleDeleteUser}
              disabled={isDeleting}
            >
              {isDeleting
                ? 'Deleting user…'
                : confirmDelete
                ? 'Confirm Delete?'
                : <><Trash2 size={13} style={{ marginRight: '4px' }} /> Delete User</>}
            </button>
            {confirmDelete && !isDeleting && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            )}
          </div>

          <div className="footer-right-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
