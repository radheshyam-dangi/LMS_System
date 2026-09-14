import axios from 'axios';
import { API_BASE_URL } from '../api';

const auth = (token: string) => ({
  withCredentials: true,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

export const lpAuthoringService = {
  /** Submit a complete Learning Path from the Tiptap editor */
  submitLPDocument: async (payload: any, token: string) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/lp-authoring/submit`,
      payload,
      auth(token),
    );
    return data;
  },

  /** Save a draft (raw Tiptap JSON) */
  saveDraft: async (
    draftData: any,
    token: string,
    draftId?: string,
    title?: string,
  ) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/lp-authoring/drafts`,
      { draftData, draftId, title },
      auth(token),
    );
    return data;
  },

  /** List all active drafts for the current user */
  loadDrafts: async (token: string) => {
    const { data } = await axios.get(
      `${API_BASE_URL}/lp-authoring/drafts`,
      auth(token),
    );
    return Array.isArray(data) ? data : [];
  },

  /** Load a specific draft */
  loadDraft: async (draftId: string, token: string) => {
    const { data } = await axios.get(
      `${API_BASE_URL}/lp-authoring/drafts/${draftId}`,
      auth(token),
    );
    return data;
  },

  /** Delete a draft */
  deleteDraft: async (draftId: string, token: string) => {
    await axios.delete(
      `${API_BASE_URL}/lp-authoring/drafts/${draftId}`,
      auth(token),
    );
  },
};

export const aiEvaluationService = {
  /** Trainer reviews and releases an AI-evaluated submission */
  reviewAIEvaluation: async (
    submissionId: string,
    edits: {
      questionScores?: Array<{
        questionId: string;
        score: number;
        maxScore: number;
        remark: string;
      }>;
      overallRemark?: string;
    },
    token: string,
  ) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/ai-evaluation/review/${submissionId}`,
      edits,
      auth(token),
    );
    return data;
  },
};
