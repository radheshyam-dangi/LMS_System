/**
 * useAiAssistant — React hook for the Global AI Assistant
 *
 * Manages conversation state, message sending, and history.
 * Feature-flagged: returns isEnabled=false when AI_ASSISTANT_ENABLED is off.
 *
 * Design:
 * - Messages are displayed optimistically then confirmed from the server response.
 * - Conversations are loaded lazily when the drawer opens.
 * - API calls use fetch() so we can later switch to SSE streaming without refactoring.
 */
import { useState, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../../api';

export type SourceLabel = 'lp_content' | 'web' | 'none';

export interface Citation {
  type: 'lp' | 'web';
  lessonId?: string;
  lessonTitle?: string;
  lpTitle?: string;
  preview?: string;
  url?: string;
  title?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sourceLabel?: SourceLabel;
  citations?: Citation[];
  isLoading?: boolean;
  feedback?: 'thumbs_up' | 'thumbs_down';
}

export interface Conversation {
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

const AI_BASE = `${API_BASE_URL}/ai-assistant`;

export function useAiAssistant(accessToken: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isEnabled = import.meta.env.VITE_AI_ASSISTANT_ENABLED !== 'false';

  const sendMessage = useCallback(
    async (
      question: string,
      opts?: { activeAssignmentId?: string },
    ): Promise<void> => {
      if (!question.trim() || isLoading) return;

      // Optimistic user message
      const tempUserMsg: Message = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: question,
      };
      const tempAiMsg: Message = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: '',
        isLoading: true,
      };

      setMessages((prev) => [...prev, tempUserMsg, tempAiMsg]);
      setIsLoading(true);
      setError(null);

      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`${AI_BASE}/messages`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            ...(conversationId ? { conversationId } : {}),
            question: question.trim(),
            ...(opts?.activeAssignmentId ? { activeAssignmentId: opts.activeAssignmentId } : {}),
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

        // Set conversation ID from first message
        if (!conversationId && data.conversationId) {
          setConversationId(data.conversationId);
        }

        // Replace optimistic messages with confirmed ones
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
              sourceLabel: data.sourceLabel,
              citations: data.citations || [],
            },
          ];
        });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        const msg = (e as Error).message || 'Failed to get a response.';
        setError(msg);

        // Remove loading placeholder
        setMessages((prev) =>
          prev.filter((m) => m.id !== tempUserMsg.id && m.id !== tempAiMsg.id),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading],
  );

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`${AI_BASE}/conversations`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      // non-fatal
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${AI_BASE}/conversations/${id}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversationId(id);
      setMessages(
        (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sourceLabel: m.sourceLabel,
          citations: m.citations || [],
        })),
      );
    } catch {
      // non-fatal
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`${AI_BASE}/conversations/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
    } catch {
      // non-fatal
    }
  }, [conversationId]);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  const submitFeedback = useCallback(
    async (messageId: string, feedback: 'thumbs_up' | 'thumbs_down') => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
      );
      try {
        await fetch(`${AI_BASE}/messages/${messageId}/feedback`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ feedback }),
        });
      } catch {
        // non-fatal
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
    loadConversations,
    loadConversation,
    deleteConversation,
    startNewConversation,
    submitFeedback,
    setError,
  };
}
