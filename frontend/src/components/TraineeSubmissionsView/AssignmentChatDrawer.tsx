import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bot, X, Send, BookOpen } from 'lucide-react';
import { API_BASE_URL } from '../../api';
import './AssignmentChatDrawer.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  questionIds?: string[];
  lessonIds?: string[];
  blocked?: boolean;
}

interface Props {
  assignmentId: string;
  assignmentTitle: string;
  accessToken: string;
  onClose: () => void;
  isOpen: boolean;
  questions: any[];
  focusedQuestionId?: string | null;
}

export function AssignmentChatDrawer({
  assignmentId,
  assignmentTitle,
  accessToken,
  onClose,
  isOpen,
  questions,
  focusedQuestionId,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const effectiveToken = accessToken || localStorage.getItem('skillforge_access_token') || localStorage.getItem('token') || '';

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, assignmentId]);

  useEffect(() => {
    if (focusedQuestionId !== undefined && focusedQuestionId !== null) {
      setSelectedQuestions([String(focusedQuestionId)]);
    }
  }, [focusedQuestionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/assignments/${assignmentId}/chat`, {
        headers: {
          'Authorization': `Bearer ${effectiveToken}`
        }
      });
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to fetch chat history', e);
    }
  };

  const sendMessage = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || input;
    if (!textToSend.trim() || isLoading) return;
    setInput('');
    setIsLoading(true);

    const tempId = Date.now().toString();
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: textToSend, questionIds: selectedQuestions }]);

    try {
      const res = await axios.post(`${API_BASE_URL}/assignments/${assignmentId}/chat`, {
        message: textToSend, 
        focusQuestionIds: selectedQuestions
      }, {
        headers: {
          'Authorization': `Bearer ${effectiveToken}`
        }
      });

      setMessages(prev => [...prev.filter(m => m.id !== tempId), res.data]);
      void fetchHistory(); // sync full history to be safe
    } catch (e: any) {
      console.error(e);
      const errMsg = e.response?.data?.message || 'Failed to send message';
      setMessages(prev => [...prev.filter(m => m.id !== tempId), { id: tempId + '-err', role: 'assistant', content: `Error: ${errMsg}`, blocked: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAssistantContent = (content: string, blocked?: boolean) => {
    if (blocked) {
      return <div className="chat-blocked-message">{content}</div>;
    }
    try {
      let parsed = JSON.parse(content);
      if (parsed && !Array.isArray(parsed)) {
        parsed = parsed.responses || parsed.data || [parsed];
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        return (
          <div className="chat-structured-response">
            {parsed.map((ans: any, idx: number) => {
              const qObj = questions.find(
                q => String(q.id) === String(ans.questionId) || String(questions.indexOf(q)) === String(ans.questionId)
              );
              const qNum = qObj ? questions.indexOf(qObj) + 1 : (ans.questionNumber || (idx + 1));
              const title = ans.questionId === 'general' ? 'Assignment Overview Guidance' : `Question ${qNum} Guidance`;

              return (
                <div key={idx} className="chat-answer-block">
                  <div className="chat-answer-header">{title}</div>
                  <div className="chat-answer-body" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                    {ans.content}
                  </div>
                  
                  {ans.coverage === 'weak' && (
                    <div className="chat-coverage-warning">Note: The module lessons don't explicitly cover this in depth.</div>
                  )}
                  {ans.suggestedLessons && ans.suggestedLessons.length > 0 && (
                    <div className="chat-lesson-suggestions">
                      <span className="chat-lesson-icon"><BookOpen size={14} /></span>
                      <span style={{ fontWeight: 600 }}>Prerequisite Lessons:</span> {ans.suggestedLessons.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      }
    } catch (e) {
      // not JSON
    }
    return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{content}</div>;
  };

  if (!isOpen) return null;

  return (
    <div className={`assignment-chat-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className={`assignment-chat-drawer ${isOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="chat-header">
          <div className="chat-header-title">
            <Bot size={20} color="#4f46e5" />
            <div>
              <h3>Assignment Assistant</h3>
              <span>{assignmentTitle}</span>
            </div>
          </div>
          <button className="chat-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty-state">
              <Bot size={48} color="#cbd5e1" />
              <p>Hi! I'm here to help you understand the requirements and concepts for this assignment.</p>
              <p className="chat-empty-note">I cannot give you the answers, but I can guide you to the right lessons.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={msg.id || i} className={`chat-message ${msg.role}`}>
              <div className="chat-message-bubble">
                {msg.role === 'assistant' ? renderAssistantContent(msg.content, msg.blocked) : msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chat-message assistant">
              <div className="chat-message-bubble typing-indicator">
                <span>.</span><span>.</span><span>.</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {questions.length > 0 && (
            <div className="chat-question-selector">
              <span className="selector-label">Focus on:</span>
              <button
                type="button"
                className={`question-chip ${selectedQuestions.length === 0 ? 'active' : ''}`}
                onClick={() => setSelectedQuestions([])}
              >All</button>
              {questions.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  className={`question-chip ${selectedQuestions.includes(q.id || String(i)) ? 'active' : ''}`}
                  onClick={() => {
                    const qId = q.id || String(i);
                    setSelectedQuestions(prev =>
                      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
                    );
                  }}
                >
                  Q{i + 1}
                </button>
              ))}
            </div>
          )}

          {/* Quick Prompts */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={() => {
                const targetQ = selectedQuestions.length > 0 ? `for ${selectedQuestions.map(id => {
                  const qIdx = questions.findIndex(q => String(q.id) === String(id) || String(questions.indexOf(q)) === String(id));
                  return qIdx >= 0 ? `Question ${qIdx + 1}` : id;
                }).join(', ')}` : '';
                sendMessage(`What are the key requirements and concepts ${targetQ}?`);
              }}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              💡 Concepts
            </button>
            <button
              type="button"
              onClick={() => {
                sendMessage('Which dependent lessons should I review for this?');
              }}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              📚 Dependent Lessons
            </button>
            <button
              type="button"
              onClick={() => {
                sendMessage('How should I structure my answer?');
              }}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              📝 Approach
            </button>
          </div>

          <div className="chat-input-wrapper">
            <textarea
              placeholder="Ask for an explanation of concepts..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={2}
            />
            <button className="chat-send-btn" onClick={() => sendMessage()} disabled={isLoading || !input.trim()}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
