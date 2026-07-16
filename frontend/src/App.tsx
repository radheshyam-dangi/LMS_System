import { useEffect, useMemo, useState } from 'react';
import { SetPasswordForm } from './components/auth/SetPasswordForm';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './components/auth/LoginPage';
import type { LoginResponse, RoleName, SessionUser } from './types/auth';
import { normalizeUser, userFromToken } from './utils/auth';
import './App.css';

const TOKEN_KEY = 'skillforge_access_token';
type RouteName = 'home' | 'login' | 'set-password' | 'dashboard';

const routeFromPath = (): RouteName => {
  const path = window.location.pathname.toLowerCase();
  const hasInvitationToken = new URLSearchParams(window.location.search).has('token');

  if (hasInvitationToken || path.includes('set-password')) {
    return 'set-password';
  }
  if (path.includes('login')) {
    return 'login';
  }
  if (path.includes('dashboard')) {
    return 'dashboard';
  }
  return 'home';
};

function App() {
  const [route, setRoute] = useState<RouteName>(routeFromPath);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [activeRole, setActiveRole] = useState<RoleName>('Trainee');
  const [activeSection, setActiveSection] = useState('Dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token');
    if (savedToken) {
      const tokenUser = userFromToken(savedToken);
      if (tokenUser) {
        localStorage.setItem(TOKEN_KEY, savedToken);
        setAccessToken(savedToken);
        setCurrentUser(tokenUser);
        setActiveRole(tokenUser.primaryRole);

        if (route !== 'set-password') {
          setRoute('dashboard');
          window.history.replaceState(null, '', '/dashboard');
        }
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('token');
        if (route === 'dashboard') {
          setRoute('login');
          window.history.replaceState(null, '', '/login');
        }
      }
    } else if (route === 'dashboard') {
      setRoute('login');
      window.history.replaceState(null, '', '/login');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(routeFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextRoute: RouteName, path: string) => {
    setRoute(nextRoute);
    window.history.pushState(null, '', path);
  };

  const handleLogin = (data: LoginResponse) => {
    const normalizedUser = normalizeUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem('token', data.accessToken);
    setAccessToken(data.accessToken);
    setCurrentUser(normalizedUser);
    setActiveRole(normalizedUser.primaryRole);
    setActiveSection('Dashboard');
    navigate('dashboard', '/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('token');
    setAccessToken('');
    setCurrentUser(null);
    setActiveRole('Trainee');
    setActiveSection('Dashboard');
    navigate('home', '/homeRoute');
  };

  const handleRoleChange = (role: RoleName) => {
    setActiveRole(role);
    setActiveSection('Dashboard');
  };

  const visibleRoute = useMemo(() => {
    if (currentUser && route !== 'set-password') {
      return 'dashboard';
    }
    return route;
  }, [currentUser, route]);

  if (loading) {
    return <main className="loading-shell">Loading SkillForge...</main>;
  }

  if (visibleRoute === 'set-password') {
    return <SetPasswordForm onSuccess={() => navigate('login', '/login')} />;
  }

  if (visibleRoute === 'login') {
    return <LoginPage onBackHome={() => navigate('home', '/homeRoute')} onLogin={handleLogin} />;
  }

  if (!currentUser || visibleRoute === 'home') {
    return <HomePage onLoginClick={() => navigate('login', '/login')} />;
  }

  return (
    <AppLayout
      activeRole={activeRole}
      activeSection={activeSection}
      onLogout={handleLogout}
      onRoleChange={handleRoleChange}
      onSectionChange={setActiveSection}
      user={currentUser}
    >
      {/* ActiveSection state is fully captured here */}
      <DashboardPage
        accessToken={accessToken}
        activeRole={activeRole}
        activeSection={activeSection}
        currentUser={currentUser}
      />
    </AppLayout>
  );
}

export default App;