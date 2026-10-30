import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  X,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from 'lucide-react';
import {
  useTrainerAiAssistant,
  type TrainerMessage,
} from './useTrainerAiAssistant';
import { TrainerActionCard } from './TrainerActionCard';
import '../ai-assistant/GlobalAiAssistant.css';

const TRAINER_SUGGESTED_PROMPTS = [
  'What Learning Paths do I have?',
  'Create LP: Cloud Architecture with Docker & Kubernetes',
  'Create LP: Full Stack Development with React & Node',
];

function cleanText(text: string): string {
  if (!text) return '';
  return text
    // Strip database IDs, UUIDs, and internal identifiers (e.g. "- ID: 0ba216e6-...", "ID: ...", "(ID: ...)")
    .replace(/\s*[-–—]?\s*\(?\b(?:ID|id|UUID|uuid)\s*[:=]\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b\)?/gi, '')
    // Strip standalone UUIDs
    .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '')
    // Clean up trailing "- ID:" or "- ID" leftovers
    .replace(/\s*[-–—]\s*(?:ID|id)\s*[:=]?\s*$/gm, '')
    // Strip emojis and miscellaneous symbols
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}\u{23E9}-\u{23EC}\u{23F0}\u{23F3}\u{2B50}\u{2B55}\u{2934}\u{2935}]/gu,
      '',
    )
    // Strip decorative divider lines
    .replace(/^[=\-─_~*#]{3,}$/gm, '')
    // Convert markdown header hashtags (#, ##, ###) into clean bold text (**Header**)
    .replace(/^#{1,6}\s*(.+)$/gm, '**$1**')
    // Replace pipe delimiters (| or ||) with commas
    .replace(/\s*\|{1,2}\s*/g, ', ')
    // Remove backslashes
    .replace(/\\([_*\-#`~[\]()\\/])/g, '$1')
    .replace(/\\+/g, '')
    // Clean up slash delimiters (e.g. " / ")
    .replace(/\s+\/\s+/g, ', ')
    // Clean up consecutive commas
    .replace(/,\s*,+/g, ',')
    .replace(/^,\s+/gm, '')
    .replace(/,\s*$/gm, '')
    .trim();
}

function renderMarkdown(text: string): React.ReactNode {
  const cleaned = cleanText(text);
  const lines = cleaned.split('\n');

  return lines.map((line, i) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={i} style={{ height: '4px' }} />;
    }

    // Headings (###, ##, #)
    if (trimmed.startsWith('### ')) {
      return (
        <div key={i} style={{ margin: '8px 0 3px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
          {formatInline(trimmed.slice(4))}
        </div>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <div key={i} style={{ margin: '10px 0 4px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
          {formatInline(trimmed.slice(3))}
        </div>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <div key={i} style={{ margin: '12px 0 5px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
          {formatInline(trimmed.slice(2))}
        </div>
      );
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      return (
        <blockquote
          key={i}
          style={{
            margin: '6px 0',
            padding: '6px 12px',
            borderLeft: '3px solid #6366f1',
            background: '#f8fafc',
            color: '#475569',
            fontSize: '12.5px',
            borderRadius: '0 6px 6px 0',
          }}
        >
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
    }

    // Bullet points (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '2px 0' }}>
          <span style={{ color: '#6366f1', fontSize: '11px', lineHeight: '1.6' }}>•</span>
          <span style={{ flex: 1 }}>{formatInline(trimmed.replace(/^[-*]\s+/, ''))}</span>
        </div>
      );
    }

    // Numbered lists (1. , 2. )
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '2px 0' }}>
          <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, minWidth: '16px' }}>
            {numberedMatch[1]}.
          </span>
          <span style={{ flex: 1 }}>{formatInline(numberedMatch[2])}</span>
        </div>
      );
    }

    return (
      <div key={i} style={{ margin: '2px 0' }}>
        {formatInline(line)}
      </div>
    );
  });
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      const isExternal = url.startsWith('http://') || url.startsWith('https://');
      return (
        <a
          key={i}
          href={url}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="gai-inline-link"
        >
          {label}
        </a>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

// ─── Message Bubble ──────────────────────────────────────────────────────────
function TrainerMessageBubble({
  msg,
  onFeedback,
  onConfirmAction,
  onCancelAction,
  onCloseDrawer,
}: {
  msg: TrainerMessage;
  onFeedback: (messageId: string, v: 'thumbs_up' | 'thumbs_down') => void;
  onConfirmAction: (actionId: string) => Promise<any>;
  onCancelAction: (actionId: string) => Promise<any>;
  onCloseDrawer?: () => void;
}) {
  const [localFeedback, setLocalFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(
    msg.feedback || null,
  );

  if (msg.role === 'user') {
    return (
      <div className="gai-msg gai-msg-user">
        <div className="gai-bubble-user">{msg.content}</div>
      </div>
    );
  }

  const handleFeedback = (v: 'thumbs_up' | 'thumbs_down') => {
    const next = localFeedback === v ? null : v;
    setLocalFeedback(next);
    if (next) {
      onFeedback(msg.id, next);
    }
  };

  return (
    <div className="gai-msg gai-msg-assistant" aria-live="polite">
      {msg.isLoading ? (
        <div className="gai-bubble-assistant">
          <div className="gai-loading-dots" aria-label="AI is thinking">
            <div className="gai-loading-dot" />
            <div className="gai-loading-dot" />
            <div className="gai-loading-dot" />
          </div>
        </div>
      ) : (
        <>
          <div className="gai-bubble-assistant">
            {renderMarkdown(msg.content)}
          </div>

          {msg.actionCard && (
            <TrainerActionCard
              card={msg.actionCard}
              onConfirm={onConfirmAction}
              onCancel={onCancelAction}
              onCloseDrawer={onCloseDrawer}
            />
          )}

          {!msg.id.startsWith('temp') && (
            <div className="gai-feedback-row" aria-label="Rate this response">
              <span className="gai-feedback-label">Helpful?</span>
              <button
                className={`gai-feedback-btn ${localFeedback === 'thumbs_up' ? 'active-like' : ''}`}
                onClick={() => handleFeedback('thumbs_up')}
                aria-label="Thumbs up"
                title="Helpful"
              >
                <ThumbsUp size={12} fill={localFeedback === 'thumbs_up' ? 'currentColor' : 'none'} />
              </button>
              <button
                className={`gai-feedback-btn ${localFeedback === 'thumbs_down' ? 'active-dislike' : ''}`}
                onClick={() => handleFeedback('thumbs_down')}
                aria-label="Thumbs down"
                title="Not helpful"
              >
                <ThumbsDown size={12} fill={localFeedback === 'thumbs_down' ? 'currentColor' : 'none'} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Drawer Component ─────────────────────────────────────────────────
export interface TrainerAiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  activeLpId?: string | null;
  onLpUpgraded?: () => void;
}

export const TrainerAiAssistantDrawer: React.FC<TrainerAiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  accessToken,
  activeLpId,
  onLpUpgraded,
}) => {
  const {
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
  } = useTrainerAiAssistant(accessToken);

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef(false);

  // Responsive: detect mobile (< 768px)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── Resizable Width Management (Desktop) ──────────────────────────────
  const MIN_WIDTH = 320;
  const getMaxWidth = () => {
    if (typeof window === 'undefined') return 720;
    return Math.min(Math.floor(window.innerWidth * 0.52), 720);
  };

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('skillforge_ai_drawer_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 320) {
          return Math.min(parsed, 720);
        }
      }
    } catch {
      // fallback
    }
    return 390;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringHandle, setIsHoveringHandle] = useState(false);
  const hasUserCustomizedWidthRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(panelWidth);
  const currentWidthRef = useRef(panelWidth);
  currentWidthRef.current = panelWidth;

  // Global Mouse & Touch Drag Handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = dragStartXRef.current - e.clientX;
      const targetWidth = dragStartWidthRef.current + deltaX;
      const clamped = Math.max(MIN_WIDTH, Math.min(getMaxWidth(), targetWidth));
      setPanelWidth(clamped);
      currentWidthRef.current = clamped;
      hasUserCustomizedWidthRef.current = true;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      try {
        localStorage.setItem('skillforge_ai_drawer_width', String(currentWidthRef.current));
      } catch {
        // non-fatal
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const deltaX = dragStartXRef.current - e.touches[0].clientX;
      const targetWidth = dragStartWidthRef.current + deltaX;
      const clamped = Math.max(MIN_WIDTH, Math.min(getMaxWidth(), targetWidth));
      setPanelWidth(clamped);
      currentWidthRef.current = clamped;
      hasUserCustomizedWidthRef.current = true;
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      try {
        localStorage.setItem('skillforge_ai_drawer_width', String(currentWidthRef.current));
      } catch {
        // non-fatal
      }
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
  }, [isDragging]);

  const handleHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
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
    setPanelWidth(390);
    try {
      localStorage.setItem('skillforge_ai_drawer_width', '390');
    } catch {
      // non-fatal
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // On drawer open: Always default to a clean, fresh new chat session without showing past history
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      startNewConversation();
      void loadConversations();
      setShowHistory(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, startNewConversation, loadConversations]);

  // Click outside listener for the top conversation switcher dropdown
  useEffect(() => {
    if (!showHistory) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleConfirmAction = useCallback(
    async (actionId: string) => {
      const res = await confirmAction(actionId);
      if (onLpUpgraded) onLpUpgraded();
      return res;
    },
    [confirmAction, onLpUpgraded],
  );

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    const res = await sendMessage(q, activeLpId);
    if (res?.upgradedLpId && onLpUpgraded) {
      if (!activeLpId || res.upgradedLpId === activeLpId) {
        onLpUpgraded();
      }
    }
  }, [input, isLoading, sendMessage, activeLpId, onLpUpgraded]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  if (!isEnabled) return null;

  const dynamicPrompts = activeLpId
    ? [
        'Add a lesson on Kafka to Module 2',
        'Add an MCQ question to Module 1 assessment',
        'Summarize the in-depth nodes and topics in this path',
      ]
    : TRAINER_SUGGESTED_PROMPTS;

  // ── Shared Panel Inner Content ──────────────────────────────────────────
  const panelContent = (
    <>
      {/* Header */}
      <div className="gai-header">
        <div className="gai-header-text">
          <h3>{activeLpId ? 'Curriculum Assistant' : 'Trainer Assistant'}</h3>
          {activeLpId && (
            <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>
              ● Studio Mode
            </span>
          )}
        </div>
        <div className="gai-header-actions">
          <button
            className="gai-icon-btn"
            onClick={() => setShowHistory((p) => !p)}
            title="Conversation history"
            aria-label="Toggle conversation history"
            aria-expanded={showHistory}
          >
            <MessageSquare size={16} />
          </button>
          <button
            className="gai-icon-btn"
            onClick={() => {
              startNewConversation();
              setShowHistory(false);
            }}
            title="Start new conversation"
            aria-label="Start new conversation"
          >
            <Plus size={16} />
          </button>
          <button
            className="gai-icon-btn"
            onClick={onClose}
            title="Collapse (Esc)"
            aria-label="Collapse AI Assistant"
            id="gai-close-btn"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Previous Conversation Dropdown Menu (only visible when user clicks MessageSquare in header) */}
      {showHistory && (
        <div className="gai-conv-dropdown-menu" ref={switcherRef} role="dialog" aria-label="Previous Conversations">
          <div className="gai-conv-dropdown-header">
            <span>Conversation History ({conversations.length})</span>
            <button
              type="button"
              className="gai-dropdown-close-btn"
              onClick={() => setShowHistory(false)}
              aria-label="Close conversation menu"
            >
              <X size={14} />
            </button>
          </div>

          {/* Start Clean Chat Option */}
          <button
            type="button"
            className={`gai-dropdown-new-chat-btn ${!conversationId && messages.length === 0 ? 'is-active' : ''}`}
            onClick={() => {
              startNewConversation();
              setShowHistory(false);
            }}
          >
            <div className="gai-new-chat-icon-box">
              <Plus size={14} />
            </div>
            <div className="gai-new-chat-label-box">
              <span className="gai-new-chat-title">Start Clean Chat</span>
              <span className="gai-new-chat-sub">Zero history, fresh model prompt</span>
            </div>
            {!conversationId && messages.length === 0 && (
              <span className="gai-active-indicator">CURRENT</span>
            )}
          </button>

          <div className="gai-conv-divider" />

          {/* Scrollable list of past conversations */}
          <div className="gai-conv-scroll-list" role="list">
            {conversations.length === 0 ? (
              <div className="gai-no-convs">
                No saved consultations yet.
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conversationId === conv.id;
                const formattedDate = conv.updatedAt
                  ? new Date(conv.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '';
                return (
                  <div
                    key={conv.id}
                    className={`gai-conv-card ${isActive ? 'is-active' : ''}`}
                    role="listitem"
                    onClick={() => {
                      loadConversation(conv.id);
                      setShowHistory(false);
                    }}
                  >
                    <div className="gai-conv-card-content">
                      <div className="gai-conv-card-title-row">
                        <MessageSquare size={13} className="gai-card-icon" />
                        <span className="gai-conv-card-title" title={conv.title}>
                          {conv.title || 'Consultation'}
                        </span>
                        {isActive && <span className="gai-active-indicator">ACTIVE</span>}
                      </div>
                      <div className="gai-conv-card-meta">
                        {conv.messageCount ? (
                          <span>{conv.messageCount} messages</span>
                        ) : null}
                        {conv.messageCount && formattedDate ? <span>•</span> : null}
                        {formattedDate && <span>{formattedDate}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="gai-conv-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      aria-label={`Delete consultation: ${conv.title}`}
                      title="Delete consultation"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="gai-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* Messages: Independent scrolling container */}
      <div
        className="gai-messages"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.length === 0 ? (
          <div className="gai-empty">
            <h4>{activeLpId ? 'Studio Curriculum Assistant' : 'Your Curriculum Assistant'}</h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 12px 0' }}>
              {activeLpId
                ? 'Ask about this curriculum or type commands to add lessons, questions, or upgrade nodes.'
                : 'Ask questions about your courses or generate new comprehensive curricula.'}
            </p>
            <div className="gai-suggestions" role="list">
              {dynamicPrompts.map((prompt) => (
                <button
                  key={prompt}
                  className="gai-suggestion-btn"
                  role="listitem"
                  onClick={() => {
                    setInput(prompt);
                    textareaRef.current?.focus();
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <TrainerMessageBubble
              key={msg.id}
              msg={msg}
              onFeedback={submitFeedback}
              onConfirmAction={handleConfirmAction}
              onCancelAction={cancelAction}
              onCloseDrawer={onClose}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="gai-input-area">
        <div className="gai-input-row">
          <textarea
            ref={textareaRef}
            className="gai-textarea"
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={
              activeLpId
                ? "Command an upgrade (e.g. 'Add a lesson on Kafka to Module 2') or ask about this path…"
                : "Ask about your paths or type 'Create LP: [Title]'…"
            }
            rows={1}
            disabled={isLoading}
            aria-label="Ask a question or create LP"
            id="gai-trainer-input"
          />
          <button
            className="gai-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="gai-input-hint">
          Shift+Enter for new line || Esc to collapse
        </p>
      </div>
    </>
  );

  // ── MOBILE VIEW (< 768px): Modal Overlay & Bottom Sheet ──────────────
  if (isMobile) {
    if (!isOpen) return null;
    return createPortal(
      <>
        <div className="gai-overlay" onClick={onClose} aria-hidden="true" />
        <div
          ref={drawerRef}
          className="gai-drawer gai-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Trainer AI Assistant"
          id="trainer-ai-assistant-drawer"
        >
          {panelContent}
        </div>
      </>,
      document.body,
    );
  }

  // ── DESKTOP VIEW: Docked Resizable Panel with Slider Handle ───────────
  if (!isOpen) {
    return null;
  }

  return (
    <aside
      ref={drawerRef}
      className={`gai-resizable-panel ${isDragging ? 'is-dragging' : ''}`}
      style={{
        width: `${panelWidth}px`,
      }}
      role="complementary"
      aria-label="Trainer AI Assistant"
      id="trainer-ai-assistant-panel"
    >
      {/* Draggable & Hoverable Left Border Handle for Pure Resizing */}
      <div
        className={`gai-resize-handle ${isHoveringHandle || isDragging ? 'active' : ''}`}
        onMouseDown={handleHandleMouseDown}
        onTouchStart={handleHandleTouchStart}
        onMouseEnter={() => setIsHoveringHandle(true)}
        onMouseLeave={() => setIsHoveringHandle(false)}
        title="Drag to resize panel (Double click to reset)"
        onDoubleClick={resetWidth}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={panelWidth}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={getMaxWidth()}
      >
        <div className="gai-handle-indicator">
          <span />
          <span />
          <span />
        </div>
      </div>

      {panelContent}
    </aside>
  );
};

export default TrainerAiAssistantDrawer;
