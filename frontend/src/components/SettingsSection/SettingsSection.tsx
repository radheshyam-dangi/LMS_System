import React, { useState, useEffect, useRef } from 'react';
import type { SessionUser, RoleName } from '../../types/auth';
import { userService } from '../../services/userService';
import { useToast } from '../../context/ToastContext';
import './SettingsSection.css';

type SettingsSectionProps = {
  currentUser: SessionUser;
  activeRole: RoleName;
  accessToken?: string;
};

type Panel = 'profile' | 'notifications' | 'security';

export function SettingsSection({ currentUser, activeRole, accessToken }: SettingsSectionProps) {
  const toast = useToast();
  const [panel, setPanel] = useState<Panel>('profile');

  // --- Profile State ---
  const [firstName, setFirstName] = useState(currentUser.firstName || '');
  const [lastName, setLastName] = useState(currentUser.lastName || '');
  const [avatarUrl, setAvatarUrl] = useState((currentUser as any).avatarUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Notifications State ---
  const [notifyEvaluated, setNotifyEvaluated] = useState(true);
  const [notifyDeadline, setNotifyDeadline] = useState(true);
  const [notifyUnlocked, setNotifyUnlocked] = useState(true);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [notifsSuccess, setNotifsSuccess] = useState(false);

  // --- Security State ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState(false);
  const [securityError, setSecurityError] = useState('');

  // Password strength logic
  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length > 7) score++;
    if (pwd.length > 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return Math.min(4, score);
  };
  const pwdStrength = calculateStrength(newPassword);

  useEffect(() => {
    setFirstName(currentUser.firstName || '');
    setLastName(currentUser.lastName || '');
    setAvatarUrl((currentUser as any).avatarUrl || '');
  }, [currentUser]);

  // Avatar Upload Handler
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Image must be smaller than 5MB');
      return;
    }

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileError('Unsupported file format (use JPG, PNG, WEBP)');
      return;
    }

    setProfileError('');
    // Client-side resize simulation (FileReader)
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setAvatarUrl(ev.target.result as string);
        // Ideally this would upload to a CDN, for now it sets data URI
      }
    };
    reader.onerror = () => {
      setProfileError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setSavingProfile(true);
    try {
      if (accessToken && currentUser.id) {
        const updatedResponse = await userService.updateUser(
          currentUser.id,
          { firstName, lastName, avatarUrl } as any,
          accessToken,
        );
        
        const newFirstName = updatedResponse.firstName || firstName;
        const newLastName = updatedResponse.lastName || lastName;
        const newAvatarUrl = updatedResponse.avatarUrl || avatarUrl;
        
        const updatedUser = {
           ...currentUser,
           firstName: newFirstName,
           lastName: newLastName,
           name: [newFirstName, newLastName].filter(Boolean).join(' ') || currentUser.email,
           avatarUrl: newAvatarUrl
        };
        
        window.dispatchEvent(new CustomEvent('user_updated', { detail: updatedUser }));
      }
      toast.success('Profile updated successfully!');
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to save profile. Please retry.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotifs(true);
    // Simulate API call to save preferences
    await new Promise(r => setTimeout(r, 600));
    setSavingNotifs(false);
    toast.success('Notification preferences updated!');
    setNotifsSuccess(true);
    setTimeout(() => setNotifsSuccess(false), 3000);
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError('');
    
    if (newPassword !== confirmPassword) {
      setSecurityError('New passwords do not match');
      return;
    }
    if (pwdStrength < 3) {
      setSecurityError('Password is too weak');
      return;
    }

    setSavingSecurity(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 800));
    setSavingSecurity(false);
    toast.success('Password updated successfully!');
    setSecuritySuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setSecuritySuccess(false), 3000);
  };

  return (
    <div className="db-container">
      <header className="db-header workspace-heading">
        <h1 className="db-header-title">Settings</h1>
        <p className="db-header-subtitle">
          Manage your account preferences, security, and notifications.
        </p>
      </header>

      <div className="settings-layout">
        <div className="settings-sidebar" role="tablist" aria-label="Settings Navigation">
          <button 
            role="tab" 
            aria-selected={panel === 'profile'} 
            onClick={() => setPanel('profile')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setPanel('profile');
              else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
              else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') (e.currentTarget.parentElement?.lastElementChild as HTMLElement)?.focus();
            }}
            onFocus={() => setPanel('profile')}
            tabIndex={panel === 'profile' ? 0 : -1}
            className="settings-tab"
          >
            <span className="settings-tab-icon">👤</span> Profile
          </button>
          <button 
            role="tab" 
            aria-selected={panel === 'notifications'} 
            onClick={() => setPanel('notifications')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setPanel('notifications');
              else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
              else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') (e.currentTarget.previousElementSibling as HTMLElement)?.focus();
            }}
            onFocus={() => setPanel('notifications')}
            tabIndex={panel === 'notifications' ? 0 : -1}
            className="settings-tab"
          >
            <span className="settings-tab-icon">🔔</span> Notifications
          </button>
          <button 
            role="tab" 
            aria-selected={panel === 'security'} 
            onClick={() => setPanel('security')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setPanel('security');
              else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') (e.currentTarget.parentElement?.firstElementChild as HTMLElement)?.focus();
              else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') (e.currentTarget.previousElementSibling as HTMLElement)?.focus();
            }}
            onFocus={() => setPanel('security')}
            tabIndex={panel === 'security' ? 0 : -1}
            className="settings-tab"
          >
            <span className="settings-tab-icon">🔒</span> Security
          </button>
        </div>

        <div className="settings-content">
          {panel === 'profile' && (
            <form onSubmit={handleSaveProfile}>
              <h2 className="settings-section-title">Profile Settings</h2>
              <p className="settings-section-desc">Update your personal details and avatar.</p>

              {profileSuccess && (
                <div className="settings-success-toast">
                  <span role="img" aria-label="success">✓</span> Profile updated successfully.
                </div>
              )}
              {profileError && (
                <div className="settings-success-toast" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                  <span role="img" aria-label="error">⚠️</span> {profileError}
                </div>
              )}

              <div className="settings-form-group" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '32px' }}>👤</span>
                  )}
                </div>
                <div>
                  <input type="file" ref={fileInputRef} accept="image/jpeg, image/png, image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#334155' }}>
                    Upload New Photo
                  </button>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>JPG, PNG or WEBP. Max 5MB.</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="settings-form-group">
                  <label htmlFor="firstName" className="settings-form-label">First Name</label>
                  <input id="firstName" className="settings-form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="settings-form-group">
                  <label htmlFor="lastName" className="settings-form-label">Last Name</label>
                  <input id="lastName" className="settings-form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>

              <div className="settings-form-group">
                <label htmlFor="email" className="settings-form-label">Email Address</label>
                <input id="email" className="settings-form-input" value={currentUser.email} disabled />
              </div>

              <button type="submit" disabled={savingProfile} className="settings-btn-save">
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          )}

          {panel === 'notifications' && (
            <form onSubmit={handleSaveNotifications}>
              <h2 className="settings-section-title">Notification Preferences</h2>
              <p className="settings-section-desc">Choose what updates you want to receive.</p>

              {notifsSuccess && (
                <div className="settings-success-toast">
                  <span role="img" aria-label="success">✓</span> Notification preferences updated.
                </div>
              )}

              <div className="settings-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '500px' }}>
                <label className="settings-toggle-label">
                  <input type="checkbox" className="settings-toggle" checked={notifyEvaluated} onChange={(e) => setNotifyEvaluated(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>Assignment Evaluated</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>Get notified when your trainer reviews your submission.</div>
                  </div>
                </label>

                <label className="settings-toggle-label">
                  <input type="checkbox" className="settings-toggle" checked={notifyDeadline} onChange={(e) => setNotifyDeadline(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>Deadline Approaching</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>Reminders 48 hours before an assignment is due.</div>
                  </div>
                </label>

                <label className="settings-toggle-label">
                  <input type="checkbox" className="settings-toggle" checked={notifyUnlocked} onChange={(e) => setNotifyUnlocked(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>New Content Unlocked</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>Alerts when you unlock new modules or lessons.</div>
                  </div>
                </label>
              </div>

              <button type="submit" disabled={savingNotifs} className="settings-btn-save" style={{ marginTop: '16px' }}>
                {savingNotifs ? 'Saving...' : 'Save Notifications'}
              </button>
            </form>
          )}

          {panel === 'security' && (
            <form onSubmit={handleSaveSecurity} style={{ maxWidth: '400px' }}>
              <h2 className="settings-section-title">Security</h2>
              <p className="settings-section-desc">Update your password to keep your account secure.</p>

              {securitySuccess && (
                <div className="settings-success-toast">
                  <span role="img" aria-label="success">✓</span> Password updated successfully.
                </div>
              )}
              {securityError && (
                <div className="settings-success-toast" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                  <span role="img" aria-label="error">⚠️</span> {securityError}
                </div>
              )}

              <div className="settings-form-group">
                <label htmlFor="currentPwd" className="settings-form-label">Current Password</label>
                <input id="currentPwd" type="password" className="settings-form-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>

              <div className="settings-form-group">
                <label htmlFor="newPwd" className="settings-form-label">New Password</label>
                <input id="newPwd" type="password" className="settings-form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                {newPassword.length > 0 && (
                  <div className="password-strength-bar">
                    <div className="password-strength-fill" style={{ 
                      width: `${(pwdStrength / 4) * 100}%`,
                      backgroundColor: pwdStrength < 2 ? '#ef4444' : pwdStrength === 2 ? '#f59e0b' : '#10b981'
                    }} />
                  </div>
                )}
              </div>

              <div className="settings-form-group">
                <label htmlFor="confirmPwd" className="settings-form-label">Confirm New Password</label>
                <input id="confirmPwd" type="password" className="settings-form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                {confirmPassword && newPassword !== confirmPassword && (
                  <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px' }}>Passwords do not match</div>
                )}
              </div>

              <button type="submit" disabled={savingSecurity} className="settings-btn-save">
                {savingSecurity ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
