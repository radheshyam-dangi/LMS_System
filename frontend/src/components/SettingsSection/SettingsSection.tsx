import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { SessionUser, RoleName } from '../../types/auth';
import { userService } from '../../services/userService';
import { useToast } from '../../context/ToastContext';
import {
  User,
  Bell,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Check,
  Clock,
  KeyRound
} from 'lucide-react';
import './SettingsSection.css';

type SettingsSectionProps = {
  currentUser: SessionUser;
  activeRole: RoleName;
  accessToken?: string;
};

type Panel = 'profile' | 'notifications' | 'security';

const getInitials = (firstName?: string, lastName?: string, email?: string): string => {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'SF';
};

export function SettingsSection({ currentUser, activeRole, accessToken }: SettingsSectionProps) {
  const toast = useToast();
  const [panel, setPanel] = useState<Panel>('profile');

  // --- Profile State ---
  const [firstName, setFirstName] = useState(currentUser.firstName || '');
  const [lastName, setLastName] = useState(currentUser.lastName || '');
  const [avatarUrl, setAvatarUrl] = useState((currentUser as any).avatarUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Notifications State (Stored in localStorage per user) ---
  const notifStorageKey = `skillforge_notif_prefs_${currentUser.id}`;
  const defaultNotifPrefs = useMemo(() => {
    return {
      // Trainee specific
      notifyEvaluated: true,
      notifyDeadline: true,
      notifyUnlocked: true,
      notifyFeedback: true,
      // Trainer specific
      notifySubmissions: true,
      notifyResubmissions: true,
      notifyCohortMilestone: true,
      notifyAnnouncements: true,
      // Admin specific
      notifyUserRegistrations: true,
      notifyCurriculumPublish: true,
      notifySystemAlerts: true,
      // Common channel
      emailDigest: true,
    };
  }, []);

  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem(notifStorageKey);
      if (saved) return { ...defaultNotifPrefs, ...JSON.parse(saved) };
    } catch {}
    return defaultNotifPrefs;
  });

  const [savingNotifs, setSavingNotifs] = useState(false);

  // --- Security State ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  // Password strength checklist logic
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);

  const calculateStrengthScore = () => {
    let score = 0;
    if (newPassword.length >= 6) score++;
    if (hasMinLength) score++;
    if (hasUpperCase) score++;
    if (hasNumber && hasSymbol) score++;
    return score; // 0 to 4
  };

  const strengthScore = calculateStrengthScore();
  const strengthLabels = ['Too Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#16a34a'];

  // Sync profile fields if currentUser changes
  useEffect(() => {
    setFirstName(currentUser.firstName || '');
    setLastName(currentUser.lastName || '');
    setAvatarUrl((currentUser as any).avatarUrl || '');
  }, [currentUser]);

  // Avatar Upload Handler
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Unsupported file format (use JPG, PNG, or WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setAvatarUrl(ev.target.result as string);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.warning('First name cannot be empty.');
      return;
    }

    setSavingProfile(true);
    try {
      if (accessToken && currentUser.id) {
        const updatedResponse = await userService.updateUser(
          currentUser.id,
          { firstName, lastName, avatarUrl } as any,
          accessToken
        );

        const newFirstName = updatedResponse.firstName || firstName;
        const newLastName = updatedResponse.lastName || lastName;
        const newAvatarUrl = updatedResponse.avatarUrl !== undefined ? updatedResponse.avatarUrl : avatarUrl;

        const updatedUser: SessionUser = {
          ...currentUser,
          firstName: newFirstName,
          lastName: newLastName,
          name: [newFirstName, newLastName].filter(Boolean).join(' ') || currentUser.email,
          avatarUrl: newAvatarUrl,
        };

        window.dispatchEvent(new CustomEvent('user_updated', { detail: updatedUser }));
      }
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save profile. Please retry.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Save Notifications Handler
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotifs(true);
    try {
      localStorage.setItem(notifStorageKey, JSON.stringify(notifPrefs));
      await new Promise((r) => setTimeout(r, 400));
      toast.success('Notification preferences updated successfully!');
    } catch {
      toast.error('Failed to store notification preferences.');
    } finally {
      setSavingNotifs(false);
    }
  };

  // Save Security (Change Password) Handler
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword.trim()) {
      toast.warning('Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      toast.warning('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      toast.warning('New password must be at least 6 characters.');
      return;
    }
    if (!confirmPassword.trim()) {
      toast.warning('Please confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning('New password and confirm password should be identical.');
      return;
    }

    setSavingSecurity(true);
    try {
      if (!currentUser?.id) {
        throw new Error('User session not found.');
      }
      await userService.changePassword(
        currentUser.id,
        { currentPassword, newPassword },
        accessToken
      );
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errMsg = err?.message || 'Current password verification failed.';
      toast.error(errMsg);
    } finally {
      setSavingSecurity(false);
    }
  };

  const initials = getInitials(firstName, lastName, currentUser.email);
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || currentUser.email;

  return (
    <div className="settings-container">
      {/* ── 1. PAGE HEADER ── */}
      <header className="settings-header-row">
        <div className="settings-header-left">
          <h1 className="settings-main-title">Account Settings</h1>
          <p className="settings-sub-heading">
            Manage your personal profile, notification triggers, login security, and workspace preferences.
          </p>
        </div>
      </header>

      {/* ── 2. LAYOUT: SIDEBAR + CONTENT ── */}
      <div className="settings-layout">
        {/* Navigation Sidebar */}
        <nav className="settings-sidebar" role="tablist" aria-label="Settings categories">
          <button
            role="tab"
            aria-selected={panel === 'profile'}
            onClick={() => setPanel('profile')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setPanel('profile');
            }}
            className={`settings-tab-btn ${panel === 'profile' ? 'is-active' : ''}`}
          >
            <span className="settings-tab-icon">
              <User size={16} />
            </span>
            <span>Profile & Account</span>
          </button>

          <button
            role="tab"
            aria-selected={panel === 'notifications'}
            onClick={() => setPanel('notifications')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setPanel('notifications');
            }}
            className={`settings-tab-btn ${panel === 'notifications' ? 'is-active' : ''}`}
          >
            <span className="settings-tab-icon">
              <Bell size={16} />
            </span>
            <span>Notifications</span>
          </button>

          <button
            role="tab"
            aria-selected={panel === 'security'}
            onClick={() => setPanel('security')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setPanel('security');
            }}
            className={`settings-tab-btn ${panel === 'security' ? 'is-active' : ''}`}
          >
            <span className="settings-tab-icon">
              <Lock size={16} />
            </span>
            <span>Login & Security</span>
          </button>

          {/* User Role Card at bottom of sidebar */}
          <div className="settings-sidebar-user-card">
            <div className="settings-sidebar-user-avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="settings-sidebar-user-info">
              <span className="settings-sidebar-user-name" title={fullName}>
                {fullName}
              </span>
              <span className="settings-sidebar-user-role">{activeRole}</span>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="settings-content-card">
          {/* ===================================================================
              PANEL 1: PROFILE SETTINGS
              =================================================================== */}
          {panel === 'profile' && (
            <>
              <div className="settings-panel-header">
                <h2 className="settings-section-title">Profile Information</h2>
                <p className="settings-section-desc">
                  Update your personal details and profile avatar.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                  {/* Avatar Upload Cluster */}
                  <div className="settings-avatar-cluster">
                    <div className="settings-avatar-preview-box">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={fullName} className="settings-avatar-img" />
                      ) : (
                        <div className="settings-avatar-initials-fallback">{initials}</div>
                      )}
                    </div>
                    <div className="settings-avatar-actions-col">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/jpeg, image/png, image/webp"
                        style={{ display: 'none' }}
                        onChange={handleAvatarChange}
                      />
                      <div className="settings-avatar-btns-row">
                        <button
                          type="button"
                          className="btn-upload-photo"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Camera size={14} />
                          <span>Change Photo</span>
                        </button>
                        {avatarUrl && (
                          <button
                            type="button"
                            className="btn-remove-photo"
                            onClick={handleRemoveAvatar}
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                      <span className="settings-avatar-hint">
                        Supported: JPG, PNG, or WEBP. Max size: 5MB.
                      </span>
                    </div>
                  </div>

                  {/* Name Fields */}
                  <div className="settings-form-grid-two">
                    <div className="settings-form-group">
                      <label htmlFor="st-first-name" className="settings-form-label">
                        First Name
                      </label>
                      <input
                        id="st-first-name"
                        type="text"
                        className="settings-form-input"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter first name"
                        required
                      />
                    </div>

                    <div className="settings-form-group">
                      <label htmlFor="st-last-name" className="settings-form-label">
                        Last Name
                      </label>
                      <input
                        id="st-last-name"
                        type="text"
                        className="settings-form-input"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  {/* Email Field (Disabled) */}
                  <div className="settings-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="st-email" className="settings-form-label">
                        Email Address
                      </label>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 7px', borderRadius: '4px' }}>
                        ✓ Verified Account
                      </span>
                    </div>
                    <input
                      id="st-email"
                      type="email"
                      className="settings-form-input"
                      value={currentUser.email}
                      disabled
                    />
                  </div>

                  {/* Action Button */}
                  <div className="settings-actions-footer">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="btn-settings-save-primary"
                    >
                      <span>{savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                    </button>
                  </div>
                </form>
            </>
          )}

          {/* ===================================================================
              PANEL 2: NOTIFICATIONS
              =================================================================== */}
          {panel === 'notifications' && (
            <>
              <div className="settings-panel-header">
                <h2 className="settings-section-title">Notification Preferences</h2>
                <p className="settings-section-desc">
                  Tailor event notifications and delivery channels for your {activeRole} workflow.
                </p>
              </div>

              <form onSubmit={handleSaveNotifications} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="settings-notifs-list">
                  {/* Role-Specific Toggles */}
                  {activeRole === 'Trainer' && (
                    <>
                      <div className="settings-notif-item">
                        <div className="settings-notif-text-col">
                          <span className="settings-notif-title">New Trainee Submissions</span>
                          <p className="settings-notif-desc">
                            Receive notifications as soon as a trainee submits coursework or assessments.
                          </p>
                        </div>
                        <label className="settings-switch-label">
                          <input
                            type="checkbox"
                            checked={notifPrefs.notifySubmissions}
                            onChange={(e) =>
                              setNotifPrefs((prev: any) => ({
                                ...prev,
                                notifySubmissions: e.target.checked,
                              }))
                            }
                          />
                          <span className="settings-switch-slider" />
                        </label>
                      </div>

                      <div className="settings-notif-item">
                        <div className="settings-notif-text-col">
                          <span className="settings-notif-title">Assignment Resubmissions</span>
                          <p className="settings-notif-desc">
                            Alerts when a student requests re-evaluation on previously rejected tasks.
                          </p>
                        </div>
                        <label className="settings-switch-label">
                          <input
                            type="checkbox"
                            checked={notifPrefs.notifyResubmissions}
                            onChange={(e) =>
                              setNotifPrefs((prev: any) => ({
                                ...prev,
                                notifyResubmissions: e.target.checked,
                              }))
                            }
                          />
                          <span className="settings-switch-slider" />
                        </label>
                      </div>

                      <div className="settings-notif-item">
                        <div className="settings-notif-text-col">
                          <span className="settings-notif-title">Cohort Milestone Completed</span>
                          <p className="settings-notif-desc">
                            Updates when enrolled trainees complete an entire curriculum track or module.
                          </p>
                        </div>
                        <label className="settings-switch-label">
                          <input
                            type="checkbox"
                            checked={notifPrefs.notifyCohortMilestone}
                            onChange={(e) =>
                              setNotifPrefs((prev: any) => ({
                                ...prev,
                                notifyCohortMilestone: e.target.checked,
                              }))
                            }
                          />
                          <span className="settings-switch-slider" />
                        </label>
                      </div>
                    </>
                  )}

                  {activeRole === 'Trainee' && (
                    <>
                      <div className="settings-notif-item">
                        <div className="settings-notif-text-col">
                          <span className="settings-notif-title">Assignment Evaluated & Graded</span>
                          <p className="settings-notif-desc">
                            Get immediate notifications when your trainer reviews, scores, or comments on your work.
                          </p>
                        </div>
                        <label className="settings-switch-label">
                          <input
                            type="checkbox"
                            checked={notifPrefs.notifyEvaluated}
                            onChange={(e) =>
                              setNotifPrefs((prev: any) => ({
                                ...prev,
                                notifyEvaluated: e.target.checked,
                              }))
                            }
                          />
                          <span className="settings-switch-slider" />
                        </label>
                      </div>

                      <div className="settings-notif-item">
                        <div className="settings-notif-text-col">
                          <span className="settings-notif-title">Approaching Deadlines</span>
                          <p className="settings-notif-desc">
                            Reminders 48 hours and 12 hours before a required assessment deadline expires.
                          </p>
                        </div>
                        <label className="settings-switch-label">
                          <input
                            type="checkbox"
                            checked={notifPrefs.notifyDeadline}
                            onChange={(e) =>
                              setNotifPrefs((prev: any) => ({
                                ...prev,
                                notifyDeadline: e.target.checked,
                              }))
                            }
                          />
                          <span className="settings-switch-slider" />
                        </label>
                      </div>

                      <div className="settings-notif-item">
                        <div className="settings-notif-text-col">
                          <span className="settings-notif-title">New Coursework Unlocked</span>
                          <p className="settings-notif-desc">
                            Alerts when prerequisites are met and new lessons or modules unlock.
                          </p>
                        </div>
                        <label className="settings-switch-label">
                          <input
                            type="checkbox"
                            checked={notifPrefs.notifyUnlocked}
                            onChange={(e) =>
                              setNotifPrefs((prev: any) => ({
                                ...prev,
                                notifyUnlocked: e.target.checked,
                              }))
                            }
                          />
                          <span className="settings-switch-slider" />
                        </label>
                      </div>
                    </>
                  )}

                  {activeRole === 'Admin' && (
                    <>
                      <div className="settings-notif-item">
                        <div className="settings-notif-text-col">
                          <span className="settings-notif-title">User Registration & Activation</span>
                          <p className="settings-notif-desc">
                            Notifications when new trainers or trainees activate their accounts.
                          </p>
                        </div>
                        <label className="settings-switch-label">
                          <input
                            type="checkbox"
                            checked={notifPrefs.notifyUserRegistrations}
                            onChange={(e) =>
                              setNotifPrefs((prev: any) => ({
                                ...prev,
                                notifyUserRegistrations: e.target.checked,
                              }))
                            }
                          />
                          <span className="settings-switch-slider" />
                        </label>
                      </div>

                      <div className="settings-notif-item">
                        <div className="settings-notif-text-col">
                          <span className="settings-notif-title">Curriculum Publication Notices</span>
                          <p className="settings-notif-desc">
                            Alerts when learning paths are published, modified, or archived by trainers.
                          </p>
                        </div>
                        <label className="settings-switch-label">
                          <input
                            type="checkbox"
                            checked={notifPrefs.notifyCurriculumPublish}
                            onChange={(e) =>
                              setNotifPrefs((prev: any) => ({
                                ...prev,
                                notifyCurriculumPublish: e.target.checked,
                              }))
                            }
                          />
                          <span className="settings-switch-slider" />
                        </label>
                      </div>
                    </>
                  )}

                  {/* Common Channel Toggle */}
                  <div className="settings-notif-item">
                    <div className="settings-notif-text-col">
                      <span className="settings-notif-title">Email Notification Digest</span>
                      <p className="settings-notif-desc">
                        Send daily activity summaries and critical updates directly to {currentUser.email}.
                      </p>
                    </div>
                    <label className="settings-switch-label">
                      <input
                        type="checkbox"
                        checked={notifPrefs.emailDigest}
                        onChange={(e) =>
                          setNotifPrefs((prev: any) => ({
                            ...prev,
                            emailDigest: e.target.checked,
                          }))
                        }
                      />
                      <span className="settings-switch-slider" />
                    </label>
                  </div>
                </div>

                <div className="settings-actions-footer">
                  <button
                    type="submit"
                    disabled={savingNotifs}
                    className="btn-settings-save-primary"
                  >
                    <span>{savingNotifs ? 'Updating Preferences...' : 'Save Notification Preferences'}</span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ===================================================================
              PANEL 3: SECURITY & PASSWORD
              =================================================================== */}
          {panel === 'security' && (
            <>
              <div className="settings-panel-header">
                <h2 className="settings-section-title">Login & Security</h2>
                <p className="settings-section-desc">
                  Update your authentication credentials and inspect active security sessions.
                </p>
              </div>

              {/* Active Session Info Card */}
              <div className="settings-session-card">
                <div className="settings-session-left">
                  <div className="settings-session-icon">
                    <Laptop size={18} />
                  </div>
                  <div className="settings-session-text">
                    <span className="settings-session-title">Current Active Session</span>
                    <span className="settings-session-meta">
                      Authenticated via HTTPS Web Browser · Role: {activeRole}
                    </span>
                  </div>
                </div>
                <span className="settings-session-active-pill">
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                  <span>Active Now</span>
                </span>
              </div>

              {/* Password Change Form */}
              <form onSubmit={handleSaveSecurity} style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '480px' }}>
                {/* Current Password */}
                <div className="settings-form-group">
                  <label htmlFor="st-current-pwd" className="settings-form-label">
                    Current Password
                  </label>
                  <div className="settings-form-input-wrapper">
                    <input
                      id="st-current-pwd"
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="settings-form-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                    />
                    <button
                      type="button"
                      className="settings-input-action-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="settings-form-group">
                  <label htmlFor="st-new-pwd" className="settings-form-label">
                    New Password
                  </label>
                  <div className="settings-form-input-wrapper">
                    <input
                      id="st-new-pwd"
                      type={showNewPassword ? 'text' : 'password'}
                      className="settings-form-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 6 characters)"
                      required
                    />
                    <button
                      type="button"
                      className="settings-input-action-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {newPassword.length > 0 && (
                    <div className="password-strength-container">
                      <div className="password-strength-bar">
                        <div
                          className="password-strength-fill"
                          style={{
                            width: `${Math.min(100, (strengthScore / 4) * 100)}%`,
                            backgroundColor: strengthColors[strengthScore],
                          }}
                        />
                      </div>
                      <div className="password-strength-label-row">
                        <span>Password Strength:</span>
                        <strong style={{ color: strengthColors[strengthScore] }}>
                          {strengthLabels[strengthScore]}
                        </strong>
                      </div>

                      {/* Password Requirements Checklist */}
                      <div className="password-rules-checklist">
                        <span className={`password-rule-item ${hasMinLength ? 'is-valid' : ''}`}>
                          {hasMinLength ? <Check size={12} /> : <span>•</span>}
                          <span>At least 8 characters</span>
                        </span>
                        <span className={`password-rule-item ${hasUpperCase ? 'is-valid' : ''}`}>
                          {hasUpperCase ? <Check size={12} /> : <span>•</span>}
                          <span>Uppercase letter (A-Z)</span>
                        </span>
                        <span className={`password-rule-item ${hasNumber ? 'is-valid' : ''}`}>
                          {hasNumber ? <Check size={12} /> : <span>•</span>}
                          <span>Number (0-9)</span>
                        </span>
                        <span className={`password-rule-item ${hasSymbol ? 'is-valid' : ''}`}>
                          {hasSymbol ? <Check size={12} /> : <span>•</span>}
                          <span>Special symbol (!@#$)</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="settings-form-group">
                  <label htmlFor="st-confirm-pwd" className="settings-form-label">
                    Confirm New Password
                  </label>
                  <div className="settings-form-input-wrapper">
                    <input
                      id="st-confirm-pwd"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="settings-form-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                    />
                    <button
                      type="button"
                      className="settings-input-action-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <span style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 600 }}>
                      Passwords do not match.
                    </span>
                  )}
                </div>

                <div className="settings-actions-footer">
                  <button
                    type="submit"
                    disabled={savingSecurity || (!!confirmPassword && newPassword !== confirmPassword)}
                    className="btn-settings-save-primary"
                  >
                    <KeyRound size={14} />
                    <span>{savingSecurity ? 'Updating Credentials...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
