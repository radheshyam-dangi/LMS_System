import { API_BASE_URL } from '../api';
import type { InviteUserPayload, LoginResponse } from '../types/auth';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    const result = await response.json();
    return result.message || fallback;
  } catch {
    return fallback;
  }
};

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/users/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Login failed'));
  }

  return response.json();
};

export const sendInvitation = async (payload: InviteUserPayload, accessToken: string) => {
  const response = await fetch(`${API_BASE_URL}/email/send`, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to send invitation'));
  }

  return response.json();
};

export const completeSignup = async (
  token: string,
  newPassword: string,
  retypePassword: string,
) => {
  const response = await fetch(`${API_BASE_URL}/auth/complete-signup?token=${token}`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ newPassword, retypePassword }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to complete account setup'));
  }

  return response.json();
};
