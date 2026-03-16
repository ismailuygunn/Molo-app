import { FileQuestion, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-boundary-fallback">
      <FileQuestion size={64} style={{ color: "var(--text-muted)", marginBottom: 20, opacity: 0.5 }} />
      <h1 style={{ fontSize: 48, fontWeight: 800, background: "var(--gradient-accent)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 8 }}>
        404
      </h1>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>
        Sayfa bulunamadı
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
      </p>
      <Link href="/" className="btn btn-primary">
        <Home size={16} /> Dashboard&apos;a Dön
      </Link>
    </div>
  );
}
