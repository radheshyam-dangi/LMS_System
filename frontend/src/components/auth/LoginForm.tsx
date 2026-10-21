import React, { useState } from 'react';
import { login } from '../../services/authService';
import type { LoginResponse } from '../../types/auth';
import { Mail, Lock, Eye, EyeOff, AlertCircle, LogIn, Loader2 } from 'lucide-react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

type LoginFormProps = {
  onLogin: (data: LoginResponse) => void;
};

export function LoginForm({ onLogin }: LoginFormProps) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (message) setMessage('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    if (!formData.email.trim() || !formData.password) {
      setMessage('Invalid email or password credentials.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await login(formData.email.trim(), formData.password);
      onLogin(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid email or password credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="login-form-element" onSubmit={handleSubmit} noValidate>
      {/* Error Alert */}
      {message && (
        <div className="login-error-alert" role="alert">
          <AlertCircle size={18} className="login-error-icon" />
          <span className="login-error-text">{message}</span>
        </div>
      )}

      {/* Email Address Field */}
      <div className="login-field-group">
        <Label htmlFor="login-email" className="login-input-label">
          Email address
        </Label>
        <div className="login-input-wrapper">
          <span className="login-field-icon-box" aria-hidden="true">
            <Mail size={18} className="login-field-icon" />
          </span>
          <Input
            id="login-email"
            name="email"
            type="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            disabled={submitting}
            autoComplete="email"
            required
            className="login-input-control"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="login-field-group">
        <Label htmlFor="login-password" className="login-input-label">
          Password
        </Label>
        <div className="login-input-wrapper password-wrapper">
          <span className="login-field-icon-box" aria-hidden="true">
            <Lock size={18} className="login-field-icon" />
          </span>
          <Input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            disabled={submitting}
            autoComplete="current-password"
            required
            className="login-input-control password-input"
          />
          <button
            type="button"
            className="login-password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Sign In Button */}
      <Button
        type="submit"
        className="login-submit-button"
        disabled={submitting || !formData.email.trim() || !formData.password}
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="login-spinner" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <span>Sign In</span>
            <LogIn size={18} />
          </>
        )}
      </Button>
    </form>
  );
}