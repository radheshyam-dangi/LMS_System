import type { RoleName, SessionUser } from '../../types/auth';

type AppLayoutProps = {
  activeRole: RoleName;
  activeSection: string;
  children: React.ReactNode;
  onLogout: () => void;
  onRoleChange: (role: RoleName) => void;
  onSectionChange: (section: string) => void;
  user: SessionUser;
};

const navigationByRole: Record<RoleName, { main: string[]; tools: string[] }> = {
  Admin: {
    main: ['Dashboard','Users', 'Settings'],
    tools: ['AI Coach'],
  },
  Trainer: {
    main: ['Dashboard', 'My Cohorts', 'Assignments', 'Reviews', 'Progress'],
    tools: ['AI Coach', 'Learners', 'Content Library'],
  },
  Trainee: {
    main: ['Dashboard', 'Learning Paths', 'Assignments', 'Submissions', 'Progress'],
    tools: ['AI Coach', 'Resources', 'Profile'],
  },
};

const initialsFor = (user: SessionUser) => {
  const first = user.firstName?.[0] ?? user.email[0];
  const last = user.lastName?.[0] ?? '';
  return `${first}${last}`.toUpperCase();
};

export function AppLayout({
  activeRole,
  activeSection,
  children,
  onLogout,
  onRoleChange,
  onSectionChange,
  user,
}: AppLayoutProps) {
  const navigation = navigationByRole[activeRole];
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">S</div>
          <div>
            <strong>SkillForge</strong>
            <span>AI Training Platform</span>
          </div>
        </div>

        <span className="role-pill">{activeRole} View</span>

        <nav className="side-nav" aria-label="Main navigation">
          <p>Main</p>
          {navigation.main.map((item) => (
            <button
              className={activeSection === item ? 'active' : ''}
              key={item}
              type="button"
              onClick={() => onSectionChange(item)}
            >
              <span>{item}</span>
              {activeSection === item && <span aria-hidden="true">›</span>}
            </button>
          ))}
        </nav>

        <nav className="side-nav" aria-label="Tools navigation">
          <p>Tools</p>
          {navigation.tools.map((item) => (
            <button
              className={activeSection === item ? 'active' : ''}
              key={item}
              type="button"
              onClick={() => onSectionChange(item)}
            >
              <span>{item}</span>
              {item === 'AI Coach' && <small>New</small>}
            </button>
          ))}
        </nav>

        <div className="sidebar-profile">
          <div className="avatar">{initialsFor(user)}</div>
          <div>
            <strong>{displayName}</strong>
            <span>{activeRole}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-topbar">
          <strong>{activeSection}</strong>
          <div className="topbar-actions">
            <label className="search-field">
              <span>Search</span>
              <input placeholder="Search anything..." />
            </label>
            {user.roles.length > 1 && (
              <select
                aria-label="Switch role"
                value={activeRole}
                onChange={(event) => onRoleChange(event.target.value as RoleName)}
              >
                {user.roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            )}
            <button className="ghost-button" type="button" onClick={onLogout}>
              Logout
            </button>
            <div className="avatar">{initialsFor(user)}</div>
          </div>
        </header>

        {children}
      </section>
    </main>
  );
}
