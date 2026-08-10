import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  BookOpen,
  Layers,
  ClipboardList,
  Star,
  Users,
  TrendingUp,
  BarChart3,
  Settings,
  ChevronRight,
  Zap,
  Bell,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RoleName, SessionUser } from '../../types/auth';
import { useNotifications } from '../../context/NotificationContext';

type AppLayoutProps = {
  activeRole: RoleName;
  activeSection: string;
  children: React.ReactNode;
  onLogout: () => void;
  onRoleChange: (role: RoleName) => void;
  onSectionChange?: (section: string) => void;
  user: SessionUser;
  notificationCount?: number;
};

type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  tag?: string;
};

const navigationByRole: Record<RoleName, { main: NavItem[]; tools: NavItem[] }> = {
  Admin: {
    main: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
      { name: 'Learning Paths', path: '/learning-paths', icon: BookOpen },
      { name: 'Modules', path: '/modules', icon: Layers },
      { name: 'Assignments', path: '/assignments', icon: ClipboardList },
      { name: 'Evaluations', path: '/evaluations', icon: Star },
      { name: 'Users', path: '/users', icon: Users },
      { name: 'Progress', path: '/progress', icon: TrendingUp },
    ],
    tools: [
      { name: 'Analytics', path: '/analytics', icon: BarChart3 },
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
  Trainer: {
    main: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
      { name: 'Learning Paths', path: '/learning-paths', icon: BookOpen },
      { name: 'Modules', path: '/modules', icon: Layers },
      { name: 'Assignments', path: '/assignments', icon: ClipboardList },
      { name: 'Evaluations', path: '/evaluations', icon: Star },
      { name: 'Progress', path: '/progress', icon: TrendingUp },
    ],
    tools: [
      { name: 'Analytics', path: '/analytics', icon: BarChart3 },
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
  Trainee: {
    main: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
      { name: 'Learning Paths', path: '/learning-paths', icon: BookOpen },
      { name: 'Modules', path: '/modules', icon: Layers },
      { name: 'Assignments', path: '/assignments', icon: ClipboardList },
      { name: 'Progress', path: '/progress', icon: TrendingUp },
    ],
    tools: [{ name: 'Settings', path: '/settings', icon: Settings }],
  },
};

const ROLE_ORDER: RoleName[] = ['Admin', 'Trainer', 'Trainee'];

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
  user,
  notificationCount = 0,
}: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, markAsRead, markAllRead, unreadCount } = useNotifications();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const count = Math.max(notificationCount, unreadCount);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const availableRoles = useMemo(() => {
    const fromUser = (user.roles || [])
      .map((r) => (typeof r === 'string' ? r : (r as any)?.name))
      .filter((r): r is RoleName => ROLE_ORDER.includes(r as RoleName));
    const unique = Array.from(new Set([...(fromUser.length ? fromUser : [user.primaryRole])]));
    return ROLE_ORDER.filter((role) => unique.includes(role));
  }, [user.roles, user.primaryRole]);

  const showRoleSwitcher = availableRoles.length > 1;
  const effectiveRole = availableRoles.includes(activeRole)
    ? activeRole
    : availableRoles[0] || user.primaryRole || 'Trainee';

  const navigation = navigationByRole[effectiveRole] || navigationByRole.Trainee;
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const userSubtitle =
    effectiveRole === 'Trainer'
      ? 'Senior Trainer'
      : effectiveRole === 'Trainee'
        ? 'Junior Engineer'
        : 'Platform Administrator';

  const isCurrentPath = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const bellDisplay = count > 5 ? '5+' : count > 0 ? String(count) : null;

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <div className="brand-mark">
            <Zap size={20} color="#ffffff" strokeWidth={2.5} />
          </div>
          <div>
            <strong>SkillForge</strong>
            <span>AI Training Platform</span>
          </div>
        </div>

        <span
          className="role-pill"
          style={{
            background:
              effectiveRole === 'Trainer' ? '#ede9fe' : effectiveRole === 'Admin' ? '#fef3c7' : '#d1fae5',
            color:
              effectiveRole === 'Trainer' ? '#6d28d9' : effectiveRole === 'Admin' ? '#b45309' : '#047857',
          }}
        >
          <span className="role-pill-dot" />
          {effectiveRole} View
        </span>

        <nav className="side-nav" aria-label="Main navigation">
          <p className="side-nav-header">MAIN</p>
          {navigation.main.map((item) => {
            const IconComponent = item.icon;
            const active = isCurrentPath(item.path);
            return (
              <button
                className={active ? 'side-nav-item active' : 'side-nav-item'}
                key={item.name}
                type="button"
                onClick={() => navigate(item.path)}
              >
                <div className="nav-item-left">
                  <IconComponent className="nav-icon-svg" size={18} />
                  <span>{item.name}</span>
                </div>
                {active && <ChevronRight size={16} className="active-arrow-svg" />}
              </button>
            );
          })}
        </nav>

        <nav className="side-nav" aria-label="Tools navigation">
          <p className="side-nav-header">TOOLS</p>
          {navigation.tools.map((item) => {
            const IconComponent = item.icon;
            const active = isCurrentPath(item.path);
            return (
              <button
                className={active ? 'side-nav-item active' : 'side-nav-item'}
                key={item.name}
                type="button"
                onClick={() => navigate(item.path)}
              >
                <div className="nav-item-left">
                  <IconComponent className="nav-icon-svg" size={18} />
                  <span>{item.name}</span>
                </div>
                {item.tag && <span className="nav-tag">{item.tag}</span>}
                {active && !item.tag && <ChevronRight size={16} className="active-arrow-svg" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-profile">
          <div className="avatar">{initialsFor(user)}</div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            <strong
              style={{
                display: 'block',
                fontSize: '13px',
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </strong>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{userSubtitle}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-topbar">
          <h2 className="topbar-title">{activeSection}</h2>
          <div className="topbar-actions">
            <div className="search-field">
              <span className="search-icon">🔍</span>
              <input placeholder="Search anything... ⌘K" />
            </div>

            {showRoleSwitcher && (
              <div className="role-selector-wrap">
                <select
                  aria-label="Switch role"
                  className="role-select"
                  value={effectiveRole}
                  onChange={(event) => onRoleChange(event.target.value as RoleName)}
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div ref={panelRef} style={{ position: 'relative' }}>
              <button
                className="icon-badge-button"
                type="button"
                aria-label={`Notifications${count > 0 ? ` (${count})` : ''}`}
                onClick={() => setPanelOpen((o) => !o)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={20} color="#475569" />
                {bellDisplay && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 800,
                      borderRadius: '9999px',
                      minWidth: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      lineHeight: 1,
                      border: '2px solid #fff',
                      boxShadow: '0 1px 4px rgba(239,68,68,0.4)',
                      animation: 'pulse-bell 2s infinite',
                    }}
                  >
                    {bellDisplay}
                  </span>
                )}
              </button>

              {panelOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '110%',
                    width: 340,
                    maxHeight: 420,
                    overflowY: 'auto',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    boxShadow: '0 12px 40px rgba(15,23,42,0.12)',
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>Notifications</strong>
                    {count > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#4f46e5',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 && (
                    <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>
                      No notifications yet.
                    </div>
                  )}
                  {notifications.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        void markAsRead(n.id);
                        if (n.link) navigate(n.link);
                        setPanelOpen(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        border: 'none',
                        borderBottom: '1px solid #f8fafc',
                        background: n.isRead ? '#fff' : '#f5f3ff',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: n.isRead ? 500 : 700,
                          color: '#0f172a',
                        }}
                      >
                        {n.title}
                      </div>
                      {n.message && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{n.message}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="topbar-user-badge" title={displayName}>
              <div className="avatar">{initialsFor(user)}</div>
              <div className="user-meta">
                <span className="user-name">{displayName}</span>
                <span className="user-role">{effectiveRole}</span>
              </div>
            </div>

            <button type="button" className="logout-button" onClick={onLogout} title="Logout">
              Logout
            </button>
          </div>
        </header>

        <div className="workspace-content">{children}</div>
      </section>

      <style>{`
        @keyframes pulse-bell {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </main>
  );
}
