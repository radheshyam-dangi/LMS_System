import axios from 'axios';
import { API_BASE_URL } from '../api';
import type { InviteUserPayload, LoginResponse } from '../types/auth';

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/login`, {
      email,
      password,
    }, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Login failed');
  }
};

export const sendInvitation = async (payload: InviteUserPayload, accessToken: string) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/email/send`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Unable to send invitation');
  }
};

export const completeSignup = async (
  token: string,
  newPassword: string,
  retypePassword: string,
) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/complete-signup?token=${token}`, {
      newPassword,
      retypePassword,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to complete account setup');
  }
};
