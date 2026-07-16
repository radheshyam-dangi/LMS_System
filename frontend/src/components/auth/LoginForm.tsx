import React, { useState } from 'react';
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
      {/* Alert Error Message Box banner */}
      {message && (
        <div className="auth-error-banner" role="alert">
          <span className="error-icon">⚠️</span>
          <p className="error-text">{message}</p>
        </div>
      )}

      {/* Email Input Field Container Stack */}
      <div className="auth-input-group">
        <label htmlFor="login-email">Email Address</label>
        <div className="input-with-icon-wrapper">
          <span className="field-icon">✉️</span>
          <input
            id="login-email"
            name="email"
            type="email"
            className="auth-text-input"
            placeholder="name@company.com"
            value={formData.email}
            onChange={handleChange}
            disabled={submitting}
            required
          />
        </div>
      </div>

      {/* Password Input Field Container Stack */}
      <div className="auth-input-group">
        <div className="label-row-meta">
          <label htmlFor="login-password">Password</label>
        </div>
        <div className="input-with-icon-wrapper">
          <span className="field-icon">🔒</span>
          <input
            id="login-password"
            name="password"
            type="password"
            className="auth-text-input"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            disabled={submitting}
            required
          />
        </div>
      </div>

      {/* Primary Action Button */}
      <button 
        className={`primary-button auth-submit-btn ${submitting ? 'btn-loading' : ''}`} 
        type="submit" 
        disabled={submitting}
      >
        {submitting ? (
          <span className="loading-spinner-flex">
            <span className="spinner-dot" />
            Signing in...
          </span>
        ) : (
          'Sign In to Dashboard'
        )}
      </button>
    </form>
  );
}