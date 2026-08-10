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
};