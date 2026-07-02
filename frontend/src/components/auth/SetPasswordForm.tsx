import { useEffect, useState } from 'react';
import { completeSignup } from '../../services/authService';

type SetPasswordFormProps = {
  onSuccess: () => void;
};

export function SetPasswordForm({ onSuccess }: SetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | null }>({
    text: '',
    type: null,
  });

  useEffect(() => {
    const tokenParam = new URLSearchParams(window.location.search).get('token');
    if (tokenParam) {
      setToken(tokenParam);
      return;
    }

    setMessage({ text: 'Invalid or missing invitation token.', type: 'error' });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage({ text: '', type: null });

    if (newPassword !== retypePassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    if (!token) {
      setMessage({ text: 'Cannot activate account without an invitation token.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await completeSignup(token, newPassword, retypePassword);
      setMessage({ text: 'Password saved. Your account is activated.', type: 'success' });
      window.setTimeout(onSuccess, 1200);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to activate account.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="centered-page">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Invitation accepted</p>
          <h1>Create your password</h1>
          <p>Set your password to activate your profile and open your assigned workspace.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              disabled={!token || loading}
            />
          </label>
          <label>
            Retype password
            <input
              type="password"
              value={retypePassword}
              onChange={(event) => setRetypePassword(event.target.value)}
              required
              disabled={!token || loading}
            />
          </label>
          <button className="primary-button" type="submit" disabled={!token || loading}>
            {loading ? 'Activating...' : 'Activate account'}
          </button>
          {message.type && <p className={`form-message ${message.type}`}>{message.text}</p>}
        </form>
      </section>
    </main>
  );
}
