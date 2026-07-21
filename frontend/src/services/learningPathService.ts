import { API_BASE_URL } from '../api';
import type { LearningPath, PathDifficulty } from '../types/auth';

export interface CreatePathPayload {
  name: string;
  description: string;
  difficulty: PathDifficulty;
  duration: string;
  skillsTags: string[];
}

export const learningPathService = {
  async fetchAllPaths(token: string): Promise<LearningPath[]> {
    const response = await fetch(`${API_BASE_URL}/learningPaths`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error fetching paths: status ${response.status}`);
    }
    return await response.json();
  },

  async fetchPathById(pathId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/learningPaths/${pathId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch learning path details.');
    return await response.json();
  },

  async createPath(payload: CreatePathPayload, token: string): Promise<LearningPath> {
    const response = await fetch(`${API_BASE_URL}/learningPaths`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Database transaction failed: status ${response.status}`);
    }
    const data = await response.json();
    return data.learningPath ?? data;
  },

  async assignTraineeToPath(pathId: string, traineeId: string, token: string): Promise<LearningPath> {
    const response = await fetch(`${API_BASE_URL}/learningPaths/${pathId}/assign`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ traineeId })
    });

    if (!response.ok) {
      throw new Error(`Failed to assign trainee: status ${response.status}`);
    }
    return await response.json();
  },
  // Inside learningPathService object in learningPathService.ts

async deletePath(pathId: string, token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/learningPaths/${pathId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to delete Learning Path.');
  }
}
};