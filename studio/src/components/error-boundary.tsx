"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="error-boundary-fallback">
          <AlertTriangle size={48} style={{ color: "var(--accent-amber)", marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Bir şeyler yanlış gitti</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, maxWidth: 400, lineHeight: 1.6 }}>
            Beklenmeyen bir hata oluştu. Sayfayı yenilemeyi deneyin veya ana sayfaya dönün.
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: 11,
              color: "var(--accent-red)",
              background: "rgba(239,68,68,0.06)",
              padding: "8px 12px",
              borderRadius: 8,
              marginBottom: 16,
              maxWidth: 500,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw size={16} /> Yeniden Dene
            </button>
            <Link href="/" className="btn btn-secondary">
              <Home size={16} /> Ana Sayfa
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
