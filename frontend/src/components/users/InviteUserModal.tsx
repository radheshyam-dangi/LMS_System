import { useMemo, useState } from 'react';
import { sendInvitation } from '../../services/authService';
import type { RoleName } from '../../types/auth';

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

const selectableRoles: RoleName[] = ['Admin', 'Trainer', 'Trainee'];

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
      
      //  FIX 1: Cast the fallback array strictly as RoleName[]
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
      //  FIX 2: Cast the payload object to "any" temporarily if you haven't 
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
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Admin action</p>
            <h2 id="invite-title">Add user</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close modal">
            x
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              First name
              <input name="firstName" value={formData.firstName} onChange={updateField} required />
            </label>
            <label>
              Last name
              <input name="lastName" value={formData.lastName} onChange={updateField} required />
            </label>
          </div>
          <label>
            Email
            <input name="email" type="email" value={formData.email} onChange={updateField} required />
          </label>
          <label>
            Subject
            <input name="subject" value={formData.subject} onChange={updateField} required />
          </label>

          <div className="field-group">
            <span>Roles</span>
            <div className="role-options">
              {selectableRoles.map((role) => (
                <label key={role}>
                  <input
                    checked={roles.includes(role)}
                    type="checkbox"
                    onChange={() => toggleRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>

          <label>
            Primary role
            {/* FIX 3: Value explicitly cast as RoleName */}
            <select value={primaryRole} onChange={(event) => setPrimaryRole(event.target.value as RoleName)}>
              {availablePrimaryRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          {message && <p className="form-message error">{message}</p>}

          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send invitation'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}