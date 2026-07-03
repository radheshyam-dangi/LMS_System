import { useMemo, useState } from 'react';
import { InviteUserModal } from '../components/users/InviteUserModal';
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

const metricsByRole: Record<RoleName, { label: string; value: string; delta: string }[]> = {
  Admin: [
    { label: 'Total Trainees', value: '24', delta: '+3 this month' },
    { label: 'Active Assignments', value: '18', delta: '6 due this week' },
    { label: 'Pending Reviews', value: '7', delta: '3 high priority' },
    { label: 'Completion Rate', value: '82%', delta: '+4% vs last month' },
  ],
  Trainer: [
    { label: 'Learners Assigned', value: '16', delta: '4 need feedback' },
    { label: 'Reviews Completed', value: '31', delta: '+9 this week' },
    { label: 'Live Modules', value: '12', delta: '2 updated today' },
    { label: 'Average Score', value: '88', delta: '+6 pts' },
  ],
  Trainee: [
    { label: 'Modules Open', value: '6', delta: '2 due soon' },
    { label: 'Assignments Done', value: '14', delta: '+5 this month' },
    { label: 'Review Score', value: '84', delta: '+3 pts' },
    { label: 'Learning Streak', value: '9d', delta: 'Keep going' },
  ],
};

export function DashboardPage({
  accessToken,
  activeRole,
  activeSection,
  currentUser,
}: DashboardPageProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
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

  const title = useMemo(() => {
    if (activeSection !== 'Dashboard') {
      return activeSection;
    }

    return `${activeRole} Dashboard`;
  }, [activeRole, activeSection]);

  const addInvitedUser = (user: Omit<VisibleUser, 'status'>) => {
    setUsers((current) => [{ ...user, status: 'invited' }, ...current]);
  };

  return (
    <div className="dashboard-content">
      <section className="workspace-heading">
        <div>
          <h1>{title}</h1>
          <p>{activeRole === 'Admin' ? 'Manage training, users, and review flow.' : 'Your workspace updates with the selected role.'}</p>
        </div>
        {activeRole === 'Admin' && (
          <button className="primary-button" type="button" onClick={() => setShowInviteModal(true)}>
            Add User
          </button>
        )}
      </section>

      <section className="metric-grid" aria-label={`${activeRole} metrics`}>
        {metricsByRole[activeRole].map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span className="metric-icon">{metric.label[0]}</span>
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
              <p>Submissions and completions across the current learning cycle.</p>
            </div>
            <select aria-label="Chart period" defaultValue="6">
              <option value="6">Last 6 months</option>
              <option value="3">Last 3 months</option>
            </select>
          </div>
          <div className="chart-lines">
            <span />
            <span />
          </div>
        </article>

        <article className="panel">
          <h2>{activeRole === 'Trainee' ? 'Current Role' : 'Avg. Evaluation Score'}</h2>
          <strong className="score">{activeRole === 'Trainee' ? currentUser.primaryRole : '88'}<span>{activeRole === 'Trainee' ? '' : '/100'}</span></strong>
          <p>{activeRole === 'Trainee' ? 'Visible UI follows your selected workspace role.' : '+6 pts vs last period'}</p>
        </article>
      </section>

      {activeRole === 'Admin' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>User Profiles</h2>
              <p>Invited users appear immediately; accepted invitations become activated after password setup.</p>
            </div>
          </div>
          <div className="user-table">
            {users.map((user) => (
              <article className="user-row" key={user.email}>
                <div>
                  <strong>{`${user.firstName} ${user.lastName}`}</strong>
                  <span>{user.email}</span>
                </div>
                <span>{user.primaryRole}</span>
                <span>{user.roles.join(', ')}</span>
                <small className={user.status}>{user.status}</small>
              </article>
            ))}
          </div>
        </section>
      )}

      {showInviteModal && (
        <InviteUserModal
          accessToken={accessToken}
          currentUser={currentUser} // ◄ ADD THIS LINE HERE
          onClose={() => setShowInviteModal(false)}
          onInvited={addInvitedUser}
        />
      )}
    </div>
  );
}
