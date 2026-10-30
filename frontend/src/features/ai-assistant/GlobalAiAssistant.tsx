
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

// ─── Text & Markdown Sanitizer and Renderer ────────────────────────────────
function cleanText(text: string): string {
  if (!text) return '';
  return text
    // Strip database IDs, UUIDs, and internal identifiers (e.g. "- ID: 0ba216e6-...", "ID: ...", "(ID: ...)")
    .replace(/\s*[-–—]?\s*\(?\b(?:ID|id|UUID|uuid)\s*[:=]\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b\)?/gi, '')
    // Strip standalone UUIDs
    .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '')
    // Clean up trailing "- ID:" or "- ID" leftovers
    .replace(/\s*[-–—]\s*(?:ID|id)\s*[:=]?\s*$/gm, '')
    // Strip emojis & unicode decorative symbols
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{3030}\u{303D}\u{3297}\u{3299}\u{FE0F}]/gu,
      ''
    )
    // Strip decorative ASCII divider lines
    .replace(/^[=\-─*_#]{3,}\s*$/gm, '')
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

function renderMarkdown(rawText: string): React.ReactNode {
  const text = cleanText(rawText);
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`list-${elements.length}`} style={{ margin: '6px 0', paddingLeft: '20px' }}>
            {currentList.items.map((it, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{it}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${elements.length}`} style={{ margin: '6px 0', paddingLeft: '20px' }}>
            {currentList.items.map((it, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{it}</li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    // Headings: ###, ##, #
    const h3Match = line.match(/^###\s+(.*)$/);
    if (h3Match) {
      flushList();
      elements.push(
        <h4 key={`h3-${i}`} style={{ fontSize: '13px', fontWeight: 700, margin: '10px 0 4px', color: 'inherit' }}>
          {formatInline(h3Match[1])}
        </h4>
      );
      continue;
    }

    const h2Match = line.match(/^##\s+(.*)$/);
    if (h2Match) {
      flushList();
      elements.push(
        <h3 key={`h2-${i}`} style={{ fontSize: '14px', fontWeight: 700, margin: '12px 0 5px', color: 'inherit' }}>
          {formatInline(h2Match[1])}
        </h3>
      );
      continue;
    }

    const h1Match = line.match(/^#\s+(.*)$/);
    if (h1Match) {
      flushList();
      elements.push(
        <h2 key={`h1-${i}`} style={{ fontSize: '15px', fontWeight: 800, margin: '14px 0 6px', color: 'inherit' }}>
          {formatInline(h1Match[1])}
        </h2>
      );
      continue;
    }

    // Unordered List: * or -
    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(formatInline(ulMatch[1]));
      continue;
    }

    // Ordered List: 1. 2. etc
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(formatInline(olMatch[1]));
      continue;
    }

    // Blockquote: >
    if (line.startsWith('>')) {
      flushList();
      elements.push(
        <blockquote key={`quote-${i}`} style={{ borderLeft: '3px solid #2563eb', paddingLeft: '8px', margin: '6px 0', opacity: 0.9, fontStyle: 'italic' }}>
          {formatInline(line.replace(/^>\s*/, ''))}
        </blockquote>
      );
      continue;
    }

    // Normal paragraph line
    flushList();
    elements.push(
      <p key={`p-${i}`} style={{ margin: '4px 0', lineHeight: 1.55 }}>
        {formatInline(line)}
      </p>
    );
  }

  flushList();
  return elements;
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
                No saved conversations yet. Your study sessions will be listed here.
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
                          {conv.title || 'Conversation'}
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
                      aria-label={`Delete conversation: ${conv.title}`}
                      title="Delete conversation"
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
