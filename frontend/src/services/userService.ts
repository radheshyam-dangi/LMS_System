import axios from 'axios';
import { API_BASE_URL } from '../api';
import type { RoleName } from '../types/auth';

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  firstName?: string;
  lastName?: string;
  status?: string;
  avatarUrl?: string;
  createdAt?: string;
}

const getAuthHeaders = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

export const userService = {
  /**
   * 1. FETCH USERS BY SPECIFIC ROLE (e.g. 'Trainee', 'Trainer')
   * Used in assignment modals and pop-ups to populate user selection lists.
   */
  fetchUsersByRole: async (role: RoleName, token: string): Promise<User[]> => {
    try {
      const response = await axios.get<User[]>(
        `${API_BASE_URL}/users?role=${role}`,
        getAuthHeaders(token)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || `Failed to fetch users with role "${role}".`;
      throw new Error(message);
    }
  },

  /**
   * 2. FETCH ALL USERS
   */
  fetchAllUsers: async (token: string): Promise<User[]> => {
    try {
      const response = await axios.get<User[]>(
        `${API_BASE_URL}/users`,
        getAuthHeaders(token)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch user list.';
      throw new Error(message);
    }
  },

  /**
   * 3. FETCH SINGLE USER DETAILS BY ID
   */
  fetchUserById: async (userId: string, token: string): Promise<User> => {
    try {
      const response = await axios.get<User>(
        `${API_BASE_URL}/users/${userId}`,
        getAuthHeaders(token)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || `User with ID "${userId}" not found.`;
      throw new Error(message);
    }
  },

  /**
   * 4. UPDATE USER PROFILE / ROLE
   */
  updateUser: async (
    userId: string,
    payload: Partial<Omit<User, 'id'>>,
    token: string
  ): Promise<User> => {
    try {
      const response = await axios.put<User>(
        `${API_BASE_URL}/users/${userId}`,
        payload,
        getAuthHeaders(token)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update user record.';
      throw new Error(message);
    }
  },

  /**
   * 5. DELETE USER ACCOUNT
   */
  deleteUser: async (userId: string, token: string): Promise<void> => {
    try {
      await axios.delete(
        `${API_BASE_URL}/users/${userId}`,
        getAuthHeaders(token)
      );
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete user account.';
      throw new Error(message);
    }
  },

  /**
   * 6. CHANGE USER PASSWORD
   */
  changePassword: async (
    userId: string,
    payload: { currentPassword: string; newPassword: string },
    token?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const headers = token ? getAuthHeaders(token) : { headers: { 'Content-Type': 'application/json' } };
      const response = await axios.put<{ success: boolean; message: string }>(
        `${API_BASE_URL}/users/${userId}/change-password`,
        payload,
        headers
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update password.';
      throw new Error(message);
    }
  },

  /**
   * 7. FETCH USER PROFILE STATS & METRICS
   */
  fetchUserProfileStats: async (userId: string, token: string): Promise<any> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/users/${userId}/profile-stats`,
        getAuthHeaders(token)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch user profile stats.';
      throw new Error(message);
    }
  },

  /**
   * 8. DEACTIVATE USER ACCOUNT
   */
  deactivateUser: async (userId: string, token?: string): Promise<any> => {
    try {
      const headers = token ? getAuthHeaders(token) : { headers: { 'Content-Type': 'application/json' } };
      const response = await axios.put(`${API_BASE_URL}/users/${userId}/deactivate`, {}, headers);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to deactivate user.';
      throw new Error(message);
    }
  },

  /**
   * 9. REACTIVATE USER ACCOUNT
   */
  reactivateUser: async (userId: string, token?: string): Promise<any> => {
    try {
      const headers = token ? getAuthHeaders(token) : { headers: { 'Content-Type': 'application/json' } };
      const response = await axios.put(`${API_BASE_URL}/users/${userId}/reactivate`, {}, headers);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to reactivate user.';
      throw new Error(message);
    }
  },

  /**
   * 10. UPDATE USER ROLE
   */
  updateUserRole: async (userId: string, roleName: string, token?: string): Promise<any> => {
    try {
      const headers = token ? getAuthHeaders(token) : { headers: { 'Content-Type': 'application/json' } };
      const response = await axios.put(`${API_BASE_URL}/users/${userId}/role`, { roleName }, headers);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update user role.';
      throw new Error(message);
    }
  },
};

