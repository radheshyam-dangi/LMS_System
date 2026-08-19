import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { SetPasswordForm } from './components/auth/SetPasswordForm';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './components/auth/LoginPage';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import type { LoginResponse, RoleName, SessionUser } from './types/auth';
import { normalizeUser, userFromToken } from './utils/auth';
import './App.css';

const TOKEN_KEY = 'skillforge_access_token';

function ProtectedShell({
  section,
  accessToken,
  activeRole,
  currentUser,
  onLogout,
  onRoleChange,
}: {
  section: string;
  accessToken: string;
  activeRole: RoleName;
  currentUser: SessionUser;
  onLogout: () => void;
  onRoleChange: (role: RoleName) => void;
}) {
  const { unreadCount, markSectionRead, refresh } = useNotifications();
  const location = useLocation();

  // Decrease bell when user opens Learning Paths / Assignments / Evaluations
  useEffect(() => {
    void markSectionRead(section);
  }, [section, markSectionRead]);

  // Refresh after route changes so counters stay live without full page reload
  useEffect(() => {
    void refresh();
  }, [location.pathname, refresh]);

  return (
    <AppLayout
      activeRole={activeRole}
      activeSection={section}
      onLogout={onLogout}
      onRoleChange={onRoleChange}
      user={currentUser}
      notificationCount={unreadCount}
    >
      <DashboardPage
        accessToken={accessToken}
        activeRole={activeRole}
        activeSection={section}
        currentUser={currentUser}
      />
    </AppLayout>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [accessToken, setAccessToken] = useState('');
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [activeRole, setActiveRole] = useState<RoleName>('Trainer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We now use httpOnly cookies for API auth. 
    // The frontend only keeps the non-sensitive user metadata in localStorage for UX continuity across reloads.
    const savedUserStr = localStorage.getItem('skillforge_user');
    
    if (savedUserStr) {
      try {
        const tokenUser = JSON.parse(savedUserStr);
        setCurrentUser(tokenUser);
        
        const savedToken = localStorage.getItem(TOKEN_KEY);
        if (savedToken) {
          setAccessToken(savedToken);
        }

        const roles = tokenUser.roles?.length ? tokenUser.roles : [tokenUser.primaryRole];
        const startRole = roles.includes(tokenUser.primaryRole)
          ? tokenUser.primaryRole
          : roles[0];
        setActiveRole(startRole);
      } catch (e) {
        localStorage.removeItem('skillforge_user');
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setLoading(false);

    const handleTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setAccessToken(customEvent.detail);
    };
    window.addEventListener('token_refreshed', handleTokenRefreshed);
    return () => window.removeEventListener('token_refreshed', handleTokenRefreshed);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const roles = currentUser.roles?.length ? currentUser.roles : [currentUser.primaryRole];
    if (!roles.includes(activeRole)) {
      setActiveRole(roles[0]);
    }
  }, [currentUser, activeRole]);

  const handleLogin = (data: LoginResponse) => {
    const normalizedUser = normalizeUser(data.user);
    localStorage.setItem('skillforge_user', JSON.stringify(normalizedUser));
    if (data.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      setAccessToken(data.accessToken);
    }
    setCurrentUser(normalizedUser);
    const roles = normalizedUser.roles?.length
      ? normalizedUser.roles
      : [normalizedUser.primaryRole];
    setActiveRole(
      roles.includes(normalizedUser.primaryRole)
        ? normalizedUser.primaryRole
        : roles[0]
    );
    navigate('/dashboard', { replace: true });
  };

  const handleLogout = () => {
    // A proper logout would also hit a backend endpoint to clear the httpOnly cookie
    localStorage.removeItem('skillforge_user');
    localStorage.removeItem(TOKEN_KEY);
    setCurrentUser(null);
    setAccessToken('');
    setActiveRole('Trainee');
    navigate('/login', { replace: true });
  };

  const handleRoleChange = (role: RoleName) => {
    if (!currentUser) return;
    const roles = currentUser.roles?.length ? currentUser.roles : [currentUser.primaryRole];
    if (roles.includes(role)) {
      setActiveRole(role);
    }
  };

  if (loading) {
    return <main className="loading-shell">Loading SkillForge...</main>;
  }

  const ProtectedLayout = ({ section }: { section: string }) => {
    if (!currentUser || !accessToken) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Role-based route guard
    const traineeBlocked = ['Users', 'Evaluations', 'Analytics'];
    if (activeRole === 'Trainee' && traineeBlocked.includes(section)) {
      return <Navigate to="/dashboard" replace />;
    }
    if (activeRole !== 'Admin' && section === 'Users') {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <NotificationProvider accessToken={accessToken}>
        <ProtectedShell
          section={section}
          accessToken={accessToken}
          activeRole={activeRole}
          currentUser={currentUser}
          onLogout={handleLogout}
          onRoleChange={handleRoleChange}
        />
      </NotificationProvider>
    );
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          currentUser && accessToken ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <HomePage onLoginClick={() => navigate('/login')} />
          )
        }
      />
      <Route
        path="/login"
        element={
          currentUser && accessToken ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage onBackHome={() => navigate('/')} onLogin={handleLogin} />
          )
        }
      />
      <Route
        path="/set-password"
        element={<SetPasswordForm onSuccess={() => navigate('/login')} />}
      />

      <Route path="/dashboard" element={<ProtectedLayout section="Dashboard" />} />
      <Route path="/learning-paths" element={<ProtectedLayout section="Learning Paths" />} />
      <Route path="/learning-paths/:pathId" element={<ProtectedLayout section="Learning Paths" />} />
      <Route path="/modules" element={<ProtectedLayout section="Modules" />} />
      <Route path="/modules/:moduleId" element={<ProtectedLayout section="Module Details" />} />
      <Route path="/assignments" element={<ProtectedLayout section="Assignments" />} />
      <Route path="/evaluations" element={<ProtectedLayout section="Evaluations" />} />
      <Route path="/users" element={<ProtectedLayout section="Users" />} />
      <Route path="/progress" element={<ProtectedLayout section="Progress" />} />
      <Route path="/analytics" element={<ProtectedLayout section="Analytics" />} />
      <Route path="/settings" element={<ProtectedLayout section="Settings" />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
