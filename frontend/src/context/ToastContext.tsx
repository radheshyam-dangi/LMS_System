import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { createPortal } from 'react-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

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

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; accent: string; icon: string; headerColor: string; bodyColor: string }> = {
  success: { bg: '#ecfdf3', border: '#bbf7d0', accent: '#16a34a', icon: '✓', headerColor: '#16a34a', bodyColor: '#1e293b' },
  error: { bg: '#fef2f2', border: '#fecaca', accent: '#dc2626', icon: '✕', headerColor: '#dc2626', bodyColor: '#1e293b' },
  warning: { bg: '#fffbeb', border: '#fde68a', accent: '#d97706', icon: '⚠', headerColor: '#d97706', bodyColor: '#1e293b' },
  info: { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', icon: 'i', headerColor: '#2563eb', bodyColor: '#1e293b' },
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastRenderer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  const visible = toasts.length > MAX_VISIBLE ? toasts.slice(-MAX_VISIBLE) : toasts;

  return createPortal(
    <ToastContainer 
      position="top-end" 
      className="p-3" 
      style={{ zIndex: 99999, position: 'fixed' }}
    >
      {visible.map((toast) => {
        const s = VARIANT_STYLES[toast.variant];
        return (
          <Toast 
            key={toast.id} 
            onClose={() => onDismiss(toast.id)} 
            delay={toast.autohideMs} 
            autohide
            style={{
              backgroundColor: s.bg,
              border: `1px solid ${s.border}`,
              borderLeft: `5px solid ${s.accent}`,
              borderRadius: '8px',
              color: s.bodyColor,
              marginBottom: '10px'
            }}
          >
            <Toast.Header
              style={{
                backgroundColor: s.bg,
                borderBottom: 'none',
                color: s.headerColor,
                fontWeight: 'bold'
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: s.accent,
                  color: '#fff',
                  fontSize: '11px',
                  marginRight: '8px'
                }}
              >
                {s.icon}
              </span>
              <strong className="me-auto">{toast.title || (toast.variant.charAt(0).toUpperCase() + toast.variant.slice(1))}</strong>
            </Toast.Header>
            <Toast.Body style={{ paddingTop: 0 }}>
              {toast.message}
            </Toast.Body>
          </Toast>
        );
      })}
    </ToastContainer>,
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
