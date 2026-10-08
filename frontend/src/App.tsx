import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { SetPasswordForm } from './components/auth/SetPasswordForm';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './components/auth/LoginPage';
import LPEditorPage from './pages/LPEditorPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { ToastProvider } from './context/ToastContext';
import type { LoginResponse, RoleName, SessionUser } from './types/auth';
import { normalizeUser, userFromToken } from './utils/auth';
import './App.css';

const TOKEN_KEY = 'skillforge_access_token';

const ROLE_DASHBOARDS: Record<string, string> = {
  Admin: '/users',
  Trainer: '/dashboard',
  Trainee: '/dashboard',
};

const getRoleDashboard = (role: string) => ROLE_DASHBOARDS[role] || '/dashboard';

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

  // Remove route-based refresh to prevent continuous API hits
  // Notifications will now only be refreshed when explicitly triggered (e.g., submitting an assignment)
  
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

function ProtectedLayout({
  section,
  currentUser,
  accessToken,
  activeRole,
  onLogout,
  onRoleChange,
}: {
  section: string;
  currentUser: SessionUser | null;
  accessToken: string;
  activeRole: RoleName;
  onLogout: () => void;
  onRoleChange: (role: RoleName) => void;
}) {
  const location = useLocation();

  if (!currentUser || !accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based route guard
  const traineeBlocked = ['Users', 'Evaluations', 'Analytics', 'Progress'];
  if (activeRole === 'Trainee' && traineeBlocked.includes(section)) {
    return <Navigate to={getRoleDashboard(activeRole)} replace />;
  }
  const adminBlocked = [
    'Dashboard',
    'Learning Paths',
    'Module Details',
    'Modules',
    'Assignments',
    'Evaluations',
    'Progress',
  ];
  if (activeRole === 'Admin' && adminBlocked.includes(section)) {
    return <Navigate to={getRoleDashboard(activeRole)} replace />;
  }
  if (activeRole !== 'Admin' && section === 'Users') {
    return <Navigate to={getRoleDashboard(activeRole)} replace />;
  }
  if (activeRole === 'Trainer' && section === 'Progress') {
    return <Navigate to={getRoleDashboard(activeRole)} replace />;
  }

  return (
    <ProtectedShell
      section={section}
      accessToken={accessToken}
      activeRole={activeRole}
      currentUser={currentUser}
      onLogout={onLogout}
      onRoleChange={onRoleChange}
    />
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

        const savedActiveRole = localStorage.getItem('skillforge_active_role') as RoleName | null;
        const roles = tokenUser.roles?.length ? tokenUser.roles : [tokenUser.primaryRole];
        let startRole = roles[0];
        
        if (savedActiveRole && roles.includes(savedActiveRole)) {
          startRole = savedActiveRole;
        } else if (roles.includes(tokenUser.primaryRole)) {
          startRole = tokenUser.primaryRole;
        }
        
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
    const handleUserUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<SessionUser>;
      setCurrentUser(customEvent.detail);
      localStorage.setItem('skillforge_user', JSON.stringify(customEvent.detail));
    };
    
    window.addEventListener('token_refreshed', handleTokenRefreshed);
    window.addEventListener('user_updated', handleUserUpdated);
    
    return () => {
      window.removeEventListener('token_refreshed', handleTokenRefreshed);
      window.removeEventListener('user_updated', handleUserUpdated);
    };
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
    
    const startRole = roles.includes(normalizedUser.primaryRole)
        ? normalizedUser.primaryRole
        : roles[0];
        
    setActiveRole(startRole);
    localStorage.setItem('skillforge_active_role', startRole);
    navigate(getRoleDashboard(startRole), { replace: true });
  };

  const handleLogout = () => {
    // A proper logout would also hit a backend endpoint to clear the httpOnly cookie
    localStorage.removeItem('skillforge_user');
    localStorage.removeItem('skillforge_active_role');
    localStorage.removeItem(TOKEN_KEY);
    setCurrentUser(null);
    setAccessToken('');
    setActiveRole('Trainee');
    navigate('/login', { replace: true });
  };

  const handleRoleChange = (role: RoleName) => {
    if (!currentUser || !accessToken) {
      navigate('/login', { replace: true });
      return;
    }
    const roles = currentUser.roles?.length ? currentUser.roles : [currentUser.primaryRole];
    if (roles.includes(role)) {
      setActiveRole(role);
      localStorage.setItem('skillforge_active_role', role);
      navigate(getRoleDashboard(role), { replace: true });
    }
  };

  if (loading) {
    return <main className="loading-shell">Loading SkillForge...</main>;
  }

  return (
    <ToastProvider>
    <NotificationProvider accessToken={accessToken} activeRole={activeRole}>
      <Routes>
      <Route
        path="/"
        element={
          currentUser && accessToken ? (
            <Navigate to={getRoleDashboard(activeRole)} replace />
          ) : (
            <HomePage onLoginClick={() => navigate('/login')} />
          )
        }
      />
      <Route
        path="/login"
        element={
          currentUser && accessToken ? (
            <Navigate to={getRoleDashboard(activeRole)} replace />
          ) : (
            <LoginPage onBackHome={() => navigate('/')} onLogin={handleLogin} />
          )
        }
      />
      <Route
        path="/set-password"
        element={<SetPasswordForm onSuccess={() => navigate('/login')} />}
      />

      <Route path="/dashboard" element={<ProtectedLayout section="Dashboard" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/trainer/trainees/:traineeId" element={<ProtectedLayout section="TrainerTraineeDetail" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/learning-paths" element={<ProtectedLayout section="Learning Paths" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/learning-paths/new" element={ currentUser && accessToken && activeRole !== 'Trainee' ? <LPEditorPage /> : <Navigate to="/dashboard" replace /> } />
      <Route path="/learning-paths/:pathId/edit" element={ currentUser && accessToken && activeRole !== 'Trainee' ? <LPEditorPage /> : <Navigate to="/dashboard" replace /> } />
      <Route path="/learning-paths/:pathId" element={<ProtectedLayout section="Learning Paths" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/modules" element={<ProtectedLayout section="Modules" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/modules/:moduleId" element={<ProtectedLayout section="Module Details" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/learning-paths/:pathId/modules/:moduleId" element={<ProtectedLayout section="Module Details" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/assignments" element={<ProtectedLayout section="Assignments" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/trainer/assignments" element={<Navigate to="/assignments" replace />} />
      <Route path="/evaluations" element={<Navigate to="/assignments?status=pending" replace />} />
      <Route path="/users" element={<ProtectedLayout section="Users" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/progress" element={<ProtectedLayout section="Progress" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/analytics" element={<ProtectedLayout section="Analytics" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/settings" element={<ProtectedLayout section="Settings" currentUser={currentUser} accessToken={accessToken} activeRole={activeRole} onLogout={handleLogout} onRoleChange={handleRoleChange} />} />
      <Route path="/notifications" element={currentUser && accessToken ? <NotificationsPage activeRole={activeRole} /> : <Navigate to="/login" replace />} />

      <Route path="*" element={<Navigate to={getRoleDashboard(activeRole)} replace />} />
    </Routes>
    </NotificationProvider>
    </ToastProvider>
  );
}

export default App;
