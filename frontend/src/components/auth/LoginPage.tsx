import { LoginForm } from './LoginForm';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import type { LoginResponse } from '../../types/auth';
import './LoginPage.css';

type LoginPageProps = {
  onLogin: (data: LoginResponse) => void;
  onBackHome?: () => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <div className="login-page-wrapper">
      <main className="login-main-container" role="main">
        <Card className="login-shadcn-card">
          <CardHeader className="login-card-header">
            {/* Top icon and title visible on the left side with small margin */}
            <div className="login-brand-identity">
              <div className="login-brand-icon-wrapper">
                <img
                  src="/infoobjects-icon.png"
                  alt="SkillForge Icon"
                  className="login-brand-icon-image"
                  loading="eager"
                />
              </div>
              <span className="login-brand-name">SkillForge</span>
            </div>

            {/* SignIn heading aligned to the left */}
            <CardTitle className="login-card-title">
              Sign In
            </CardTitle>
          </CardHeader>

          <CardContent className="login-card-content">
            <LoginForm onLogin={onLogin} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}