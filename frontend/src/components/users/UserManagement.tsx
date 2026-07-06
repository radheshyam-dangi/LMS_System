import React, { useState, useMemo } from 'react';
import "../../App.css"

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
  joinedDate: string;
  progress: number;
  currentModule: string;
  score: number;
}

// Initial dummy database exactly mirroring your screenshot layout
const INITIAL_USERS: UserDetail[] = [
}

interface UsersSectionProps {
  onOpenInviteModal: () => void;
}

export function UsersSection({ onOpenInviteModal }: UsersSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'All' | AppRole>('All');
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);

  // Figma stats calculation
  const metrics = useMemo(() => {
    return INITIAL_USERS.reduce(
      (acc, user) => {
        acc.total += 1;
        if (user.primaryRole === 'Trainer') acc.trainers += 1;
        if (user.primaryRole === 'Trainee') acc.trainees += 1;
        if (user.status === 'At Risk') acc.atRisk += 1;
        return acc;
      },
      { total: 0, trainers: 0, trainees: 0, atRisk: 0 }
    );
  }, []);

  const filteredUsers = useMemo(() => {
    return INITIAL_USERS.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = selectedRoleFilter === 'All' || user.primaryRole === selectedRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [searchTerm, selectedRoleFilter]);

  // Dynamic progress bar styling color based on percentage
  const getProgressColor = (progress: number) => {
    if (progress === 100) return '#10b981'; // Teal/Green
    if (progress < 30) return '#f59e0b'; // Amber/Orange
    return '#4f46e5'; // Indigo
  };

  return (
    <div className="users-management-wrapper">
      {/* 1. Header Typography Area */}
      <div className="section-header-meta">
        <h1 className="main-section-title">User Management</h1>
        <p className="sub-heading-text">{metrics.total} total users • {metrics.atRisk} at risk</p>
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
            <h3>44%</h3>
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

      {/* 3. Controls Filters & Action Strip */}
      <section className="filter-action-strip">
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

        <button type="button" className="action-invite-trigger" onClick={onOpenInviteModal}>
          + Invite User
        </button>
      </section>

      {/* 4. High Fidelity Data Table */}
      <section className="table-viewport-container">
        <table className="fidelity-data-table">
          <thead>
            <tr>
              <th>NAME <span>↕</span></th>
              <th>ROLE <span>↕</span></th>
              <th>JOINED <span>↕</span></th>
              
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="interactive-data-row">
                {/* Identity Block */}
                <td className="identity-data-cell">
                  <div className="user-initials-avatar">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <div className="name-email-stack">
                    <span className="full-name-string">{user.firstName} {user.lastName}</span>
                    <span className="email-string">{user.email}</span>
                  </div>
                </td>
                
                {/* Role Pill */}
                <td>
                  <span className={`role-pill-badge role-${user.primaryRole.toLowerCase()}`}>
                    {user.primaryRole}
                  </span>
                </td>

                {/* Course Module */}
                <td>
                  <div className="module-info-stack">
                    <span className="main-module-title">{user.currentModule}</span>
                    {user.primaryRole === 'Trainee' && <span className="module-subtext">Full Stack Eng.</span>}
                  </div>
                </td>

                {/* Joined Date */}
                <td><span className="registry-date-label">{user.joinedDate}</span></td>

                {/* Actions Button */}
                <td className="text-right-aligned">
                  <div className="actions-button-wrapper">
                    <button type="button" className="row-ellipsis-menu">•••</button>
                    <button 
                      type="button" 
                      className="view-details-action-btn"
                      onClick={() => setSelectedUser(user)}
                    >
                      View Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 5. 🌟 USER DETAILS POPUP MODAL WITH BACKGROUND BLUR EFFECT */}
      {selectedUser && (
        <div className="modal-backdrop-blur-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-popup-container" onClick={(e) => e.stopPropagation()}>
            
            <header className="modal-popup-header">
              <h2>User Details Profile</h2>
              <button type="button" className="modal-close-icon-btn" onClick={() => setSelectedUser(null)}>
                Close ×
              </button>
            </header>

            <div className="modal-profile-hero-section">
              <div className="modal-large-avatar">
                {selectedUser.firstName[0]}{selectedUser.lastName[0]}
              </div>
              <h2 className="modal-user-fullname">{selectedUser.firstName} {selectedUser.lastName}</h2>
              <p className="modal-user-email">{selectedUser.email}</p>
            </div>

            {/* Profile Grid Metadata exactly matching the screenshot panel items info */}
            <div className="modal-profile-metadata-grid">
              <div className="grid-meta-box">
                <label>Primary Role</label>
                <strong>{selectedUser.primaryRole}</strong>
              </div>
              <div className="grid-meta-box">
                <label>Status</label>
                <strong className={`status-text-${selectedUser.status.toLowerCase()}`}>
                  {selectedUser.status}
                </strong>
              </div>
              <div className="grid-meta-box">
                <label>Joined</label>
                <strong>{selectedUser.joinedDate}</strong>
              </div>
              
            </div>

          </div>
        </div>
      )}
    </div>
  );
}