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
  // Fetch all paths available to the active session user token
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
    const data = await response.json();
    return data;
  },

  // Post a newly configured track blueprint directly to the database layer
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
      throw new Error(`Database transaction failed: status ${response.status}`);
    }
    const data = await response.json();
    return data.learningPath ?? data;
  },
  // Add this inside the learningPathService object in your services/learningPathService.ts file

async assignTraineeToPath(pathId: string, traineeId: string, token: string): Promise<LearningPath> {
  const response = await fetch(`${API_BASE_URL}/learningPaths/${pathId}/assign`, {
    method: 'PUT', // Matches your NestJS route map structure
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
}
};