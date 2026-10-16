/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  autohideMs: number;
}

interface ToastContextValue {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: (id: string) => void;
}

const AUTOHIDE_MS: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 7000,
};

const DEDUPE_WINDOW_MS = 1500;
const MAX_VISIBLE = 4;

const VARIANT_CONFIG: Record<
  ToastVariant,
  {
    bg: string;
    border: string;
    accent: string;
    titleColor: string;
    bodyColor: string;
    Icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
  }
> = {
  success: {
    bg: '#ffffff',
    border: '#dcfce7',
    accent: '#16a34a',
    titleColor: '#15803d',
    bodyColor: '#334155',
    Icon: CheckCircle2,
  },
  error: {
    bg: '#ffffff',
    border: '#fee2e2',
    accent: '#dc2626',
    titleColor: '#b91c1c',
    bodyColor: '#334155',
    Icon: AlertCircle,
  },
  warning: {
    bg: '#ffffff',
    border: '#fef3c7',
    accent: '#d97706',
    titleColor: '#b45309',
    bodyColor: '#334155',
    Icon: AlertTriangle,
  },
  info: {
    bg: '#ffffff',
    border: '#dbeafe',
    accent: '#2563eb',
    titleColor: '#1d4ed8',
    bodyColor: '#334155',
    Icon: Info,
  },
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const remainingRef = useRef(toast.autohideMs);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (isPaused) return;

    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, remainingRef.current);

    startTimeRef.current = Date.now();

    return () => {
      clearTimeout(timer);
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startTimeRef.current)
      );
    };
  }, [toast.id, isPaused, onDismiss]);

  const config = VARIANT_CONFIG[toast.variant];
  const IconComponent = config.Icon;
  const title = toast.title || (toast.variant.charAt(0).toUpperCase() + toast.variant.slice(1));

  return (
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderLeft: `4px solid ${config.accent}`,
        borderRadius: '10px',
        padding: '14px 16px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        color: config.bodyColor,
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
        animation: 'skillforge-toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        minWidth: '280px',
        maxWidth: '400px',
        wordBreak: 'break-word',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '2px',
          color: config.accent,
        }}
      >
        <IconComponent size={20} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '14px',
            lineHeight: '1.4',
            color: config.titleColor,
            marginBottom: '4px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '13px',
            lineHeight: '1.45',
            color: config.bodyColor,
          }}
        >
          {toast.message}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Close"
        style={{
          background: 'transparent',
          border: 'none',
          padding: '4px',
          margin: '-4px -4px 0 0',
          cursor: 'pointer',
          borderRadius: '4px',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'color 0.15s ease, background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#334155';
          e.currentTarget.style.backgroundColor = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#94a3b8';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

function ToastRenderer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  const visible = toasts.length > MAX_VISIBLE ? toasts.slice(-MAX_VISIBLE) : toasts;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{`
        @keyframes skillforge-toast-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '420px',
          width: 'calc(100vw - 40px)',
          pointerEvents: 'none',
        }}
      >
        {visible.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </>,
    document.body
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const recentRef = useRef<Map<string, number>>(new Map());

  const push = useCallback((variant: ToastVariant, message: string, title?: string) => {
    const dedupeKey = `${variant}::${message}`;
    const now = Date.now();
    const last = recentRef.current.get(dedupeKey) ?? 0;
    if (now - last < DEDUPE_WINDOW_MS) return; 
    recentRef.current.set(dedupeKey, now);

    const id = `toast-${now}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = {
      id,
      variant,
      title,
      message,
      autohideMs: AUTOHIDE_MS[variant],
    };
    setToasts((prev) => [...prev, item]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (msg, title) => push('success', msg, title),
    error: (msg, title) => push('error', msg, title),
    warning: (msg, title) => push('warning', msg, title),
    info: (msg, title) => push('info', msg, title),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRenderer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() must be called inside a <ToastProvider>');
  }
  return ctx;
}
