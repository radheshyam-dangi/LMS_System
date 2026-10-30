import { useState, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../../api';

export interface ActionCardData {
  actionId: string;
  type: string;
  actionType?: string;
  summary?: string;
  operationType?: string;
  lpId: string;
  lpTitle: string;
  moduleCount: number;
  lessonCount: number;
  assignmentCount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
}

export interface TrainerMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionCard?: ActionCardData | null;
  isLoading?: boolean;
  feedback?: 'thumbs_up' | 'thumbs_down';
}

export interface TrainerConversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

function getToken(): string {
  return localStorage.getItem('skillforge_token') || '';
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const TRAINER_AI_BASE = `${API_BASE_URL}/trainer-ai-assistant`;

export function useTrainerAiAssistant(accessToken: string) {
  const [messages, setMessages] = useState<TrainerMessage[]>([]);
  const [conversations, setConversations] = useState<TrainerConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isEnabled = import.meta.env.VITE_AI_ASSISTANT_ENABLED !== 'false';

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(`${TRAINER_AI_BASE}/conversations`, {
        headers: authHeaders(),
      });
      if (!response.ok) return;
      const data = await response.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      // Ignore background load failures
    }
  }, []);

  const sendMessage = useCallback(
    async (question: string, activePathId?: string | null): Promise<any> => {
      if (!question.trim() || isLoading) return;

      const tempUserMsg: TrainerMessage = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: question,
      };
      const tempAiMsg: TrainerMessage = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: '',
        isLoading: true,
      };

      setMessages((prev) => [...prev, tempUserMsg, tempAiMsg]);
      setIsLoading(true);
      setError(null);

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`${TRAINER_AI_BASE}/messages`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            ...(conversationId ? { conversationId } : {}),
            ...(activePathId ? { pathId: activePathId } : {}),
            question: question.trim(),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = Array.isArray(errData.message)
            ? errData.message.join(', ')
            : errData.message || `Error ${response.status}`;
          throw new Error(errMsg);
        }

        const data = await response.json();

        if (data.conversationId) {
          setConversationId(data.conversationId);
          try {
            sessionStorage.setItem('skillforge_trainer_ai_conv_id', data.conversationId);
          } catch {
            // non-fatal
          }
          // Refresh conversations in background so history sidebar is up to date
          void loadConversations();
        }

        setMessages((prev) => {
          const withoutTemps = prev.filter(
            (m) => m.id !== tempUserMsg.id && m.id !== tempAiMsg.id,
          );
          return [
            ...withoutTemps,
            { id: `usr-${Date.now()}`, role: 'user', content: question },
            {
              id: data.messageId || `ai-${Date.now()}`,
              role: 'assistant',
              content: data.answer,
              actionCard: data.actionCard || null,
            },
          ];
        });

        return data;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        const msg = (e as Error).message || 'Failed to get a response.';
        setError(msg);
        setMessages((prev) =>
          prev.filter((m) => m.id !== tempUserMsg.id && m.id !== tempAiMsg.id),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, loadConversations],
  );

  const confirmAction = useCallback(async (actionId: string): Promise<any> => {
    try {
      const response = await fetch(`${TRAINER_AI_BASE}/actions/${actionId}/confirm`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detailedMsg = Array.isArray(err.errors) && err.errors.length
          ? `${err.message || 'Validation failed'}: ${err.errors.join('; ')}`
          : (err.message || 'Confirmation failed');
        throw new Error(detailedMsg);
      }
      const data = await response.json();

      // Update message action card status locally
      setMessages((prev) =>
        prev.map((m) => {
          if (m.actionCard && m.actionCard.actionId === actionId) {
            return {
              ...m,
              actionCard: {
                ...m.actionCard,
                status: 'confirmed',
              },
            };
          }
          return m;
        }),
      );

      return data;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);

  const cancelAction = useCallback(async (actionId: string): Promise<any> => {
    try {
      const response = await fetch(`${TRAINER_AI_BASE}/actions/${actionId}/cancel`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detailedMsg = Array.isArray(err.errors) && err.errors.length
          ? `${err.message || 'Cancellation failed'}: ${err.errors.join('; ')}`
          : (err.message || 'Cancellation failed');
        throw new Error(detailedMsg);
      }
      const data = await response.json();

      setMessages((prev) =>
        prev.map((m) => {
          if (m.actionCard && m.actionCard.actionId === actionId) {
            return {
              ...m,
              actionCard: {
                ...m.actionCard,
                status: 'cancelled',
              },
            };
          }
          return m;
        }),
      );

      return data;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);


  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${TRAINER_AI_BASE}/conversations/${id}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Failed to load conversation');
      const data = await response.json();
      setConversationId(data.id);
      try {
        sessionStorage.setItem('skillforge_trainer_ai_conv_id', data.id);
      } catch {
        // non-fatal
      }
      setMessages(
        (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          actionCard: m.actionCard || null,
          feedback: m.feedback,
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`${TRAINER_AI_BASE}/conversations/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (conversationId === id) {
          setConversationId(null);
          setMessages([]);
          try {
            sessionStorage.removeItem('skillforge_trainer_ai_conv_id');
          } catch {
            // non-fatal
          }
        }
      } catch {
        // Ignore
      }
    },
    [conversationId],
  );

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    try {
      sessionStorage.removeItem('skillforge_trainer_ai_conv_id');
    } catch {
      // non-fatal
    }
  }, []);

  const submitFeedback = useCallback(
    async (messageId: string, feedback: 'thumbs_up' | 'thumbs_down') => {
      try {
        await fetch(`${TRAINER_AI_BASE}/messages/${messageId}/feedback`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ feedback }),
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, feedback } : m)),
        );
      } catch {
        // Ignore
      }
    },
    [],
  );

  return {
    isEnabled,
    messages,
    conversations,
    conversationId,
    isLoading,
    error,
    sendMessage,
    confirmAction,
    cancelAction,
    loadConversations,
    loadConversation,
    deleteConversation,
    startNewConversation,
    submitFeedback,
    setError,
  };
}
