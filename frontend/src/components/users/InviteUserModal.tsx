import { useMemo, useState } from 'react';
import { sendInvitation } from '../../services/authService';
import type { RoleName } from '../../types/auth';
import './InviteUserModal.css';

type InviteUserModalProps = {
  accessToken: string;
  currentUser: any;
  onClose: () => void;
  onInvited: (user: {
    email: string;
    firstName: string;
    lastName: string;
    roles: RoleName[];
    primaryRole: RoleName;
  }) => void;
};

const selectableRoles: RoleName[] = ['Trainee', 'Trainer', 'Admin'];

const roleCopy: Record<RoleName, string> = {
  Trainee: 'Learns paths',
  Trainer: 'Builds & guides',
  Admin: 'Runs the platform',
};

export function InviteUserModal({ accessToken, currentUser, onClose, onInvited }: InviteUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    subject: 'Invitation to SkillForge',
  });
  const [roles, setRoles] = useState<RoleName[]>(['Trainee']);
  const [primaryRole, setPrimaryRole] = useState<RoleName>('Trainee');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availablePrimaryRoles = useMemo(() => roles, [roles]);

  const updateField = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const toggleRole = (role: RoleName) => {
    setRoles((current) => {
      const next = current.includes(role)
        ? current.filter((currentRole) => currentRole !== role)
        : [...current, role];

      // FIX 1: Cast the fallback array strictly as RoleName[]
      const safeNext = (next.length > 0 ? next : ['Trainee']) as RoleName[];

      if (!safeNext.includes(primaryRole)) {
        setPrimaryRole(safeNext[0]);
      }

      return safeNext;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      // FIX 2: Cast the payload object to "any" temporarily if you haven't
      // updated your backend types/auth.ts file yet to accept sender details.
      await sendInvitation(
        {
          to: formData.email,
          subject: formData.subject,
          firstName: formData.firstName,
          lastName: formData.lastName,
          roles,
          isPrimary: primaryRole,
          senderName: `${currentUser?.firstName ?? 'Admin'} ${currentUser?.lastName ?? 'User'}`,
          senderEmail: currentUser?.email ?? '',
        } as any,
        accessToken,
      );
      onInvited({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        roles,
        primaryRole,
      });
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sf-invite-backdrop" role="presentation" onClick={onClose}>
      <section
        className="sf-invite-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sf-invite-header">
          <div>
            <p className="sf-invite-eyebrow">Admin access · new member</p>
            <h2 className="sf-invite-title" id="invite-title">Add to SkillForge</h2>
          </div>
          <button className="sf-invite-close" type="button" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <form className="sf-invite-form" onSubmit={handleSubmit}>
          <div className="sf-form-row">
            <label className="sf-field">
              <span className="sf-field-label">First name</span>
              <input name="firstName" value={formData.firstName} onChange={updateField} placeholder="Jane" required />
            </label>
            <label className="sf-field">
              <span className="sf-field-label">Last name</span>
              <input name="lastName" value={formData.lastName} onChange={updateField} placeholder="Doe" required />
            </label>
          </div>

          <label className="sf-field">
            <span className="sf-field-label">Email</span>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={updateField}
              placeholder="jane.doe@example.com"
              required
            />
          </label>

          <label className="sf-field">
            <span className="sf-field-label">Invitation subject</span>
            <input name="subject" value={formData.subject} onChange={updateField} required />
          </label>

          <div className="sf-gauge-block">
            <div className="sf-gauge-heading">
              <span className="sf-field-label">Access level</span>
              <span className="sf-gauge-hint">tap to mark primary</span>
            </div>

            <div className="sf-temper-gauge">
              {selectableRoles.map((role) => {
                const isSelected = roles.includes(role);
                const isPrimary = primaryRole === role;
                return (
                  <div
                    key={role}
                    data-role={role}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    className={`sf-temper-cell${isSelected ? ' is-selected' : ''}${isPrimary ? ' is-primary' : ''}`}
                    onClick={() => toggleRole(role)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleRole(role);
                      }
                    }}
                  >
                    <div className="sf-temper-fill" />
                    <div className="sf-temper-label-row">
                      <span className="sf-temper-name">
                        {role} <span className="sf-temper-flame" aria-hidden="true">●</span>
                      </span>
                      <span className="sf-temper-check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
                    </div>
                    <span className="sf-field-label" style={{ fontSize: 11.5, fontWeight: 500 }}>
                      {roleCopy[role]}
                    </span>
                    <button
                      type="button"
                      className="sf-temper-make-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isSelected) setPrimaryRole(role);
                      }}
                    >
                      {isPrimary ? 'Primary role' : 'Set as primary'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {message && <p className="sf-form-message is-error">{message}</p>}

          <div className="sf-invite-actions">
            <button className="sf-btn sf-btn-ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="sf-btn sf-btn-primary"
              type="submit"
              disabled={submitting || !formData.firstName || !formData.lastName || !formData.email}
            >
              {submitting ? 'Sending…' : 'Send invitation'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}