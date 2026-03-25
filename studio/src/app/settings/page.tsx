"use client";

import { useState, useEffect } from "react";
import { Settings, Key, Bot, Film, Check, AlertTriangle, Loader2, X, ExternalLink, DollarSign } from "lucide-react";
import { MoloLoading } from "@/components/molo";

interface ApiKey {
  id: string;
  env: string;
  label: string;
  exists: boolean;
  last4: string;
  length: number;
  source?: string;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [envSource, setEnvSource] = useState("");
  const [testResults, setTestResults] = useState<Record<string, { status: string; message?: string }>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setKeys(data.keys || []);
        setEnvSource(data.envSource || "");
        setLoading(false);
      });
  }, []);

  const testApi = async (keyId: string) => {
    setTestResults((prev) => ({ ...prev, [keyId]: { status: "testing" } }));
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [keyId]: data }));
    } catch {
      setTestResults((prev) => ({ ...prev, [keyId]: { status: "error", message: "Bağlantı hatası" } }));
    }
  };

  const getTestIcon = (keyId: string) => {
    const r = testResults[keyId];
    if (!r) return "Test";
    if (r.status === "testing") return <Loader2 size={14} className="pulse" />;
    if (r.status === "ok") return <Check size={14} style={{ color: "var(--accent-green)" }} />;
    return <X size={14} style={{ color: "var(--accent-red)" }} />;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ayarlar</h1>
          <p className="page-subtitle">API anahtarları ve üretim yapılandırması</p>
        </div>
      </div>

      <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* API Keys */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div className="section-title">
            <Key size={18} /> API Anahtarları
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <MoloLoading size={36} text="API anahtarları yükleniyor..." />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {keys.map((api) => (
                <div key={api.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">{api.label}</label>
                    <div className="input" style={{
                      fontSize: 13,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}>
                      <span style={{
                        color: api.exists ? "var(--text-secondary)" : "var(--accent-red)",
                      }}>
                        {api.exists ? `${"•".repeat(Math.min(api.length - 4, 20))}${api.last4}` : "❌ Bulunamadı"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {api.source && (
                          <span style={{
                            fontSize: 9, padding: "1px 5px", borderRadius: 6,
                            background: "rgba(20,184,166,0.1)", color: "var(--accent-teal)",
                          }}>
                            {api.source === "file" ? ".env" : api.source === "env" ? "ENV" : "—"}
                          </span>
                        )}
                        <span style={{
                          fontSize: 10, padding: "2px 6px", borderRadius: 8,
                          background: api.exists ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                          color: api.exists ? "var(--accent-green)" : "var(--accent-red)",
                        }}>
                          {api.exists ? "✓ Set" : "✗ Missing"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginTop: 20 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                      onClick={() => testApi(api.id)}
                      disabled={!api.exists}
                    >
                      {getTestIcon(api.id)}
                    </button>
                    {testResults[api.id]?.message && (
                      <span style={{
                        fontSize: 9,
                        color: testResults[api.id].status === "ok" ? "var(--accent-green)" : "var(--accent-red)",
                        maxWidth: 100, textAlign: "center",
                      }}>
                        {testResults[api.id].message!.slice(0, 30)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 16, padding: 12, background: "rgba(245, 158, 11, 0.08)", borderRadius: "var(--radius-md)", border: "1px solid rgba(245, 158, 11, 0.15)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={16} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              API anahtarları <code style={{ color: "var(--accent-teal)", background: "rgba(20,184,166,0.1)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>.env</code> dosyasından veya sistem ortam değişkenlerinden (Railway) okunur.
              {envSource === "file" ? " Kaynak: .env dosyası" : envSource === "process.env" ? " Kaynak: Sistem ortam değişkenleri" : ""}
            </span>
          </div>
        </div>

        {/* Karakter */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div className="section-title">
            <Bot size={18} /> Molo Karakter
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Kişilik Profili</label>
              <div className="input" style={{ fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>character.md</span>
                <a href="/api/files/_config/character.md" target="_blank" style={{ color: "var(--accent-teal)", display: "flex" }}>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <div>
              <label className="label">Ses Profili (DE)</label>
              <div className="input" style={{ fontSize: 13 }}>Molo DE v2 (salt okunur)</div>
            </div>
            <div>
              <label className="label">Referans Görseller</label>
              <div className="input" style={{ fontSize: 13 }}>4 poz dosyası</div>
            </div>
            <div>
              <label className="label">Ortam Görselleri</label>
              <div className="input" style={{ fontSize: 13 }}>2 ortam (clinic, studio)</div>
            </div>
          </div>
        </div>

        {/* Üretim Ayarları — Salt okunur bilgilendirme */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div className="section-title">
            <Film size={18} /> Üretim Yapılandırması
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Bu ayarlar <code style={{ color: "var(--accent-teal)", background: "rgba(20,184,166,0.1)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>scripts/config.py</code> dosyasından okunur.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "FPS", value: "24" },
              { label: "CRF", value: "16" },
              { label: "Slowdown", value: "0.88x" },
              { label: "Crossfade", value: "0.7s" },
              { label: "Scene Padding", value: "0.4s" },
              { label: "BGM Volume", value: "-22dB" },
            ].map((item) => (
              <div key={item.label}>
                <label className="label">{item.label}</label>
                <div className="input" style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "default" }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div className="section-title" style={{ fontSize: 14 }}>
            <Settings size={16} /> İçerik Türleri
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { label: "📱 Sosyal", res: "1080×1920", aspect: "9:16", kling: "5s / 10s" },
              { label: "📺 Ekran", res: "1920×1080", aspect: "16:9", kling: "5s / 10s" },
              { label: "🤖 Robot", res: "1080×1920", aspect: "9:16", kling: "5s / 10s" },
            ].map((t) => (
              <div key={t.label} className="glass-card" style={{ padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.res}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.aspect} • Kling {t.kling}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tahmini Maliyetler */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div className="section-title">
            <DollarSign size={18} /> Tahmini Maliyetler
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Aşağıdaki rakamlar ortalama kullanım senaryolarına göre tahmin edilmiştir. Gerçek maliyetler kullanım miktarına göre değişir.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Gemini (senaryo + görseller)", cost: "~$0.02 / proje", color: "var(--accent-blue)" },
              { label: "ElevenLabs (ses)", cost: "~$0.05 / sahne", color: "var(--accent-purple)" },
              { label: "Kling v3 (video, 5s)", cost: "~$0.10 / sahne", color: "var(--accent-teal)" },
              { label: "Kling v3 (video, 10s)", cost: "~$0.20 / sahne", color: "var(--accent-coral)" },
            ].map((item) => (
              <div key={item.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: "var(--radius-md)",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.label}</span>
                <span style={{
                  fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono, monospace)",
                  color: item.color,
                }}>
                  {item.cost}
                </span>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div style={{
            padding: "14px 16px", borderRadius: "var(--radius-md)",
            background: "rgba(20, 184, 166, 0.06)", border: "1px solid rgba(20, 184, 166, 0.12)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
              Ortalama proje maliyeti (4 sahne)
            </span>
            <span style={{
              fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono, monospace)",
              color: "var(--accent-teal)",
            }}>
              ~$0.72
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
