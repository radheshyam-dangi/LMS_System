import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../api';

type SetPasswordProps = {
  onSuccess: () => void;
};

// 1. FIXED: Properly type and destructure the props object
export const SetPassword: React.FC<SetPasswordProps> = ({ onSuccess }) => {
  // 1. Form state management
  const [newPassword, setNewPassword] = useState<string>('');
  const [retypePassword, setRetypePassword] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  
  // 2. UI Status state management
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | null }>({
    text: '',
    type: null,
  });

  // 3. Extract the token from URL query string on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setMessage({
        text: 'Invalid or missing invitation link setup token.',
        type: 'error',
      });
    }
  }, []);

  // 4. Handle form submission logic
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage({ text: '', type: null });

    // Validate if passwords match structural conditions
    if (newPassword !== retypePassword) {
      setMessage({ text: 'Passwords do not match!', type: 'error' });
      return;
    }

    if (!token) {
      setMessage({ text: 'Cannot submit. Token is missing.', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // Hit your NestJS absolute API route endpoint destination
      const response = await fetch(`${API_BASE_URL}/auth/complete-signup?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword,
          retypePassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          text: 'Password set successfully! Account activated.',
          type: 'success',
        });

        // 2. FIXED: Trigger the success callback after 2 seconds to let the user read the message
        setTimeout(() => {
          onSuccess();
        }, 2000);

      } else {
        setMessage({
          text: data.message || 'Failed to complete registration setup.',
          type: 'error',
        });
      }
    } catch (error) {
      setMessage({
        text: 'Network error connectivity failed with server.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 border border-gray-200 rounded-lg shadow-md">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            Create Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please enter your secure access credentials below to activate your account profile.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                required
                disabled={!token || loading}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label htmlFor="retype-password" className="block text-sm font-medium text-gray-700 mb-1">
                Retype Password
              </label>
              <input
                id="retype-password"
                name="retypePassword"
                type="password"
                required
                disabled={!token || loading}
                value={retypePassword}
                onChange={(e) => setRetypePassword(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Confirm your password"
              />
            </div>
          </div>

          {message.type && (
            <div
              className={`p-3 rounded-md text-sm font-medium text-center ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={!token || loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                (!token || loading) && 'opacity-50 cursor-not-allowed'
              }`}
            >
              {loading ? 'Processing Setup...' : 'Create Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};