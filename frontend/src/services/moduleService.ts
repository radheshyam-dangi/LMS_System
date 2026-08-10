import { API_BASE_URL } from '../api';

export interface CreateModulePayload {
  learningPathId: string;
  parentId?: string | null;
  title: string;
  description?: string;
  difficultyLevel?: string;
  displayOrder?: number;
}

export const moduleService = {
  async fetchModulesForPath(learningPathId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/modules?learningPathId=${learningPathId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch modules for path.');
    return await response.json();
  },

  async fetchAllModules(token: string) {
    const response = await fetch(`${API_BASE_URL}/modules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch modules.');
    return await response.json();
  },

  async createModule(payload: CreateModulePayload, token: string) {
    const response = await fetch(`${API_BASE_URL}/modules`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Failed to create module.');
    return await response.json();
  },
};