import React from 'react';
import { LoginForm } from './LoginForm';
import type { LoginResponse } from '../../types/auth';
import './LoginPage.css';

type LoginPageProps = {
  onBackHome: () => void;
  onLogin: (data: LoginResponse) => void;
};

export function LoginPage({ onBackHome, onLogin }: LoginPageProps) {
  return (
    <div className="login-modal-backdrop">
      {/* Background Decorative Tech Grids */}
      <div className="bg-glow-orb-1" />
      <div className="bg-glow-orb-2" />

      {/* Floating Centered Intuitive Modal Card Container */}
      <main className="login-modal-container">
        
        {/* Upper Navigation Row */}
        <header className="modal-nav-header">
          <div className="auth-app-logo">
            <span className="logo-spark">⚡</span>
            <strong>SkillForge</strong>
          </div>
          <button className="modal-back-btn" type="button" onClick={onBackHome}>
            Cancel ×
          </button>
        </header>

        {/* Auth Details / Header Content */}
        <div className="modal-auth-body">
          <div className="auth-title-group">
            <p className="auth-eyebrow">Welcome Back</p>
            <h1 className="auth-main-title">Sign in to Account</h1>
            <p className="auth-subtitle">
              Enter your credentials to access your secure role-based engineering workspace.
            </p>
          </div>

          {/* Core Login Form Inputs */}
          <div className="auth-form-wrapper">
            <LoginForm onLogin={onLogin} />
          </div>
        </div>

        {/* Security / System Footer */}
        <footer className="modal-auth-footer">
          <p className="security-notice-text">
            🛡️ Enterprise Session Security Verification Enabled
          </p>
        </footer>

      </main>
    </div>
  );
}