import React from 'react';
import './HomePage.css'; // Make sure to add the accompanying styles below

type HomePageProps = {
  onLoginClick: () => void;
};

export function HomePage({ onLoginClick }: HomePageProps) {
  return (
    <div className="home-page-container">
      {/* Premium Sticky Navigation Strip */}
      <nav className="home-navbar">
        <div className="nav-logo">
          <span className="logo-spark">⚡</span>
          <strong>SkillForge</strong>
          <span className="logo-badge">AI Platform</span>
        </div>
        <div className="nav-actions">
          <button className="nav-ghost-btn" type="button" onClick={onLoginClick}>Features</button>
          <button className="nav-ghost-btn" type="button" onClick={onLoginClick}>Docs</button>
          <button className="nav-primary-btn" type="button" onClick={onLoginClick}>
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section Split Layout */}
      <main className="home-main-hero">
        <section className="hero-content-left">
          <div className="eyebrow-pill">
            <span className="pill-dot" />
            <span>Now with AI-Powered Cohort Tracking</span>
          </div>
          <h1 className="hero-main-title">
            Engineering learning management for <span className="gradient-text">role-based</span> training teams.
          </h1>
          <p className="hero-description-text">
            SkillForge helps administrators invite users, assign dynamic tracks, and give every trainee, 
            trainer, and admin a focused workspace for structural code evaluation, metrics, and growth tracking.
          </p>
          <div className="hero-action-cluster">
            <button className="hero-primary-btn" type="button" onClick={onLoginClick}>
              Launch Dashboard →
            </button>
            <button className="hero-secondary-btn" type="button" onClick={onLoginClick}>
              Request Enterprise Demo
            </button>
          </div>
        </section>

        {/* High Fidelity Interactive UI Mockup Card Frame */}
        <section className="hero-graphics-right">
          <div className="mockup-window-frame">
            <div className="mockup-header-dots">
              <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
              <span className="mockup-url-bar">skillforge.ai/dashboard/learning-paths</span>
            </div>
            <div className="mockup-body-preview">
              <div className="mockup-sidebar" />
              <div className="mockup-main-content">
                <div className="mockup-metrics-row">
                  <div className="mockup-mini-card" />
                  <div className="mockup-mini-card" />
                  <div className="mockup-mini-card" />
                </div>
                <div className="mockup-chart-skeleton" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bento Grid Feature Matrix Layout Block Section */}
      <section className="home-features-bento-grid">
        <div className="bento-card bento-wide">
          <span className="bento-icon">🛡️</span>
          <h3>Strict Role Isolation Matrices</h3>
          <p>Separate dashboard experiences for Admins, Trainers, and Trainees instantly compiled dynamically on authentication hooks.</p>
        </div>
        <div className="bento-card">
          <span className="bento-icon">📊</span>
          <h3>Fidelity Trend Analytics</h3>
          <p>Track submissions, progress bars, and historical metrics evaluation charts natively.</p>
        </div>
        <div className="bento-card">
          <span className="bento-icon">🛤️</span>
          <h3>Dynamic Learning Paths</h3>
          <p>Assign specialized tracks built explicitly from backend entity columns maps directly down to cohorts.</p>
        </div>
      </section>
    </div>
  );
}