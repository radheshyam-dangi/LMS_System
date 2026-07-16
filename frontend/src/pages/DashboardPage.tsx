import { useMemo, useState, type SetStateAction } from 'react';
import { InviteUserModal } from '../components/users/InviteUserModal';
import { UsersSection } from '../components/users/UserManagement';
import { LearningPathsSection } from '../components/LearningPathsSection/LearningPathsSection'; // Ensure path is matching your file structural route
import type { RoleName, SessionUser } from '../types/auth';

type DashboardPageProps = {
  accessToken: string;
  activeRole: RoleName;
  activeSection: string;
  currentUser: SessionUser;
};

type VisibleUser = {
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  primaryRole: RoleName;
  status: 'invited' | 'activated';
};

const metricsByRole: Record<RoleName, { label: string; value: string; delta: string; icon: string }[]> = {
  Admin: [
    { label: 'Total Trainees', value: '24', delta: '+3 this month', icon: '👥' },
    { label: 'Active Assignments', value: '18', delta: '6 due this week', icon: '📋' },
    { label: 'Pending Reviews', value: '7', delta: '3 high priority', icon: '🕒' },
    { label: 'Completion Rate', value: '82%', delta: '+4% vs last month', icon: '📈' },
  ],
  Trainer: [
    { label: 'Learners Assigned', value: '16', delta: '4 need feedback', icon: '👥' },
    { label: 'Reviews Completed', value: '31', delta: '+9 this week', icon: '📋' },
    { label: 'Live Modules', value: '12', delta: '2 updated today', icon: '🕒' },
    { label: 'Average Score', value: '88', delta: '+6 pts', icon: '📈' },
  ],
  Trainee: [
    { label: 'Modules Open', value: '6', delta: '2 due soon', icon: '🕒' },
    { label: 'Assignments Done', value: '14', delta: '+5 this month', icon: '📋' },
    { label: 'Review Score', value: '84', delta: '+3 pts', icon: '📈' },
    { label: 'Learning Streak', value: '9d', delta: 'Keep going', icon: '🔥' },
  ],
};

export function DashboardPage({
  accessToken,
  activeRole,
  activeSection,
  currentUser,
}: DashboardPageProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  
  const [users, setUsers] = useState<VisibleUser[]>([
    {
      email: currentUser.email,
      firstName: currentUser.firstName ?? 'Admin',
      lastName: currentUser.lastName ?? 'User',
      roles: currentUser.roles,
      primaryRole: currentUser.primaryRole,
      status: 'activated',
    },
  ]);

  const isAdmin = useMemo(() => activeRole.toLowerCase() === 'admin', [activeRole]);

  const addInvitedUser = (user: Omit<VisibleUser, 'status'>) => {
    setUsers((current) => [{ ...user, status: 'invited' }, ...current]);
  };

  // ========================================================
  // ROUTING ENGINE VIEW CONDITIONALS 
  // ========================================================

  // VIEW 1: USER MANAGEMENT SECTION
  if (isAdmin && activeSection === 'Users') {
    return (
      <div className="dashboard-content">
        <UsersSection onOpenInviteModal={() => setShowInviteModal(true)} />
        
        {showInviteModal && (
          <InviteUserModal
            accessToken={accessToken}
            currentUser={currentUser}
            onClose={() => setShowInviteModal(false)}
            onInvited={addInvitedUser}
          />
        )}
      </div>
    );
  }

  // VIEW 2: LEARNING PATHS CARD GRID SYSTEM (Admin, Trainer & Trainee Contexts)
  if (activeSection === 'Learning Paths') {
    return (
      <div className="dashboard-content">
        <LearningPathsSection 
          currentUser={{
            id: currentUser.id ?? 'trainee-99',
            name: currentUser.firstName ?? 'User',
            role: activeRole as any // Maps perfectly into Admin | Trainer | Trainee inside LearningPathsSection
          }}
          onNavigateToModules={(pathId: SetStateAction<string | null>, pathName: any) => {
            console.log(`Loading modules view tracking parameter path map: ${pathName} ID: ${pathId}`);
            setSelectedPathId(pathId);
          }}
        />
      </div>
    );
  }

  // VIEW 3: FALLBACK COMPONENT DEFAULT INSIGHT GRAPHS & METRIC CARDS
  return (
    <div className="dashboard-content">
      <section className="workspace-heading">
        <div>
          <h1>Good morning, {currentUser.firstName || 'Maya'} 👋</h1>
          <p>{isAdmin ? 'Manage training, users, and review flow.' : "Here's what's happening in your cohort today."}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="ghost-button" type="button" style={{ fontSize: '0.8125rem', padding: '0.4rem 0.85rem' }}>Export Report</button>
          
          {isAdmin ? (
            <button 
              className="primary-button" 
              type="button" 
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.85rem' }}
              onClick={() => setShowInviteModal(true)}
            >
              Add User
            </button>
          ) : (
            <button className="primary-button" type="button" style={{ fontSize: '0.8125rem', padding: '0.4rem 0.85rem' }}>New Assignment</button>
          )}
        </div>
      </section>

      <section className="metric-grid" aria-label={`${activeRole} metrics`}>
        {(metricsByRole[activeRole] || metricsByRole['Trainee']).map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className="card-top-row">
              <div className="metric-icon-box">{metric.icon}</div>
              <span className="arrow-link">↗</span>
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.label}</p>
            <small>{metric.delta}</small>
          </article>
        ))}
      </section>

      <section className="insight-grid">
        <article className="panel wide-panel">
          <div className="panel-heading">
            <div>
              <h2>{activeRole === 'Trainer' ? 'Learner Progress' : 'Progress Trends'}</h2>
              <p>Submissions vs Completions over 6 months</p>
            </div>
            <select aria-label="Chart period" defaultValue="6">
              <option value="6">Last 6 months</option>
              <option value="3">Last 3 months</option>
            </select>
          </div>
          
          <div className="chart-wrapper">
            <svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="tealGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="50" x2="600" y2="50" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="100" x2="600" y2="100" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="150" x2="600" y2="150" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="198" x2="600" y2="198" stroke="#cbd5e1" strokeWidth="1.5" />
              <path d="M 0 130 Q 150 110, 300 90 T 600 50 L 600 200 L 0 200 Z" fill="url(#purpleGlow)" />
              <path d="M 0 160 Q 150 145, 300 130 T 600 80 L 600 200 L 0 200 Z" fill="url(#tealGlow)" />
              <path d="M 0 130 Q 150 110, 300 90 T 600 50" fill="none" stroke="#4f46e5" strokeWidth="2.5" />
              <path d="M 0 160 Q 150 145, 300 130 T 600 80" fill="none" stroke="#14b8a6" strokeWidth="2.5" />
            </svg>
            <div className="chart-labels-bottom">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            </div>
          </div>
          <div className="chart-legends">
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#4f46e5' }} />
              <span>Submissions</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#14b8a6' }} />
              <span>Completions</span>
            </div>
          </div>
        </article>

        <article className="panel score-panel">
          <h2>{activeRole === 'Trainee' ? 'Current Role' : 'Avg. Evaluation Score'}</h2>
          <p>{activeRole === 'Trainee' ? 'Visible UI follows your selected workspace role.' : 'Weekly average across all reviews'}</p>
          
          <div className="score-container">
            <strong className="score">
              {activeRole === 'Trainee' ? currentUser.primaryRole : '88'}
              <span>{activeRole === 'Trainee' ? '' : '/100'}</span>
            </strong>
            {activeRole !== 'Trainee' && <span className="score-delta">↗ +6 pts vs last period</span>}
          </div>

          <div className="chart-wrapper" style={{ height: '110px' }}>
            <svg width="100%" height="100%" viewBox="0 0 250 100" preserveAspectRatio="none">
              <line x1="0" y1="20" x2="250" y2="20" stroke="#e2e8f0" strokeDasharray="3,3" />
              <line x1="0" y1="50" x2="250" y2="50" stroke="#e2e8f0" strokeDasharray="3,3" />
              <line x1="0" y1="80" x2="250" y2="80" stroke="#e2e8f0" strokeDasharray="3,3" />
              <path d="M 10 80 L 50 50 L 90 55 L 130 40 L 170 30 L 210 25 L 240 22" fill="none" stroke="#4f46e5" strokeWidth="2" />
              <circle cx="10" cy="80" r="3.5" fill="#4f46e5" /><circle cx="50" cy="50" r="3.5" fill="#4f46e5" />
              <circle cx="90" cy="55" r="3.5" fill="#4f46e5" /><circle cx="130" cy="40" r="3.5" fill="#4f46e5" />
              <circle cx="170" cy="30" r="3.5" fill="#4f46e5" /><circle cx="210" cy="25" r="3.5" fill="#4f46e5" />
              <circle cx="240" cy="22" r="3.5" fill="#4f46e5" />
            </svg>
          </div>
        </article>
      </section>

      {showInviteModal && (
        <InviteUserModal
          accessToken={accessToken}
          currentUser={currentUser}
          onClose={() => setShowInviteModal(false)}
          onInvited={addInvitedUser}
        />
      )}
    </div>
  );
}