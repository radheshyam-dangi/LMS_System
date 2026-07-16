import React, { useState, useMemo, useEffect, useCallback } from 'react';
import "../../App.css";
import { API_BASE_URL } from '../../api';

export type UserStatus = 'Active' | 'Inactive' | 'At Risk';
export type AppRole = 'Admin' | 'Trainer' | 'Trainee';

export interface UserDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: AppRole[];
  primaryRole: AppRole;
  status: UserStatus;
  created_at: string; 
  
  // UPGRADED FIELD: For customized UI display string
  joinedDisplay: string;
  progress: number;
  currentModule: string;
  score: number;
}

function extractRoleName(role: any): AppRole {
  if (!role) return 'Trainee';
  if (typeof role === 'string') return role as AppRole;
  return (role.name ?? 'Trainee') as AppRole;
}

function mapApiUser(u: any): UserDetail {
  const rawRoles = u.roles ?? (u.primaryRole ? [u.primaryRole] : []);
  // 1. Capture the raw timestamp from the Base Entity column
  const rawDate = u.createdAt ?? u.joined_date ?? u.joinedDate;
  
  // 2. Customize the date format (e.g., "Jul 3, 2026")
  const customizedDate = rawDate 
    ? new Date(rawDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) 
    : '—';

  return {
    id: u.id ?? u.user_id,
    firstName: u.firstName ?? u.first_name ?? '',
    lastName: u.lastName ?? u.last_name ?? '',
    email: u.email ?? '',
    roles: rawRoles.map(extractRoleName),
    primaryRole: extractRoleName(u.primaryRole ?? u.primary_role),
    status: u.status ?? 'Active',
    created_at : rawDate ?? '',
    joinedDisplay: customizedDate, 
    progress: Number(u.progress ?? 0),
    currentModule: u.currentModule ?? u.current_module ?? '—',
    score: Number(u.score ?? 0),
  };
}

async function fetchUsers(signal?: AbortSignal): Promise<UserDetail[]> {
  const response = await fetch(`${API_BASE_URL}/users`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load users (status ${response.status})`);
  }

  const data = await response.json();
  return (data.users ?? data).map(mapApiUser);
}

async function createUser(payload: {
  firstName: string;
  lastName: string;
  email: string;
  role: AppRole;
}): Promise<UserDetail> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to add user to Skillforge (status ${response.status})`);
  }
  const data = await response.json();
  return mapApiUser(data.user ?? data);
}

const EMPTY_INVITE_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'Trainee' as AppRole,
};

interface UsersSectionProps {
  onOpenInviteModal: () => void;
}

export function UsersSection({ onOpenInviteModal }: UsersSectionProps) {
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'All' | AppRole>('All');
  
  // MUTUALLY EXCLUSIVE MODAL STATE MANAGER
  const [activeModal, setActiveModal] = useState<'NONE' | 'ADD_USER' | 'VIEW_DETAILS'>('NONE');
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);

  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadUsers = useCallback((signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    fetchUsers(signal)
      .then((rows) => setUsers(rows))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setLoadError(err.message ?? 'Something went wrong loading users.');
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

  const metrics = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.total += 1;
        if (user.primaryRole === 'Trainer') acc.trainers += 1;
        if (user.primaryRole === 'Trainee') acc.trainees += 1;
        if (user.status === 'At Risk') acc.atRisk += 1;
        return acc;
      },
      { total: 0, trainers: 0, trainees: 0, atRisk: 0 }
    );
  }, [users]);

  const avgProgress = useMemo(() => {
    if (users.length === 0) return 0;
    return Math.round(users.reduce((sum, u) => sum + u.progress, 0) / users.length);
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = selectedRoleFilter === 'All' || user.primaryRole === selectedRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, selectedRoleFilter]);

  const handleOpenAddUserModal = () => {
    // setInviteForm(EMPTY_INVITE_FORM);
    // setInviteError(null);
    // setSelectedUser(null); // Clear any open user profiles
    // setActiveModal('ADD_USER');
    onOpenInviteModal(); 
  };

  const handleOpenDetailsModal = (user: UserDetail) => {
    setInviteError(null);
    setSelectedUser(user);
    setActiveModal('VIEW_DETAILS'); // Overwrites ADD_USER entirely
  };

  const handleCloseAnyModal = () => {
    if (isSubmittingInvite) return;
    setActiveModal('NONE');
    setSelectedUser(null);
  };

  const handleInviteFormChange = (
    field: keyof typeof EMPTY_INVITE_FORM,
    value: string
  ) => {
    setInviteForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSendInvite = async () => {
    setIsSubmittingInvite(true);
    setInviteError(null);
    try {
      const newUser = await createUser(inviteForm);
      setUsers((prev) => [newUser, ...prev]);
      setActiveModal('NONE');
    } catch (err: any) {
      setInviteError(err.message ?? 'Could not add user. Please try again.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  return (
    <div className="users-management-wrapper">
      {/* 1. Header Area */}
      <div className="section-header-meta">
        <div className="section-header-row">
          <div>
            <h1 className="main-section-title">User Management</h1>
            <p className="sub-heading-text">{metrics.total} total users • {metrics.atRisk} at risk</p>
          </div>
          <button type="button" className="invite-user-btn" onClick={handleOpenAddUserModal}>
            + Invite New User 
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards Row */}
      <section className="metrics-grid-row">
        <div className="metric-panel-card">
          <div className="card-header-info">
            <h3>{metrics.total}</h3>
            <span className="card-icon">👤</span>
          </div>
          <p className="card-label">Total Users <span className="fade-text">across all roles</span></p>
        </div>

        <div className="metric-panel-card">
          <div className="card-header-info">
            <h3>{metrics.trainers}</h3>
            <span className="card-icon">👥</span>
          </div>
          <p className="card-label">Active Trainers <span className="fade-text">in platform</span></p>
        </div>

        <div className="metric-panel-card">
          <div className="card-header-info">
            <h3>{avgProgress}%</h3>
            <span className="card-icon">📉</span>
          </div>
          <p className="card-label">Avg. Progress <span className="fade-text">across all paths</span></p>
        </div>

        <div className="metric-panel-card risk-highlight">
          <div className="card-header-info">
            <h3 className="risk-text">{metrics.atRisk}</h3>
            <span className="card-icon risk-icon">⚠️</span>
          </div>
          <p className="card-label">At Risk <span className="fade-text">need attention</span></p>
        </div>
      </section>

      {/* 3. Controls Filters Strip */}
      <section className="filter-action-strip">
        <div className="filter-left-group">
          <div className="search-box-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input-field"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-right-group">
          <div className="filter-button-cluster">
            {(['All', 'Trainee', 'Trainer', 'Admin'] as const).map((roleOpt) => (
              <button
                key={roleOpt}
                type="button"
                className={`filter-pill-item ${selectedRoleFilter === roleOpt ? 'active-pill' : ''}`}
                onClick={() => setSelectedRoleFilter(roleOpt)}
              >
                {roleOpt}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. High Fidelity Data Table */}
      <section className="table-viewport-container">
        {isLoading && <div className="table-status-message">Loading users…</div>}

        {!isLoading && loadError && (
          <div className="table-status-message table-status-error">
            {loadError}
            <button type="button" className="retry-load-btn" onClick={() => loadUsers()}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !loadError && filteredUsers.length === 0 && (
          <div className="table-status-message">No users match your search/filters.</div>
        )}

        {!isLoading && !loadError && filteredUsers.length > 0 && (
          <table className="fidelity-data-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>ROLE</th>
                <th>JOINED</th>
                <th className="text-right-aligned">View Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="interactive-data-row">
                  <td className="identity-data-cell">
                    <div className="user-initials-avatar">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div className="name-email-stack">
                      <span className="full-name-string">{user.firstName} {user.lastName}</span>
                      <span className="email-string">{user.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`role-pill-badge role-${user.primaryRole.toLowerCase()}`}>
                      {user.primaryRole}
                    </span>
                  </td>
                  <td><span className="registry-date-label">{user.joinedDisplay}</span></td>
                  <td className="text-right-aligned">
                    <div className="actions-button-wrapper">
                      <button type="button" className="row-ellipsis-menu">•••</button>
                      <button
                        type="button"
                        className="view-details-action-btn"
                        onClick={() => handleOpenDetailsModal(user)}
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 5. USER DETAILS MODAL (ONLY OPEN IF STATE IS VIEW_DETAILS) */}
      {activeModal === 'VIEW_DETAILS' && selectedUser && (
        <div className="modal-backdrop-blur-overlay" onClick={handleCloseAnyModal}>
          <div className="modal-popup-container" onClick={(e) => e.stopPropagation()}>
            <header className="modal-popup-header">
              <h2>User Details Profile</h2>
              <button type="button" className="modal-close-icon-btn" onClick={handleCloseAnyModal}>
                Close ×
              </button>
            </header>

            <div className="modal-profile-hero-section">
              
              <h2 className="modal-user-fullname">{selectedUser.firstName} {selectedUser.lastName}</h2>
              <p className="modal-user-email">{selectedUser.email}</p>
            </div>

            <div className="modal-profile-metadata-grid">
              <div className="grid-meta-box">
                <label>Primary Role - </label>
                <strong>{selectedUser.primaryRole}</strong>
              </div>
              <div className="grid-meta-box">
                <label>Status - </label>
                <strong className={`status-text-${selectedUser.status.toLowerCase()}`}>
                  {selectedUser.status}
                </strong>
              </div>
              <div className="grid-meta-box">
                <label>Joined - </label>
                <strong>{selectedUser.joinedDisplay}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. ADD TO SKILLFORGE MODAL (ONLY OPEN IF STATE IS ADD_USER) */}
      {activeModal === 'ADD_USER' && (
        <div className="modal-backdrop-blur-overlay" onClick={handleCloseAnyModal}>
          <div className="modal-popup-container" onClick={(e) => e.stopPropagation()}>
            <header className="modal-popup-header">
              <h2>Add to Skillforge</h2>
              <button type="button" className="modal-close-icon-btn" onClick={handleCloseAnyModal}>
                Close ×
              </button>
            </header>

            <div className="invite-form-body">
              {inviteError && <div className="invite-form-error">{inviteError}</div>}

              <div className="invite-form-row">
                <div className="invite-form-field">
                  <label>First Name</label>
                  <input
                    type="text"
                    className="invite-form-input"
                    value={inviteForm.firstName}
                    onChange={(e) => handleInviteFormChange('firstName', e.target.value)}
                    placeholder="Jane"
                    disabled={isSubmittingInvite}
                  />
                </div>
                <div className="invite-form-field">
                  <label>Last Name</label>
                  <input
                    type="text"
                    className="invite-form-input"
                    value={inviteForm.lastName}
                    onChange={(e) => handleInviteFormChange('lastName', e.target.value)}
                    placeholder="Doe"
                    disabled={isSubmittingInvite}
                  />
                </div>
              </div>

              <div className="invite-form-field">
                <label>Email</label>
                <input
                  type="email"
                  className="invite-form-input"
                  value={inviteForm.email}
                  onChange={(e) => handleInviteFormChange('email', e.target.value)}
                  placeholder="jane.doe@example.com"
                  disabled={isSubmittingInvite}
                />
              </div>

              <div className="invite-form-field">
                <label>Role</label>
                <select
                  className="invite-form-input"
                  value={inviteForm.role}
                  onChange={(e) => handleInviteFormChange('role', e.target.value)}
                  disabled={isSubmittingInvite}
                >
                  <option value="Trainee">Trainee</option>
                  <option value="Trainer">Trainer</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            <footer className="modal-popup-footer">
              <button type="button" className="modal-cancel-btn" onClick={handleCloseAnyModal} disabled={isSubmittingInvite}>
                Cancel
              </button>
              <button
                type="button"
                className="modal-confirm-btn"
                disabled={!inviteForm.firstName || !inviteForm.lastName || !inviteForm.email || isSubmittingInvite}
                onClick={handleSendInvite}
              >
                {isSubmittingInvite ? 'Adding…' : 'Add User'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}