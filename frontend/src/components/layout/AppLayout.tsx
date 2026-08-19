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
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RoleName, SessionUser } from '../../types/auth';
import { useNotifications } from '../../context/NotificationContext';
import { useSearch } from '../../context/SearchContext';

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
      { name: 'Assignments', path: '/assignments', icon: ClipboardList },
      { name: 'Evaluations', path: '/evaluations', icon: Star },
      { name: 'Users', path: '/users', icon: Users },
      { name: 'Progress', path: '/progress', icon: TrendingUp },
    ],
    tools: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
  Trainer: {
    main: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
      { name: 'Learning Paths', path: '/learning-paths', icon: BookOpen },
      { name: 'Assignments', path: '/assignments', icon: ClipboardList },
      { name: 'Evaluations', path: '/evaluations', icon: Star },
      { name: 'Progress', path: '/progress', icon: TrendingUp },
    ],
    tools: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
  Trainee: {
    main: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
      { name: 'Learning Paths', path: '/learning-paths', icon: BookOpen },
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

const timeAgo = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  const { notifications, markAsRead, markAllRead, unreadCount, deleteNotification } = useNotifications();
  const { searchQuery, setSearchQuery } = useSearch();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const count = Math.max(notificationCount, unreadCount);

  useEffect(() => {
    // Keep panel open on hover, but still allow click outside if click-opened
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
              <input
                placeholder="Search anything... ⌘K"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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

            <div 
              ref={panelRef} 
              style={{ position: 'relative' }}
              onMouseEnter={() => setPanelOpen(true)}
              onMouseLeave={() => setPanelOpen(false)}
            >
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
                    width: 360,
                    maxHeight: 450,
                    overflowY: 'auto',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    boxShadow: '0 12px 40px rgba(15,23,42,0.12)',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column'
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
                  {notifications.filter(n => !n.isRead).length === 0 && (
                    <div style={{ padding: '24px 16px', color: '#64748b', fontSize: 14, textAlign: 'center' }}>
                      You're all caught up!
                    </div>
                  )}
                  {notifications.filter(n => !n.isRead).slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      title={n.message || n.title}
                      onClick={() => {
                        void markAsRead(n.id);
                        if (n.link) navigate(n.link);
                        setPanelOpen(false);
                      }}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'flex-start',
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderBottom: '1px solid #f8fafc',
                        background: n.isRead ? '#fff' : '#f0f9ff',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        gap: '12px'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = n.isRead ? '#f8fafc' : '#e0f2fe')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = n.isRead ? '#fff' : '#f0f9ff')}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: n.isRead ? 400 : 700,
                            color: n.isRead ? '#475569' : '#0f172a',
                            lineHeight: 1.4
                          }}
                        >
                          {n.title}
                        </div>
                        {n.message && (
                          <div style={{ 
                            fontSize: 12, 
                            color: n.isRead ? '#94a3b8' : '#64748b', 
                            marginTop: 4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {n.message}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteNotification(n.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#cbd5e1')}
                        title="Delete notification"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/dashboard?section=Notifications');
                        setPanelOpen(false);
                      }}
                      style={{
                        padding: '12px',
                        background: '#f8fafc',
                        border: 'none',
                        borderTop: '1px solid #e2e8f0',
                        color: '#4f46e5',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    >
                      View all notifications
                    </button>
                  )}
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
