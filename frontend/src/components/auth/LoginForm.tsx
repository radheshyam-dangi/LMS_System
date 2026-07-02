import { useState } from 'react';
import { login } from '../../services/authService';
import type { LoginResponse } from '../../types/auth';

type LoginFormProps = {
  onLogin: (data: LoginResponse) => void;
};

export function LoginForm({ onLogin }: LoginFormProps) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);

    try {
      const result = await login(formData.email, formData.password);
      onLogin(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input name="email" type="email" value={formData.email} onChange={handleChange} required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
        />
      </label>
      <button className="primary-button" type="submit" disabled={submitting}>
        {submitting ? 'Signing in...' : 'Login'}
      </button>
      {message && <p className="form-message error">{message}</p>}
    </form>
  );
}
