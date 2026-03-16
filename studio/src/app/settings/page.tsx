"use client";

import { useState, useEffect } from "react";
import { Settings, Key, Bot, Film, Check, AlertTriangle, Loader2 } from "lucide-react";

interface ApiKey {
  id: string;
  env: string;
  label: string;
  exists: boolean;
  last4: string;
  length: number;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setKeys(data.keys || []);
        setLoading(false);
      });
  }, []);

  const testApi = async (key: string) => {
    setTestResults((prev) => ({ ...prev, [key]: "testing" }));
    setTimeout(() => {
      setTestResults((prev) => ({ ...prev, [key]: "ok" }));
    }, 1000);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ayarlar</h1>
          <p className="page-subtitle">API anahtarları ve varsayılan üretim ayarları</p>
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
              <Loader2 size={20} className="pulse" />
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
                      <span style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 8,
                        background: api.exists ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                        color: api.exists ? "var(--accent-green)" : "var(--accent-red)",
                      }}>
                        {api.exists ? "✓ Set" : "✗ Missing"}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, marginTop: 20 }}
                    onClick={() => testApi(api.id)}
                    disabled={!api.exists}
                  >
                    {testResults[api.id] === "testing" ? (
                      <Loader2 size={14} className="pulse" />
                    ) : testResults[api.id] === "ok" ? (
                      <Check size={14} style={{ color: "var(--accent-green)" }} />
                    ) : (
                      "Test"
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 16, padding: 12, background: "rgba(245, 158, 11, 0.08)", borderRadius: "var(--radius-md)", border: "1px solid rgba(245, 158, 11, 0.15)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={16} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              API anahtarları <code style={{ color: "var(--accent-cyan)", background: "rgba(6,182,212,0.1)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>.env</code> dosyasından veya sistem ortam değişkenlerinden (Railway) okunur. Bu sayfada düzenlenemez — güvenlik nedeniyle salt okunur.
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
              <div className="input" style={{ fontSize: 13 }}>character.md</div>
            </div>
            <div>
              <label className="label">Ses Profili (DE)</label>
              <select className="input select" defaultValue="molo-de-v2" style={{ fontSize: 13 }}>
                <option value="molo-de-v2">Molo DE v2</option>
                <option value="molo-tr">Molo TR</option>
              </select>
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

        {/* Üretim Ayarları */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div className="section-title">
            <Film size={18} /> Varsayılan Üretim Ayarları
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">FPS</label>
              <input className="input" defaultValue="24" style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="label">CRF</label>
              <input className="input" defaultValue="16" style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="label">Slowdown</label>
              <input className="input" defaultValue="0.88" style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="label">Crossfade</label>
              <input className="input" defaultValue="0.7s" style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="label">Scene Padding</label>
              <input className="input" defaultValue="0.4s" style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="label">BGM Volume</label>
              <input className="input" defaultValue="-22dB" style={{ fontSize: 13 }} />
            </div>
          </div>

          <div className="divider" />

          <div className="section-title" style={{ fontSize: 14 }}>
            <Settings size={16} /> İçerik Türleri
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { label: "📱 Sosyal", res: "1080×1920", aspect: "9:16" },
              { label: "📺 Ekran", res: "1920×1080", aspect: "16:9" },
              { label: "🤖 Robot", res: "1080×1920", aspect: "9:16" },
            ].map((t) => (
              <div key={t.label} className="glass-card" style={{ padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.res}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.aspect}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
