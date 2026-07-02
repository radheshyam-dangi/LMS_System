import { LoginForm } from '../components/auth/LoginForm';
import type { LoginResponse } from '../types/auth';

type LoginPageProps = {
  onBackHome: () => void;
  onLogin: (data: LoginResponse) => void;
};

export function LoginPage({ onBackHome, onLogin }: LoginPageProps) {
  return (
    <main className="centered-page">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>Login to SkillForge</h1>
          <p>Use your activated account to continue into your assigned role workspace.</p>
        </div>
        <LoginForm onLogin={onLogin} />
        <button className="link-button" type="button" onClick={onBackHome}>
          Back to home
        </button>
      </section>
    </main>
  );
}
