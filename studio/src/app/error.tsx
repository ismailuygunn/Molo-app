"use client";

import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-boundary-fallback">
      <AlertTriangle size={48} style={{ color: "var(--accent-amber)", marginBottom: 16 }} />
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Bir şeyler yanlış gitti</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, maxWidth: 400, lineHeight: 1.6, textAlign: "center" }}>
        Bu sayfa yüklenirken bir hata oluştu. Lütfen tekrar deneyin.
      </p>
      {error?.message && (
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
          {error.message}
        </pre>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={reset}>
          <RefreshCw size={16} /> Yeniden Dene
        </button>
        <Link href="/" className="btn btn-secondary">
          <Home size={16} /> Ana Sayfa
        </Link>
      </div>
    </div>
  );
}
