
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  X,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Globe,
  BookOpen,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from 'lucide-react';
import { useAiAssistant, type Message, type Citation } from './useAiAssistant';
import './GlobalAiAssistant.css';

const SUGGESTED_PROMPTS = [
  'What should I study next in my Learning Path?'
  
];

// ─── Simple markdown renderer (avoids a library dependency) ─────────────────
function renderMarkdown(text: string): React.ReactNode {
  // Bold, italic, blockquote, inline code — no external deps needed
  const lines = text.split('\n');
  return lines.map((line, i) => {
    let node: React.ReactNode = line;

    // Blockquote
    if (line.startsWith('> ')) {
      return <blockquote key={i}>{formatInline(line.slice(2))}</blockquote>;
    }

    return (
      <React.Fragment key={i}>
        {formatInline(line)}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

function formatInline(text: string): React.ReactNode {
  // Regex matches markdown links [text](url), bold **text**, inline code `text`, and italic *text*
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    // Markdown link: [label](url)
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

// ─── Citation chip (clickable for both LP & Web in blue theme) ─────────────
function CitationChip({ citation }: { citation: Citation }) {
  if (citation.type === 'web' && citation.url) {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        className="gai-citation-chip"
        title={citation.title || citation.url}
      >
        <ExternalLink size={12} className="gai-chip-icon" />
        <span className="gai-chip-title">{citation.title || 'Web Reference'}</span>
      </a>
    );
  }

  // Learning Path citation
  const targetUrl = citation.url || (citation.lessonId ? '/learning-paths' : undefined);
  if (targetUrl) {
    return (
      <a
        href={targetUrl}
        className="gai-citation-chip"
        title={citation.preview || citation.lessonTitle || 'Course Lesson'}
      >
        <BookOpen size={12} className="gai-chip-icon" />
        <span className="gai-chip-title">{citation.lessonTitle || 'Course Lesson'}</span>
      </a>
    );
  }

  return (
    <span
      className="gai-citation-chip"
      title={citation.preview || citation.lessonTitle || 'Course Lesson'}
    >
      <BookOpen size={12} className="gai-chip-icon" />
      <span className="gai-chip-title">{citation.lessonTitle || 'Course Lesson'}</span>
    </span>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  onFeedback,
}: {
  msg: Message;
  onFeedback: (messageId: string, v: 'thumbs_up' | 'thumbs_down') => void;
}) {
  const [localFeedback, setLocalFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(
    msg.feedback || null
  );

  // Strip any internal "Source: ..." text inside answer body so references only show below
  const cleanContent = useMemo(() => {
    return msg.content
      .replace(/\n*Source:\s*(\[[^\]]+\]\([^)]+\)(?:,\s*)?)+/gi, '')
      .replace(/\n*Source:\s*.*$/gim, '')
      .trim();
  }, [msg.content]);

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
            {renderMarkdown(cleanContent)}
          </div>

          {/* Citations below the bubble with clickable link & effective title */}
          {msg.citations && msg.citations.length > 0 && (
            <div className="gai-citations" role="list" aria-label="Sources">
              {msg.citations.map((c, i) => (
                <CitationChip key={i} citation={c} />
              ))}
            </div>
          )}

          {/* Feedback buttons with very light default style and clear active colors */}
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
interface GlobalAiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  activeAssignmentId?: string; // if Assignment workspace is open
}

function GlobalAiAssistantDrawer({
  isOpen,
  onClose,
  accessToken,
  activeAssignmentId,
}: GlobalAiAssistantProps) {
  const {
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
  } = useAiAssistant(accessToken);

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

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

  // Dynamic expansion for code blocks or wide content if user hasn't explicitly set width
  useEffect(() => {
    if (!hasUserCustomizedWidthRef.current && isOpen) {
      const hasCodeBlocks = messages.some((m) => m.content.includes('```'));
      if (hasCodeBlocks && panelWidth < 460) {
        const target = Math.min(480, getMaxWidth());
        setPanelWidth(target);
        currentWidthRef.current = target;
      }
    }
  }, [messages, panelWidth, isOpen]);

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

  // Load conversation list when history panel opens
  useEffect(() => {
    if (showHistory && isOpen) {
      loadConversations();
    }
  }, [showHistory, isOpen, loadConversations]);

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

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput('');
    await sendMessage(q, { activeAssignmentId });
  }, [input, isLoading, sendMessage, activeAssignmentId]);

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

  // ── Shared Panel Inner Content ──────────────────────────────────────────
  const panelContent = (
    <>
      {/* Header */}
      <div className="gai-header">
      
        <div className="gai-header-text">
          <h3>AI Assistant</h3>
          
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
            onClick={startNewConversation}
            title="New conversation"
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

      {/* Conversation history dropdown */}
      {showHistory && (
        <div className="gai-conv-list" role="list" aria-label="Recent conversations">
          {conversations.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`gai-conv-item ${conversationId === conv.id ? 'active' : ''}`}
                role="listitem"
                onClick={() => {
                  loadConversation(conv.id);
                  setShowHistory(false);
                }}
              >
                <span className="gai-conv-title" title={conv.title}>
                  {conv.title || 'Conversation'}
                </span>
                <button
                  className="gai-conv-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  aria-label={`Delete conversation: ${conv.title}`}
                  title="Delete conversation"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
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
       
            <h4>Your AI  Assistant</h4>
          
            <div className="gai-suggestions" role="list">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="gai-suggestion-btn"
                  role="listitem"
                  onClick={() => {
                    setInput(prompt.replace(/^[^\s]+ /, ''));
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
            <MessageBubble
              key={msg.id}
              msg={msg}
              onFeedback={submitFeedback}
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
            placeholder="Ask about your Learning Path…"
            rows={1}
            disabled={isLoading}
            aria-label="Ask a question"
            id="gai-input"
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
         Shift+Enter for new line ||  Esc to collapse
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
          aria-label="AI Assistant"
          id="global-ai-assistant-drawer"
        >
          {panelContent}
        </div>
      </>,
      document.body,
    );
  }

  // ── DESKTOP VIEW ────────────────────────────────────────────────────────
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
      aria-label="AI Learning Assistant"
      id="global-ai-assistant-panel"
    >
      {/* Draggable & Hoverable Left Border Handle for Pure Resizing */}
      <div
        className={`gai-resize-handle ${isHoveringHandle || isDragging ? 'active' : ''}`}
        onMouseDown={handleHandleMouseDown}
        onTouchStart={handleHandleTouchStart}
        onMouseEnter={() => setIsHoveringHandle(true)}
        onMouseLeave={() => setIsHoveringHandle(false)}
        title=""
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
}

// ─── Public export — lazy-loadable from AppLayout ─────────────────────────
export default GlobalAiAssistantDrawer;
