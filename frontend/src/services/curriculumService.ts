import axios from 'axios';
import { API_BASE_URL } from '../api';

const getAuthHeaders = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

export const curriculumService = {
  fetchMySubmissions: async (token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments/my-submissions`,
      getAuthHeaders(token)
    );
    return response.data;
  },
  // ==========================================
  // 1. MODULE ENDPOINTS
  // ==========================================
  fetchModulesByPath: async (learningPathId: string, token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/modules?learningPathId=${learningPathId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  createModule: async (
    payload: { title: string; description?: string; learningPathId: string },
    token: string
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/modules`,
      payload,
      getAuthHeaders(token)
    );
    return response.data;
  },

  // ==========================================
  // 2. LESSON ENDPOINTS
  // ==========================================
  createLesson: async (
    payload: {
      title: string;
      description?: string;
      content?: string;
      videoUrl?: string;
      articleUrl?: string;
      durationMinutes?: number;
      displayOrder?: number;
      moduleId: string;
    },
    token: string
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/lessons`,
      payload,
      getAuthHeaders(token)
    );
    return response.data;
  },

  // ==========================================
  // 3. TASK / ASSIGNMENT ENDPOINTS
  // ==========================================
  createTask: async (
    payload: {
      title: string;
      instructions?: string;
      assignmentType?: 'Subjective' | 'MCQ';
      mcqConfig?: any;
      maxScore?: number;
      dueDate?: string;
      lessonId?: string;
      moduleId?: string;
      learningPathId?: string;
    },
    token: string
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/assignments`,
      payload,
      getAuthHeaders(token)
    );
    return response.data;
  },

  // ==========================================
  // 4. RESOURCE ENDPOINTS
  // ==========================================
  createResource: async (
    payload: {
      title: string;
      url: string;
      lessonId?: string;
      moduleId?: string;
    },
    token: string
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/resources`,
      payload,
      getAuthHeaders(token)
    );
    return response.data;
  },

  // ==========================================
  // 5. TRAINEE SUBMISSION & EVALUATION ENDPOINTS
  // ==========================================
  submitAssignment: async (
    payload: { assignmentId: string; submissionText: string; attachmentUrl?: string },
    token: string
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/assignments/${payload.assignmentId}/submit`,
      payload,
      getAuthHeaders(token)
    );
    return response.data;
  },

  fetchPendingSubmissions: async (token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments/submissions/pending`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  evaluateSubmission: async (
    submissionId: string,
    payload: { score: number; feedback: string; status?: 'Accepted' | 'Rejected' | 'Evaluated' },
    token: string
  ) => {
    const response = await axios.put(
      `${API_BASE_URL}/assignments/submissions/${submissionId}/evaluate`,
      payload,
      getAuthHeaders(token)
    );
    return response.data;
  },

  fetchSubmissionsByAssignment: async (assignmentId: string, token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments/${assignmentId}/submissions`,
      getAuthHeaders(token)
    );
    return response.data;
  },
};