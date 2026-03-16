"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

/* ── Types ── */
export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/* ── Hook ── */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return no-op functions if used outside provider (SSR safety)
    return {
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
    };
  }
  return ctx;
}

/* ── Icons ── */
const TOAST_ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const TOAST_COLORS: Record<ToastType, string> = {
  success: "var(--accent-green)",
  error: "var(--accent-red)",
  info: "var(--accent-blue)",
  warning: "var(--accent-amber)",
};

const TOAST_BG: Record<ToastType, string> = {
  success: "rgba(16, 185, 129, 0.12)",
  error: "rgba(239, 68, 68, 0.12)",
  info: "rgba(59, 130, 246, 0.12)",
  warning: "rgba(245, 158, 11, 0.12)",
};

const TOAST_BORDER: Record<ToastType, string> = {
  success: "rgba(16, 185, 129, 0.25)",
  error: "rgba(239, 68, 68, 0.25)",
  info: "rgba(59, 130, 246, 0.25)",
  warning: "rgba(245, 158, 11, 0.25)",
};

const DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  info: 4000,
  warning: 5000,
};

/* ── Single Toast ── */
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const Icon = TOAST_ICONS[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`toast-item ${exiting ? "toast-exit" : "toast-enter"}`}
      style={{
        background: TOAST_BG[toast.type],
        borderColor: TOAST_BORDER[toast.type],
      }}
    >
      <Icon
        size={18}
        style={{ color: TOAST_COLORS[toast.type], flexShrink: 0 }}
      />
      <span className="toast-message">{toast.message}</span>
      <button className="toast-dismiss" onClick={handleDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}

/* ── Provider ── */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message, duration: DURATIONS[type] }]);
  }, []);

  const value: ToastContextValue = {
    success: useCallback((msg: string) => addToast("success", msg), [addToast]),
    error: useCallback((msg: string) => addToast("error", msg), [addToast]),
    info: useCallback((msg: string) => addToast("info", msg), [addToast]),
    warning: useCallback((msg: string) => addToast("warning", msg), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
