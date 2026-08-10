import axios from 'axios';
import { API_BASE_URL } from '../api';

const getAuthHeaders = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

export const learningPathService = {
  // Existing methods...
  fetchAllPaths: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/learningPaths`, getAuthHeaders(token));
    return response.data;
  },

  // 🌟 ADD THIS: Fetch single Learning Path details to identify owner
  fetchPathById: async (pathId: string, token: string) => {
    const response = await axios.get(`${API_BASE_URL}/learningPaths/${pathId}`, getAuthHeaders(token));
    return response.data;
  },

  createPath: async (payload: any, token: string) => {
    const response = await axios.post(`${API_BASE_URL}/learningPaths`, payload, getAuthHeaders(token));
    return response.data;
  },

  updatePath: async (pathId: string, payload: any, token: string) => {
    const response = await axios.put(`${API_BASE_URL}/learningPaths/${pathId}`, payload, getAuthHeaders(token));
    return response.data;
  },

  deletePath: async (pathId: string, token: string) => {
    const response = await axios.delete(`${API_BASE_URL}/learningPaths/${pathId}`, getAuthHeaders(token));
    return response.data;
  },

  // ASSIGN TRAINEE ENDPOINT
assignTraineeToPath: async (
    pathId: string, 
    traineeIds: string | string[], 
    token: string
  ) => {
    // Standardize to an array
    const idsArray = Array.isArray(traineeIds) ? traineeIds : [traineeIds];

    const response = await fetch(`${API_BASE_URL}/learningPaths/${pathId}/assign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        traineeIds: idsArray,
        traineeId: idsArray[0] // Included for backwards compatibility with single-id backend handlers
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to assign trainees.');
    }

    return await response.json();
  },
};