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

type SignupProps = {
  onSignup: (user: User) => void;
};

function SignUp({ onSignup }: SignupProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials:'include'
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Signup failed');
      }

      onSignup(result);
      setMessage('Account created successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Signup failed');
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        First name
        <input name="firstName" value={formData.firstName} onChange={handleChange} required />
      </label>
      <label>
        Last name
        <input name="lastName" value={formData.lastName} onChange={handleChange} />
      </label>
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
      <button type="submit">Create account</button>
      {message && <p className="form-message">{message}</p>}
    </form>
  );
}

export default SignUp;
