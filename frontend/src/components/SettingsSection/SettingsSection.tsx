import React, { useState } from 'react';
import type { SessionUser, RoleName } from '../../types/auth';
import { userService } from '../../services/userService';

type SettingsSectionProps = {
  currentUser: SessionUser;
  activeRole: RoleName;
  accessToken?: string;
};

type Panel = 'home' | 'profile' | 'notifications' | 'integrations' | 'security' | 'billing' | 'api';

const tiles: { id: Panel; icon: string; title: string; desc: string }[] = [
  { id: 'profile', icon: '👤', title: 'Profile', desc: 'Update your name, avatar, timezone, and preferences.' },
  { id: 'notifications', icon: '🔔', title: 'Notifications', desc: 'Configure email and in-app notification preferences.' },
  { id: 'integrations', icon: '🔗', title: 'Integrations', desc: 'Connect GitHub, Slack, Jira, and other tools.' },
  { id: 'security', icon: '🔒', title: 'Security', desc: 'Manage passwords, 2FA, and active sessions.' },
  { id: 'billing', icon: '💳', title: 'Billing', desc: 'Manage your plan, usage, and invoices.' },
  { id: 'api', icon: '🔑', title: 'API Keys', desc: 'Generate and manage API access tokens.' },
];

export function SettingsSection({ currentUser, activeRole, accessToken }: SettingsSectionProps) {
  const [panel, setPanel] = useState<Panel>('home');
  const [firstName, setFirstName] = useState(currentUser.firstName || '');
  const [lastName, setLastName] = useState(currentUser.lastName || '');
  const [avatarUrl, setAvatarUrl] = useState((currentUser as any).avatarUrl || '');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (accessToken && currentUser.id) {
        await userService.updateUser(
          currentUser.id,
          { firstName, lastName, avatarUrl } as any,
          accessToken,
        );
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Settings</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
            Platform settings, notifications, integrations, and preferences.
          </p>
        </div>
        {panel === 'profile' && (
          <button
            type="submit"
            form="settings-profile-form"
            disabled={saving}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '20px', padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
          >
            {saving ? 'Saving...' : '+ Save Settings'}
          </button>
        )}
      </header>

      {savedSuccess && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
          ✓ Settings saved to database.
        </div>
      )}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {panel === 'home' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => setPanel(tile.id)}
              style={{
                textAlign: 'left',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '20px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '22px', marginBottom: '10px' }}>{tile.icon}</div>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{tile.title}</div>
              <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>{tile.desc}</div>
            </button>
          ))}
        </div>
      )}

      {panel !== 'home' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px' }}>
          <button
            type="button"
            onClick={() => setPanel('home')}
            style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', marginBottom: '16px', padding: 0 }}
          >
            ← Back to Settings
          </button>

          {panel === 'profile' && (
            <form id="settings-profile-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' }}>
              <h3 style={{ margin: 0 }}>Profile</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  First Name
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
                </label>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Last Name
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
                </label>
              </div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Email
                <input value={currentUser.email} disabled style={{ ...inputStyle, background: '#f8fafc' }} />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Avatar URL
                <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} style={inputStyle} />
              </label>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Active role: <strong style={{ color: '#4f46e5' }}>{activeRole}</strong></div>
              <button type="submit" disabled={saving} style={{ alignSelf: 'flex-start', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}>
                Save Profile
              </button>
            </form>
          )}

          {panel === 'notifications' && (
            <div>
              <h3>Notifications</h3>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                <input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} />
                Email me when evaluations and assignments update
              </label>
            </div>
          )}

          {(panel === 'integrations' || panel === 'security' || panel === 'billing' || panel === 'api') && (
            <div>
              <h3 style={{ textTransform: 'capitalize' }}>{panel}</h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>
                No {panel} configuration stored yet (0 connected). Profile changes are persisted via API; this section is ready for future integrations.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  boxSizing: 'border-box',
};
