import React, { useEffect, useState } from 'react';
import type { SessionUser } from '../../types/auth';
import { aiCoachService } from '../../services/lmsApi';

type AiCoachSectionProps = {
  currentUser: SessionUser;
  accessToken: string;
};

type ChatMessage = {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
};

export function AiCoachSection({ currentUser, accessToken }: AiCoachSectionProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [bootError, setBootError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const existing = await aiCoachService.listConversations(accessToken);
        let conversation =
          existing[0] ||
          (await aiCoachService.createConversation(
            accessToken,
            `Coach chat — ${currentUser.firstName || 'Learner'}`,
          ));

        if (conversation?.id && !conversation.messages) {
          conversation = await aiCoachService.getConversation(conversation.id, accessToken);
        }

        if (!mounted) return;
        setConversationId(conversation.id);
        const mapped: ChatMessage[] = (conversation.messages || []).map((m: any) => ({
          id: m.id,
          sender: m.role === 'user' ? 'user' : 'ai',
          text: m.content,
          timestamp: m.createdAt
            ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
        }));
        setMessages(
          mapped.length
            ? mapped
            : [
                {
                  id: 'welcome',
                  sender: 'ai',
                  text: `Hello ${currentUser.firstName || 'there'}! I am your SkillForge AI Engineering Coach.`,
                  timestamp: '',
                },
              ],
        );
      } catch (err: any) {
        if (mounted) setBootError(err?.message || 'Failed to load AI coach.');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accessToken, currentUser.firstName]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isThinking || !conversationId) return;

    const text = inputQuery.trim();
    setInputQuery('');
    setIsThinking(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    try {
      const result = await aiCoachService.sendMessage(conversationId, text, accessToken);
      const assistant = result?.assistantMessage;
      if (assistant) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistant.id,
            sender: 'ai',
            text: assistant.content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: err?.message || 'Could not reach AI coach API.',
          timestamp: '',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🤖</span> SkillForge AI Coach
          <span style={{ fontSize: '11px', background: '#eff6ff', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '2px 8px', borderRadius: '12px' }}>
            NEW
          </span>
        </h1>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
          Conversations persist in the database via `/ai` APIs.
        </p>
        {bootError && <p style={{ color: '#dc2626', fontSize: '12px' }}>{bootError}</p>}
      </header>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', height: '520px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '75%',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  background: msg.sender === 'user' ? '#4f46e5' : '#f8fafc',
                  color: msg.sender === 'user' ? '#fff' : '#0f172a',
                  border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
              >
                {msg.text}
              </div>
              {msg.timestamp && (
                <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{msg.timestamp}</span>
              )}
            </div>
          ))}
          {isThinking && <div style={{ fontSize: '12px', color: '#64748b' }}>AI Coach is thinking...</div>}
        </div>

        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', padding: '16px', borderTop: '1px solid #e2e8f0' }}>
          <input
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask about architecture, APIs, or your learning path..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          />
          <button
            type="submit"
            disabled={isThinking || !conversationId}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 18px', fontWeight: 600, cursor: 'pointer' }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
