import axios from 'axios';
import { API_BASE_URL } from '../api';

/**
 * Helper to construct Bearer Authorization headers
 */
const getAuthHeaders = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

export const assignmentService = {
  /**
   * 1. CREATE ASSIGNMENT / TASK (Trainer / Admin)
   * Handles Subjective & MCQ configuration payloads
   */
  createTask: async (payload: any, token: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/assignments`,
      payload,
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 2. UPDATE ASSIGNMENT / TASK (Trainer / Admin)
   */
  updateTask: async (taskId: string, payload: any, token: string) => {
    const response = await axios.put(
      `${API_BASE_URL}/assignments/${taskId}`,
      payload,
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 3. DELETE ASSIGNMENT / TASK (Trainer / Admin)
   */
  deleteTask: async (taskId: string, token: string) => {
    const response = await axios.delete(
      `${API_BASE_URL}/assignments/${taskId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 4. FETCH ASSIGNMENT BY ID
   */
  fetchAssignmentById: async (taskId: string, token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments/${taskId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 5. FETCH ALL ASSIGNMENTS FOR A SPECIFIC LESSON
   */
  fetchAssignmentsByLesson: async (lessonId: string, token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments?lessonId=${lessonId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 6. FETCH ALL ASSIGNMENTS (Trainer/Admin)
   */
  fetchAllAssignments: async (token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments`,
      getAuthHeaders(token)
    );
    return Array.isArray(response.data) ? response.data : (response.data?.data || response.data?.assignments || []);
  },

  /**
   * 7. FETCH ASSIGNMENTS BY TRAINEE (Trainer/Admin scoped view)
   */
  fetchAssignmentsByTrainee: async (traineeId: string, token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments?traineeId=${traineeId}`,
      getAuthHeaders(token)
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * 8. ASSIGN SPECIFIC TRAINEES TO AN ASSIGNMENT (prevent duplicates)
   */
  assignToTrainees: async (assignmentId: string, traineeIds: string[], token: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/assignments/${assignmentId}/assign`,
      { traineeIds },
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 8b. Trainee: my assigned tasks (external + path-linked)
   */
  fetchMyAssignments: async (token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments/my-assignments`,
      getAuthHeaders(token)
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  fetchExternalAssignments: async (token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments/external`,
      getAuthHeaders(token)
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  /** Trainer opened a submission for evaluation — decreases bell counter */
  openSubmissionForEvaluation: async (submissionId: string, token: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/assignments/submissions/${submissionId}/open`,
      {},
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 9. SUBMIT ASSIGNMENT (Trainee Action)
   * Sends submission text, code/drive attachments, or MCQ answer selections
   */
  submitAssignment: async (
    assignmentId: string,
    payload: { submissionText?: string; attachmentUrl?: string; mcqAnswers?: Record<string, number> },
    token: string
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/assignments/${assignmentId}/submit`,
      payload,
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 10. FETCH MY SUBMISSIONS & SCORES (Trainee View)
   */
  fetchMySubmissions: async (token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments/my-submissions`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 11. FETCH PENDING SUBMISSIONS FOR REVIEW (Trainer / Admin Dashboard Queue)
   */
  fetchPendingSubmissions: async (token: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/assignments/submissions/pending`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  /**
   * 12. EVALUATE & GRADE SUBMISSION (Trainer Review Action)
   */
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
};
