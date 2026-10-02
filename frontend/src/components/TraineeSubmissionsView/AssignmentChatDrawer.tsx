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
}

export function AssignmentChatDrawer({ assignmentId, assignmentTitle, accessToken, onClose, isOpen, questions }: Props) {

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, assignmentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/assignments/${assignmentId}/chat`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      setMessages(res.data);
    } catch (e) {
      console.error('Failed to fetch chat history', e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input;
    setInput('');
    setIsLoading(true);

    const tempId = Date.now().toString();
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: userMsg, questionIds: selectedQuestions }]);

    try {
      const res = await axios.post(`${API_BASE_URL}/assignments/${assignmentId}/chat`, {
        message: userMsg, 
        focusQuestionIds: selectedQuestions
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      setMessages(prev => [...prev.filter(m => m.id !== tempId), res.data]);
      fetchHistory(); // sync full history to be safe
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
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return (
          <div className="chat-structured-response">
            {parsed.map((ans: any, idx: number) => {
              const qObj = questions.find(q => q.id === ans.questionId || String(questions.indexOf(q)) === ans.questionId);
              const qNum = qObj ? questions.indexOf(qObj) + 1 : '?';

              return (
                <div key={idx} className="chat-answer-block">
                  <div className="chat-answer-header">Question {qNum}</div>
                  <div className="chat-answer-body">{ans.content}</div>
                  
                  {ans.coverage === 'weak' && (
                    <div className="chat-coverage-warning">Note: The lessons don't explicitly cover this in depth.</div>
                  )}
                  {ans.suggestedLessons && ans.suggestedLessons.length > 0 && (
                    <div className="chat-lesson-suggestions">
                      <span className="chat-lesson-icon"><BookOpen size={14} /></span>
                      Review lessons: {ans.suggestedLessons.join(', ')}
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
    return <div>{content}</div>;
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
            <button className="chat-send-btn" onClick={sendMessage} disabled={isLoading || !input.trim()}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
