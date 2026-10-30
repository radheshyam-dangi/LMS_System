import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { X, Send, ExternalLink, AlertCircle, Sparkles } from 'lucide-react';
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
  onWidthChange?: (width: number) => void;
  initialWidth?: number;
}

const MIN_WIDTH = 360;
// Maximum width stops expanding before crushing the left modal (keeps at least 340px for assessment)
const getMaxWidth = () => Math.min(950, Math.max(MIN_WIDTH, window.innerWidth - 340));

export function AssignmentChatDrawer({
  assignmentId,
  assignmentTitle,
  accessToken,
  onClose,
  isOpen,
  questions,
  focusedQuestionId,
  onWidthChange,
  initialWidth,
}: Props) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Resizable drawer state ───────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (initialWidth && initialWidth >= MIN_WIDTH && initialWidth <= 850) {
      return initialWidth;
    }
    try {
      const saved = localStorage.getItem('skillforge_assignment_chat_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= 850) {
          return parsed;
        }
      }
    } catch {}
    return 440;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringHandle, setIsHoveringHandle] = useState(false);

  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(panelWidth);
  const currentWidthRef = useRef<number>(panelWidth);

  const effectiveToken = accessToken || localStorage.getItem('skillforge_token') || '';

  useEffect(() => {
    if (isOpen) {
      onWidthChange?.(panelWidth);
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

  // ── Drag & Resize listeners ──────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Drawer is anchored to the right viewport edge; dragging left increases drawer width
      const deltaX = dragStartXRef.current - e.clientX;
      const targetWidth = dragStartWidthRef.current + deltaX;
      const clamped = Math.max(MIN_WIDTH, Math.min(getMaxWidth(), targetWidth));
      setPanelWidth(clamped);
      currentWidthRef.current = clamped;
      onWidthChange?.(clamped);
    };

    const suppressClick = () => {
      const preventClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.removeEventListener('click', preventClick, true);
      };
      window.addEventListener('click', preventClick, true);
      setTimeout(() => {
        window.removeEventListener('click', preventClick, true);
      }, 150);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      suppressClick();
      try {
        localStorage.setItem('skillforge_assignment_chat_width', String(currentWidthRef.current));
      } catch {}
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const deltaX = dragStartXRef.current - e.touches[0].clientX;
      const targetWidth = dragStartWidthRef.current + deltaX;
      const clamped = Math.max(MIN_WIDTH, Math.min(getMaxWidth(), targetWidth));
      setPanelWidth(clamped);
      currentWidthRef.current = clamped;
      onWidthChange?.(clamped);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      suppressClick();
      try {
        localStorage.setItem('skillforge_assignment_chat_width', String(currentWidthRef.current));
      } catch {}
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, onWidthChange]);

  const handleHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = panelWidth;
  };

  const handleHandleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    setIsDragging(true);
    dragStartXRef.current = e.touches[0].clientX;
    dragStartWidthRef.current = panelWidth;
  };

  const resetWidth = () => {
    setPanelWidth(440);
    currentWidthRef.current = 440;
    onWidthChange?.(440);
    try {
      localStorage.setItem('skillforge_assignment_chat_width', '440');
    } catch {}
  };

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

  /**
   * Helper to strip asterisks, backticks, hashes, and markdown formatting
   * to ensure a simple, clean, concise plain-text response.
   */
  const cleanPlainText = (str: string): string => {
    if (!str) return '';
    return str
      .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** -> bold
      .replace(/\*([^*]+)\*/g, '$1')     // *italic* -> italic
      .replace(/`([^`]+)`/g, '$1')       // `code` -> code
      .replace(/_{2}([^_]+)_{2}/g, '$1') // __bold__ -> bold
      .replace(/_([^_]+)_/g, '$1')       // _italic_ -> italic
      .replace(/[*`#_~]/g, '')           // stray markdown artifacts
      .trim();
  };

  /**
   * Formats the response content into natural, clean paragraphs:
   * - Eliminates inline "Citations: Review Lesson..." clauses when structured lesson citations are attached
   * - Strips robotic template headers ("Question Objective:", "Socratic Approach:") for natural tutor guidance
   * - Strips asterisks, backticks, and raw formatting symbols for simple, clean reading
   */
  const formatAnswerBody = (body: string, hasSuggestedLessons?: boolean) => {
    if (!body) return null;

    let processed = body;

    // 1. If structured lessons are rendered below, remove redundant inline "Citations: ..." descriptions
    if (hasSuggestedLessons) {
      // Strips "Citations: Review Lesson X..." up until the next section or end
      processed = processed.replace(/(?:^|\s)Citations:\s*(?:Review|Consult|See|Check)?[\s\S]*?(?=(?:Socratic Approach|Socratic Guidance|Question Objective|\n\n|$))/gi, ' ');
    } else {
      // If no structured cards, break inline citations onto its own line
      processed = processed.replace(/(?:^|\s)Citations:\s*/gi, '\n\nRecommended Citations:\n');
    }

    // 2. Break robotic boilerplate markers into natural paragraph breaks
    processed = processed
      .replace(/(?:^|\s)(?:Question Objective|Objective):\s*/gi, '\n\n')
      .replace(/(?:^|\s)(?:Socratic Approach|Socratic Guidance):\s*/gi, '\n\n')
      .replace(/(?:^|\s)(?:Key Concepts?):\s*/gi, '\n\n');

    // 3. Strip asterisks, backticks, and special markdown formatting characters
    processed = cleanPlainText(processed);

    // 4. Split into clean paragraphs
    const rawParagraphs = processed.split(/\n+/);
    const cleanBlocks: string[] = [];

    for (const p of rawParagraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      if (hasSuggestedLessons && /^Citations:\s*/i.test(trimmed)) continue;
      cleanBlocks.push(trimmed);
    }

    if (cleanBlocks.length === 0) {
      return <div className="chat-body-p">{cleanPlainText(body)}</div>;
    }

    return (
      <div className="chat-body-paragraphs">
        {cleanBlocks.map((text, idx) => (
          <p key={idx} className="chat-body-p">
            {text}
          </p>
        ))}
      </div>
    );
  };

  const renderAssistantContent = (content: string, blocked?: boolean) => {
    if (blocked) {
      return (
        <div className="chat-blocked-message">
          <div className="chat-blocked-header">
            <AlertCircle size={15} className="chat-blocked-icon" />
            <span>Scope Notice</span>
          </div>
          <div className="chat-blocked-body">{content}</div>
        </div>
      );
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
              const hasSuggestedLessons = Boolean(ans.suggestedLessons && ans.suggestedLessons.length > 0);

              return (
                <div key={idx} className="chat-answer-block">
                  <div className="chat-answer-header">
                    <div className="chat-q-badge-wrap">
                      <span className="chat-q-badge">{ans.questionId === 'general' ? 'Overview' : `Question ${qNum}`}</span>
                    </div>
                  </div>

                  <div className="chat-answer-body">
                    {formatAnswerBody(ans.content, hasSuggestedLessons)}
                  </div>
                  
                  {ans.coverage === 'weak' && (
                    <div className="chat-coverage-warning">Note: The module lessons don't explicitly cover this in depth.</div>
                  )}

                  {hasSuggestedLessons && (
                    <div className="chat-lesson-suggestions">
                      <div className="chat-citation-links">
                        {ans.suggestedLessons.map((item: any, sIdx: number) => {
                          const itemTitle = typeof item === 'string' ? item : item.lessonTitle || item.title || 'Lesson';
                          const itemUrl = typeof item === 'object' && item.url ? item.url : null;

                          if (itemUrl) {
                            return (
                              <a
                                key={sIdx}
                                href={itemUrl}
                                className="chat-citation-pill"
                                title={`Open ${itemTitle}`}
                                onClick={(e) => {
                                  if (!e.ctrlKey && !e.metaKey) {
                                    e.preventDefault();
                                    navigate(itemUrl);
                                  }
                                }}
                              >
                                <span className="chat-pill-title">{itemTitle}</span>
                                <ExternalLink size={12} className="chat-pill-icon" />
                              </a>
                            );
                          }

                          return (
                            <span key={sIdx} className="chat-citation-pill chat-citation-pill-static" title={itemTitle}>
                              <span className="chat-pill-title">{itemTitle}</span>
                            </span>
                          );
                        })}
                      </div>
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
    return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{cleanPlainText(content)}</div>;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Transparent full-screen shield while dragging to isolate mouse events from underlying elements */}
      {isDragging && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            cursor: 'col-resize',
            userSelect: 'none',
            background: 'transparent',
          }}
        />
      )}
      <div className={`assignment-chat-overlay ${isOpen ? 'open' : ''}`}>
        <div
          className={`assignment-chat-drawer ${isOpen ? 'open' : ''} ${isDragging ? 'is-dragging' : ''}`}
          style={{ width: `${panelWidth}px` }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Left Edge Border Handle with col-resize cursor ──────────────── */}
          <div
            className={`chat-resize-handle ${isHoveringHandle || isDragging ? 'active' : ''}`}
            onMouseDown={handleHandleMouseDown}
            onTouchStart={handleHandleTouchStart}
            onMouseEnter={() => setIsHoveringHandle(true)}
            onMouseLeave={() => setIsHoveringHandle(false)}
            onDoubleClick={resetWidth}
            title="Drag to resize drawer width (Double-click to reset)"
            role="separator"
            aria-orientation="vertical"
          >
            <div className="chat-handle-indicator">
              <span />
              <span />
              <span />
            </div>
          </div>

          {/* ── Drawer Header ──────────────────────────────────────────────── */}
          <div className="chat-header">
            <div className="chat-header-title">
              <div>
                <h3>Assignment Assistant</h3>
                <span title={assignmentTitle}>{assignmentTitle}</span>
              </div>
            </div>
            <div className="chat-header-actions">
              <button
                type="button"
                className="chat-header-icon-btn chat-close-btn"
                onClick={onClose}
                title="Close Assistant"
              >
                <X size={18} />
              </button>
            </div>
          </div>

        {/* ── Chat Messages ──────────────────────────────────────────────── */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty-state">
              <div className="chat-empty-avatar">
                <Sparkles size={24} style={{ color: '#4f46e5' }} />
              </div>
              <h4>Assignment Concept Assistant</h4>
              <p>Ask questions about any problem to review core concepts, principles, and prerequisite lessons.</p>
              <div className="chat-empty-hint">
                <Sparkles size={13} style={{ color: '#4f46e5' }} />
                <span>I provide guided conceptual reasoning without giving away direct test answers.</span>
              </div>
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

        {/* ── Chat Input Area ────────────────────────────────────────────── */}
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
              placeholder="Ask about concepts, approaches, or prerequisites..."
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
            <button
              type="button"
              className="chat-send-btn"
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              title="Send question"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

