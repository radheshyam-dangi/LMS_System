import { useEffect, useMemo, useState } from 'react';
import Login from './components/Login';
import SignUp from './components/Signup';
import { SetPassword } from './components/SetPassword';
import { API_BASE_URL } from './api';
import './App.css';

type UserRole = { id: string; name: string };

type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: UserRole[];
  primaryRole?: string; // Track primary role directly
};

// Helper utility to decode a JWT payload right in the browser
const decodeJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests'>('dashboard');
  const [requests, setRequests] = useState<User[]>([]);
  const [requestMessage, setRequestMessage] = useState('');
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Check localStorage immediately when application boots up
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      const decoded = decodeJwt(savedToken);
      // Validate expiration date if exp exists in token payload
      if (decoded && decoded.exp * 1000 > Date.now()) {
        setCurrentUser({
          id: decoded.id,
          email: decoded.email,
          firstName: decoded.firstName,
          lastName: decoded.lastName,
          primaryRole: decoded.primaryRole,
        });
      } else {
        localStorage.removeItem('token'); // Clear expired token safely
      }
    }
    setLoading(false);
  }, []);

  const primaryRole = useMemo(() => {
    return currentUser?.primaryRole || 'Trainee';
  }, [currentUser]);

  const isAdmin = primaryRole === 'Admin';

  useEffect(() => {
    if (!currentUser) return;
    if (!isAdmin) {
      setActiveTab('dashboard');
      return;
    }
    loadRoleRequests();
  }, [isAdmin, currentUser]);

  const loadRoleRequests = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/users/requests/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    setRequests(result);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
  };

  const updateRole = async (userId: string, roleName: 'Admin' | 'Trainer') => {
    setRequestMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ roleName }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to update role');

      setRequestMessage(`Role updated to ${roleName}.`);
      await loadRoleRequests();
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : 'Unable to update role');
    }
  };

  // Skip rendering content while resolving token extraction states
  if (loading) {
    return <div className="loading-shell">Loading Application Profile...</div>;
  }

  // Intercept URL invitation setups early
  if (new URLSearchParams(window.location.search).has('token')) {
    return (
      <SetPassword
        onSuccess={() => {
          setAuthMode('login');
          window.location.href = window.location.pathname; // Clean redirect
        }}
      />
    );
  }

  if (!currentUser) {
    return (
      <main className="app-shell">
        <section className="auth-panel">
          <div>
            <h1>Learning Management</h1>
            <p>Welcome! Authenticate to access your learning platform space.</p>
          </div>
          <div className="tabs">
            <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>
              Sign up
            </button>
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>
              Login
            </button>
          </div>
          {authMode === 'signup' ? (
            <SignUp onSignup={setCurrentUser} />
          ) : (
            <Login
              onLogin={(userData) => {
                // 1. Immediately cache the string token into the local browser sandbox
                localStorage.setItem('token', userData.accessToken);

                // 2. Hydrate state instantly without querying the DB
                setCurrentUser({
                  id: userData.user.id,
                  email: userData.user.email,
                  firstName: userData.user.firstName,
                  lastName: userData.user.lastName,
                  primaryRole: userData.user.primaryRole?.name || 'Trainee'
                });
              }}
            />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          {/* Welcome User Text Display Upgraded */}
          <strong>Welcome, {currentUser.firstName || currentUser.email}!</strong>
          <span className="role-badge">{primaryRole}</span>
        </div>
        <button onClick={handleLogout}>Logout</button>
      </header>

      <nav className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          Dashboard
        </button>
        {isAdmin && (
          <button className={activeTab === 'requests' ? 'active' : ''} onClick={() => setActiveTab('requests')}>
            Requests
          </button>
        )}
      </nav>

      {activeTab === 'dashboard' && (
        <section className="content-panel">
          <h1>{primaryRole} Dashboard</h1>
          <p>You are logged in as {currentUser.email}. Your workspace configuration is fully optimized.</p>
        </section>
      )}

      {activeTab === 'requests' && isAdmin && (
        <section className="content-panel">
          <h1>Role Requests</h1>
          {requestMessage && <p className="form-message">{requestMessage}</p>}
          {requests.length === 0 ? (
            <p>No trainee requests are waiting.</p>
          ) : (
            <div className="request-list">
              {requests.map((user) => (
                <article className="request-row" key={user.id}>
                  <div>
                    <strong>{user.firstName || user.email}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className="request-actions">
                    <button onClick={() => updateRole(user.id, 'Trainer')}>Make Trainer</button>
                    <button onClick={() => updateRole(user.id, 'Admin')}>Make Admin</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;