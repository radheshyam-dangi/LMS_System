import { useState } from 'react';
import { API_BASE_URL } from '../api';

type UserRole = {
  id: string;
  name: string;
};

type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: UserRole[];
};

type LoginProps = {
  onLogin: (user: User) => void;
};

function Login({ onLogin }: LoginProps) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Login failed');
      }

      onLogin(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed');
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input name="email" type="email" value={formData.email} onChange={handleChange} required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
        />
      </label>
      <button type="submit">Login</button>
      {message && <p className="form-message">{message}</p>}
    </form>
  );
}

export default Login;
