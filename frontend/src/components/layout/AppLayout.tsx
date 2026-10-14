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
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Bell,
  Trash2,
  Menu,
  X,
  ChevronDown,
  FileText,
  Bot,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RoleName, SessionUser } from '../../types/auth';
import { useNotifications } from '../../context/NotificationContext';
import { getNotificationRoute } from '../../utils/notificationUtils';

const CustomRoleSwitcher = ({ effectiveRole, availableRoles, onRoleChange }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="custom-role-switcher" ref={ref} style={{ position: 'relative' }}>
      <button 
        className="role-select-btn" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Switch role"
      >
        <span>{effectiveRole}</span>
        <ChevronDown size={14} className={`chevron-icon ${isOpen ? 'open' : ''}`} />
      </button>
      {isOpen && (
        <div className="role-dropdown-menu">
     
          {availableRoles.map((role: string) => (
            <button
              key={role}
              className={`role-dropdown-item ${role === effectiveRole ? 'active' : ''}`}
              onClick={() => {
                onRoleChange(role);
                setIsOpen(false);
              }}
            >
              {role}
              {role === effectiveRole && (
                <div className="active-indicator" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
      { name: 'Users', path: '/users', icon: Users },
    ],
    tools: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
  Trainer: {
    main: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
      { name: 'Learning Paths', path: '/learning-paths', icon: BookOpen },
      { name: 'Evaluations', path: '/assignments', icon: ClipboardList },
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [hoveredNotificationId, setHoveredNotificationId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<any>(null);
  const count = Math.max(notificationCount, unreadCount);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setPanelOpen(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setPanelOpen(false);
    }, 250);
  };

  const handleBellToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setPanelOpen((prev) => !prev);
  };

  const getDropdownIconMeta = (type: string) => {
    switch (type) {
      case 'learning_path_assigned':
        return { icon: <BookOpen size={15} />, orbClass: 'theme-indigo' };
      case 'assignment_assigned':
        return { icon: <FileText size={15} />, orbClass: 'theme-sky' };
      case 'submission_pending':
        return { icon: <ClipboardList size={15} />, orbClass: 'theme-amber' };
      case 'ai_evaluation_ready':
        return { icon: <Bot size={15} />, orbClass: 'theme-purple' };
      case 'ai_evaluation_failed':
        return { icon: <AlertTriangle size={15} />, orbClass: 'theme-red' };
      case 'evaluation_completed':
        return { icon: <CheckCircle2 size={15} />, orbClass: 'theme-emerald' };
      default:
        return { icon: <Bell size={15} />, orbClass: 'theme-indigo' };
    }
  };

  useEffect(() => {
    // Keep panel open on hover, but still allow click outside if click-opened
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
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

  const isCurrentPath = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Persistent sidebar toggle state: 'on' = expanded (icons and titles visible), 'off' = collapsed (only icons visible)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sidebar_toggle_state') || localStorage.getItem('sidebar_status');
      if (saved === 'off') return true;
      if (saved === 'on') return false;
      // Default to 'on' (expanded) and persist initial state
      localStorage.setItem('sidebar_toggle_state', 'on');
      return false;
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const isNowCollapsed = !prev;
      const statusValue = isNowCollapsed ? 'off' : 'on';
      try {
        localStorage.setItem('sidebar_toggle_state', statusValue);
        localStorage.setItem('sidebar_status', statusValue);
        localStorage.setItem('sidebar_toggle', statusValue);
      } catch (err) {
        console.warn('Unable to persist sidebar toggle state', err);
      }
      return isNowCollapsed;
    });
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sidebar_toggle_state' || e.key === 'sidebar_status') {
        if (e.newValue === 'off') setIsSidebarCollapsed(true);
        else if (e.newValue === 'on') setIsSidebarCollapsed(false);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // When clicking a link on mobile, close the menu
  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const bellDisplay = count > 5 ? '5+' : count > 0 ? String(count) : null;

  return (
    <div className="dashboard-shell">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="mobile-sidebar-backdrop hidden-desktop"
          onClick={() => setIsMobileMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      )}

      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand-header">
          <div
            className="brand-block"
            onClick={() => navigate(effectiveRole === 'Admin' ? '/users' : '/dashboard')}
            style={{ cursor: 'pointer' }}
            title={effectiveRole === 'Admin' ? "SkillForge Users" : "SkillForge Dashboard"}
          >
            <div className="brand-mark">
              <Zap size={20} color="#ffffff" strokeWidth={2.5} />
            </div>
            {!isSidebarCollapsed && (
              <div className="brand-text">
                <strong>SkillForge</strong>
                <span>Enterprise LMS</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="sidebar-collapse-toggle-btn"
            onClick={handleToggleSidebar}
            title={isSidebarCollapsed ? "Expand sidebar (Status: Off -> On)" : "Collapse sidebar (Status: On -> Off)"}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            id="sidebar-toggle-btn"
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {!isSidebarCollapsed ? (
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
        ) : (
          <div
            className="role-pill-compact"
            title={`${effectiveRole} View`}
            style={{
              background:
                effectiveRole === 'Trainer' ? '#ede9fe' : effectiveRole === 'Admin' ? '#fef3c7' : '#d1fae5',
              color:
                effectiveRole === 'Trainer' ? '#6d28d9' : effectiveRole === 'Admin' ? '#b45309' : '#047857',
            }}
          >
            <span className="role-pill-dot" />
          </div>
        )}

        <nav className="side-nav" aria-label="Main navigation">
          {!isSidebarCollapsed && <p className="side-nav-header">MAIN</p>}
          {navigation.main.map((item) => {
            const IconComponent = item.icon;
            const active = isCurrentPath(item.path);
            return (
              <button
                className={`side-nav-item hover-effect focus-ring touch-target ${active ? 'active' : ''}`}
                key={item.name}
                type="button"
                onClick={() => handleNavClick(item.path)}
                title={item.name}
                data-title={item.name}
              >
                <div className="nav-item-left">
                  <IconComponent className="nav-icon-svg" size={18} />
                  {!isSidebarCollapsed && <span>{item.name}</span>}
                </div>
                {!isSidebarCollapsed && active && <ChevronRight size={16} className="active-arrow-svg" />}
              </button>
            );
          })}
        </nav>

        <nav className="side-nav" aria-label="Tools navigation">
          {!isSidebarCollapsed && <p className="side-nav-header">TOOLS</p>}
          {navigation.tools.map((item) => {
            const IconComponent = item.icon;
            const active = isCurrentPath(item.path);
            return (
              <button
                className={`side-nav-item hover-effect focus-ring touch-target ${active ? 'active' : ''}`}
                key={item.name}
                type="button"
                onClick={() => handleNavClick(item.path)}
                title={item.name}
                data-title={item.name}
              >
                <div className="nav-item-left">
                  <IconComponent className="nav-icon-svg" size={18} />
                  {!isSidebarCollapsed && <span>{item.name}</span>}
                </div>
                {!isSidebarCollapsed && item.tag && <span className="nav-tag">{item.tag}</span>}
                {!isSidebarCollapsed && active && !item.tag && <ChevronRight size={16} className="active-arrow-svg" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-profile" title={displayName}>
          <div className="avatar" style={{ padding: (user as any).avatarUrl ? 0 : undefined, overflow: 'hidden' }}>
            {(user as any).avatarUrl ? (
              <img src={(user as any).avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initialsFor(user)
            )}
          </div>
          {!isSidebarCollapsed && (
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
            </div>
          )}
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              className="hidden-desktop hover-effect focus-ring touch-target"
              onClick={() => setIsMobileMenuOpen(true)}
              style={{ background: 'none', border: 'none', padding: 0, color: '#475569', display: 'flex', alignItems: 'center' }}
              aria-label="Open mobile navigation"
            >
              <Menu size={24} />
            </button>

            <h2 className="topbar-title">{activeSection}</h2>
          </div>
          <div className="topbar-actions">
            {showRoleSwitcher && (
              <CustomRoleSwitcher
                effectiveRole={effectiveRole}
                availableRoles={availableRoles}
                onRoleChange={onRoleChange}
              />
            )}

            <div
              ref={panelRef}
              style={{ position: 'relative' }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                className={`icon-badge-button ${panelOpen ? 'is-open' : ''}`}
                type="button"
                aria-label={`Notifications${count > 0 ? ` (${count})` : ''}`}
                onClick={handleBellToggle}
              >
                <Bell size={20} color={panelOpen ? '#4f46e5' : '#475569'} />
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
                <div className="topbar-notif-dropdown">
                  <div className="topbar-notif-header">
                    <div className="topbar-notif-header-title">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="topbar-notif-badge">{unreadCount} unread</span>
                      )}
                    </div>
                    {count > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        className="topbar-notif-mark-btn"
                        title="Mark all notifications as read"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="topbar-notif-list">
                    {notifications.filter((n) => !n.isRead).length === 0 && (
                      <div
                        style={{
                          padding: '32px 16px',
                          color: '#64748b',
                          fontSize: 13,
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Bell size={18} color="#94a3b8" />
                        </div>
                        <span style={{ fontWeight: 600, color: '#334155' }}>You're all caught up!</span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>No unread alerts right now.</span>
                      </div>
                    )}

                    {notifications
                      .filter((n) => !n.isRead)
                      .slice(0, 15)
                      .map((n) => {
                        const meta = getDropdownIconMeta(n.type);
                        return (
                          <div
                            key={n.id}
                            title={n.message || n.title}
                            onClick={() => {
                              void markAsRead(n.id);
                              navigate(getNotificationRoute(n, effectiveRole));
                              setPanelOpen(false);
                            }}
                            className={`topbar-notif-item ${!n.isRead ? 'is-unread' : ''}`}
                            onMouseEnter={() => setHoveredNotificationId(n.id)}
                            onMouseLeave={() => setHoveredNotificationId(null)}
                          >
                            <div className={`topbar-notif-icon-orb ${meta.orbClass}`}>
                              {meta.icon}
                            </div>
                            <div className="topbar-notif-content">
                              <div className="topbar-notif-title">
                                {n.title}
                              </div>
                              {n.message && (
                                <div
                                  className="topbar-notif-desc"
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: hoveredNotificationId === n.id ? 'unset' : 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {n.message}
                                </div>
                              )}
                              <div className="topbar-notif-time">
                                <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                                <span>{timeAgo(n.createdAt)}</span>
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
                                borderRadius: '4px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#cbd5e1')}
                              title="Delete notification"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                  </div>

                  <div className="topbar-notif-footer">
                    <button
                      type="button"
                      className="topbar-notif-view-all-btn"
                      onClick={() => {
                        navigate('/notifications');
                        setPanelOpen(false);
                      }}
                    >
                      <span>All Notifications</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              className="topbar-user-badge hover-effect focus-ring"
              title={`${displayName} - Click to open Settings`}
              onClick={() => navigate('/settings')}
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  navigate('/settings');
                }
              }}
            >
              <div className="avatar" style={{ padding: (user as any).avatarUrl ? 0 : undefined, overflow: 'hidden' }}>
                {(user as any).avatarUrl ? (
                  <img src={(user as any).avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initialsFor(user)
                )}
              </div>
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
    </div>
  );
}
