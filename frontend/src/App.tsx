import { useEffect, useMemo, useState } from 'react';
import Login from './components/Login';
import SignUp from './components/Signup';
import { API_BASE_URL } from './api';
import './App.css';

type UserRole = {
  id: string;
  name: string;
};

type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: UserRole[];
};

const getPrimaryRole = (user: User | null) => user?.roles?.[0]?.name ?? 'Trainee';

function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests'>('dashboard');
  const [requests, setRequests] = useState<User[]>([]);
  const [requestMessage, setRequestMessage] = useState('');

  const primaryRole = useMemo(() => getPrimaryRole(currentUser), [currentUser]);
  const isAdmin = primaryRole === 'Admin';

  useEffect(() => {
    if (!isAdmin) {
      setActiveTab('dashboard');
      return;
    }

    loadRoleRequests();
  }, [isAdmin]);

  const loadRoleRequests = async () => {
    const response = await fetch(`${API_BASE_URL}/users/requests/roles`);
    const result = await response.json();
    setRequests(result);
  };

  const updateRole = async (userId: string, roleName: 'Admin' | 'Trainer') => {
    setRequestMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Unable to update role');
      }

      setRequestMessage(`Role updated to ${roleName}.`);
      await loadRoleRequests();
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : 'Unable to update role');
    }
  };

  if (!currentUser) {
    return (
      <main className="app-shell">
        <section className="auth-panel">
          <div>
            <h1>Learning Management</h1>
            <p>Create the first admin account, or log in to continue.</p>
          </div>
          <div className="tabs">
            <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>
              Sign up
            </button>
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>
              Login
            </button>
          </div>
          {authMode === 'signup' ? <SignUp onSignup={setCurrentUser} /> : <Login onLogin={setCurrentUser} />}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <strong>{currentUser.firstName || currentUser.email}</strong>
          <span>{primaryRole}</span>
        </div>
        <button onClick={() => setCurrentUser(null)}>Logout</button>
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
          <p>You are logged in as {currentUser.email}.</p>
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
