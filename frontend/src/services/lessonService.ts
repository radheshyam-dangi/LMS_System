import { API_BASE_URL } from '../api';

export interface CreateLessonPayload {
  moduleId?: string;
  learningPathId?: string;
  title: string;
  description?: string;
  videoUrl?: string;
  articleContent?: string;
  durationMinutes?: number;
}

export interface CreateAssignmentPayload {
  lessonId?: string;
  moduleId?: string;
  learningPathId?: string;
  title: string;
  instructions: string;
  assignmentType: 'Subjective' | 'MCQ';
  mcqConfig?: {
    options: string[];
    correctIndex: number;
  } | null;
}

export interface EvaluateSubmissionPayload {
  score: number;
  feedback?: string;
}

export const lessonService = {
  /**
   * 📖 LESSON FETCHING
   */
  async fetchLessonsForModule(moduleId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/lessons?moduleId=${moduleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch lessons for module.');
    return await response.json();
  },

  async fetchLessonsForPath(learningPathId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/lessons?learningPathId=${learningPathId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch lessons for learning path.');
    return await response.json();
  },

  /**
   * 📝 LESSON CREATION
   */
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

  /**
   * 🎯 LESSON PROGRESS
   */
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

  /**
   * 📋 ASSIGNMENT CREATION
   */
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

  /**
   * 📤 TRAINEE: SUBMIT ASSIGNMENT
   */
  async submitAssignment(assignmentId: string, submissionText: string, token: string, attachmentUrl?: string) {
    const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ submissionText, attachmentUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: Failed to submit assignment.`);
    }
    return await response.json();
  },

  /**
   * 🎓 TRAINER: EVALUATE & GRADE SUBMISSION
   */
  async evaluateSubmission(submissionId: string, payload: EvaluateSubmissionPayload, token: string) {
    const response = await fetch(`${API_BASE_URL}/assignments/submissions/${submissionId}/evaluate`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: Failed to evaluate submission.`);
    }
    return await response.json();
  },

  /**
   * 🔍 TRAINER: FETCH ALL SUBMISSIONS FOR AN ASSIGNMENT
   */
  async fetchSubmissionsForAssignment(assignmentId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch assignment submissions.');
    }
    return await response.json();
  },

  /**
   * 👤 TRAINEE / TRAINER: FETCH SINGLE SUBMISSION DETAILS
   */
  async fetchTraineeSubmission(assignmentId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/my-submission`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 404) return null; // No submission made yet
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch submission details.');
    }
    return await response.json();
  },
};