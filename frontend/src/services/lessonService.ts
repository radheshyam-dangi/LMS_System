import { API_BASE_URL } from '../api';

export interface CreateLessonPayload {
  moduleId: string;
  title: string;
  description?: string;
  videoUrl?: string;
  articleContent?: string;
  durationMinutes?: number;
}

export interface CreateAssignmentPayload {
  lessonId: string;
  title: string;
  instructions: string;
  assignmentType: 'Subjective' | 'MCQ';
  mcqConfig?: {
    options: string[];
    correctIndex: number;
  } | null;
}

export const lessonService = {
  // Fetch module lessons
  async fetchLessonsForModule(moduleId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/lessons?moduleId=${moduleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch lessons.');
    return await response.json();
  },

  // Toggle lesson completion
  async toggleProgress(lessonId: string, isCompleted: boolean, token: string) {
    const response = await fetch(`${API_BASE_URL}/lessons/${lessonId}/progress`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isCompleted }),
    });
    if (!response.ok) throw new Error('Failed to update lesson progress.');
    return await response.json();
  },

  // Submit assignment solution
  async submitAssignment(assignmentId: string, submissionText: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ submissionText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: Failed to submit assignment.`);
    }
    return await response.json();
  },

  // ✅ FIX: Added createLesson method
  async createLesson(payload: CreateLessonPayload, token: string) {
    const response = await fetch(`${API_BASE_URL}/lessons`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create lesson.');
    }
    return await response.json();
  },

  // ✅ FIX: Added createAssignment method
  async createAssignment(payload: CreateAssignmentPayload, token: string) {
    const response = await fetch(`${API_BASE_URL}/assignments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create assignment.');
    }
    return await response.json();
  },
};