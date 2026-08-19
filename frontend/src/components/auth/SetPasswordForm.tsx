import { useEffect, useState } from 'react';
import { completeSignup } from '../../services/authService';
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';

type SetPasswordFormProps = {
  onSuccess: () => void;
};

export function SetPasswordForm({ onSuccess }: SetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | null }>({
    text: '',
    type: null,
  });

  useEffect(() => {
    const tokenParam = new URLSearchParams(window.location.search).get('token');
    if (tokenParam) {
      setToken(tokenParam);
      return;
    }

    setMessage({ text: 'Invalid or missing invitation token.', type: 'error' });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage({ text: '', type: null });

    if (newPassword !== retypePassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    if (!token) {
      setMessage({ text: 'Cannot activate account without an invitation token.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await completeSignup(token, newPassword, retypePassword);
      setMessage({ text: 'Password saved. Your account is activated.', type: 'success' });
      window.setTimeout(onSuccess, 1200);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to activate account.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasLength = newPassword.length >= 8;
  const hasMatch = newPassword.length > 0 && newPassword === retypePassword;
  
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, #e0e7ff 0%, #f8fafc 50%, #f1f5f9 100%)',
      fontFamily: '"Inter", system-ui, sans-serif',
      padding: '24px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '460px',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02), 0 10px 15px -3px rgba(0,0,0,0.03)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Top Accent Strip */}
        <div style={{ height: '6px', width: '100%', background: 'linear-gradient(90deg, #4f46e5, #ec4899)' }} />

        <div style={{ padding: '40px 48px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: '#f0fdf4', borderRadius: '16px', marginBottom: '24px' }}>
            <ShieldCheck size={28} color="#16a34a" />
          </div>

          <p style={{ color: '#6366f1', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>
            Invitation Accepted
          </p>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 12px 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
            Secure your account
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', margin: '0 0 32px 0', lineHeight: 1.5 }}>
            Create a strong password to activate your profile and unlock your workspace.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* New Password Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter a strong password"
                  required
                  disabled={!token || loading}
                  style={{
                    width: '100%',
                    padding: '14px 44px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '15px',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.background = '#ffffff'; e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 4px #e0e7ff'; }}
                  onBlur={(e) => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Retype Password Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <KeyRound size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={retypePassword}
                  onChange={(e) => setRetypePassword(e.target.value)}
                  placeholder="Type your password again"
                  required
                  disabled={!token || loading}
                  style={{
                    width: '100%',
                    padding: '14px 44px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '15px',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.background = '#ffffff'; e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 4px #e0e7ff'; }}
                  onBlur={(e) => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                />
                {hasMatch && (
                  <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }}>
                    <CheckCircle2 size={18} />
                  </div>
                )}
              </div>
            </div>

            {/* Validation Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasLength ? '#10b981' : '#64748b', fontSize: '13px', fontWeight: 500 }}>
                 <CheckCircle2 size={16} color={hasLength ? "#10b981" : "#cbd5e1"} />
                 At least 8 characters
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasMatch ? '#10b981' : '#64748b', fontSize: '13px', fontWeight: 500 }}>
                 <CheckCircle2 size={16} color={hasMatch ? "#10b981" : "#cbd5e1"} />
                 Passwords match
               </div>
            </div>

            {message.type && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 500,
                background: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
                color: message.type === 'error' ? '#ef4444' : '#16a34a',
                border: `1px solid ${message.type === 'error' ? '#fca5a5' : '#86efac'}`
              }}>
                {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                {message.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={!token || loading || !hasLength || !hasMatch}
              style={{
                background: (!token || loading || !hasLength || !hasMatch) 
                    ? '#e2e8f0' 
                    : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: (!token || loading || !hasLength || !hasMatch) ? '#94a3b8' : '#ffffff',
                border: 'none',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: (!token || loading || !hasLength || !hasMatch) ? 'not-allowed' : 'pointer',
                marginTop: '12px',
                boxShadow: (!token || loading || !hasLength || !hasMatch) ? 'none' : '0 10px 15px -3px rgba(79, 70, 229, 0.3)',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                 if(!token || loading || !hasLength || !hasMatch) return;
                 e.currentTarget.style.transform = 'translateY(-2px)';
                 e.currentTarget.style.boxShadow = '0 15px 20px -3px rgba(79, 70, 229, 0.4)';
              }}
              onMouseLeave={(e) => {
                 if(!token || loading || !hasLength || !hasMatch) return;
                 e.currentTarget.style.transform = 'translateY(0)';
                 e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(79, 70, 229, 0.3)';
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                  </svg>
                  Activating Workspace...
                </>
              ) : (
                'Activate Account'
              )}
            </button>

          </form>
        </div>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
