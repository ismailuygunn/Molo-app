"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Monitor,
  Smartphone,
  Bot,
  Globe,
  Palette,
  Save,
  Rocket,
  Eye,
  CheckCircle2,
  X,
  Lightbulb,
  RefreshCw,
  Loader2,
  Wand2,
  ArrowRight,
  Info,
  Film,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/toast";

const CONTENT_TYPES = [
  { value: "sosyal", label: "Sosyal Medya", icon: Smartphone, desc: "1080×1920 dikey, enerjik", platform: "TikTok / Reels" },
  { value: "ekran", label: "Klinik Ekranı", icon: Monitor, desc: "1920×1080 yatay, sinematik", platform: "Bekleme Ekranı" },
  { value: "robot", label: "Robot Ekranı", icon: Bot, desc: "1080×1920 dikey, sıcak", platform: "Robot Ekranı" },
  { value: "greenscreen", label: "Green Screen", icon: Film, desc: "Chroma key arka plan", platform: "Compositing" },
];

const GS_SIZES = [
  { value: "dikey", label: "Dikey (9:16)", desc: "1080×1920" },
  { value: "yatay", label: "Yatay (16:9)", desc: "1920×1080" },
  { value: "kare", label: "Kare (1:1)", desc: "1080×1080" },
];

const LANGUAGES = [
  { value: "de", label: "🇩🇪 Almanca", flag: "DE" },
  { value: "tr", label: "🇹🇷 Türkçe", flag: "TR" },
];

const TONES = [
  "Eğlenceli", "Bilgilendirici", "Sıcak", "Afacan",
  "Heyecanlı", "Sakin", "Premium",
];

interface Suggestion {
  title: string;
  concept: string;
  why: string;
}

interface ScenePreview {
  scene: number;
  text: string;
  text_de?: string;
  text_tr?: string;
  environment: string;
  molo_pose: string;
  voice_direction: string;
  shot_type: string;
  emotion_note: string;
}

export default function BriefPage() {
  const router = useRouter();
  const toast = useToast();
  const [konu, setKonu] = useState("");
  const [contentType, setContentType] = useState("sosyal");
  const [lang, setLang] = useState("de");
  const [tone, setTone] = useState("Eğlenceli");
  const [maxScenes, setMaxScenes] = useState(4);
  const [concept, setConcept] = useState("");
  const [gsSize, setGsSize] = useState("dikey");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // AI Suggestion state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [suggestConfigured, setSuggestConfigured] = useState<boolean | null>(null);
  const [suggestMessage, setSuggestMessage] = useState("");

  // Preview state
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewScenes, setPreviewScenes] = useState<ScenePreview[]>([]);

  // Clear suggestions when platform or tone changes
  useEffect(() => {
    setSuggestions([]);
    setSuggestError("");
  }, [contentType, tone]);

  const fetchSuggestions = async () => {
    setSuggestLoading(true);
    setSuggestError("");
    try {
      const res = await fetch("/api/brief/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          lang,
          tone,
          existingTopics: konu ? [konu] : [],
        }),
      });
      const data = await res.json();

      // Handle not-configured state
      if (data.configured === false) {
        setSuggestConfigured(false);
        setSuggestMessage(data.message || "API yapılandırılmamış");
        setSuggestions([]);
        return;
      }

      setSuggestConfigured(true);

      if (!res.ok) {
        setSuggestError(data.error || "Öneriler alınamadı");
        return;
      }
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestError("Bağlantı hatası");
    } finally {
      setSuggestLoading(false);
    }
  };

  const applySuggestion = (s: Suggestion) => {
    // Strip leading emojis from title for the konu field
    const cleanTitle = s.title.replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\s]+/u, "").trim();
    setKonu(cleanTitle || s.title);
    setConcept(s.concept);
    toast.success("Öneri uygulandı — konu ve konsept güncellendi!");
  };

  const handleSave = async (startPipeline: boolean) => {
    if (!konu.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ konu, contentType, lang, tone, concept, maxScenes, gsSize }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Brief oluşturulamadı");
        toast.error(data.error || "Brief oluşturulamadı");
        return;
      }

      if (data.projectId) {
        setSavedProjectId(data.projectId);

        if (startPipeline) {
          await fetch("/api/pipeline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: data.projectId }),
          });
          toast.success("Brief oluşturuldu — Pipeline başlatılıyor!");
          router.push(`/scenes?project=${data.projectId}`);
        } else {
          toast.success("Brief başarıyla kaydedildi");
          router.push(`/scenes?project=${data.projectId}`);
        }
      }
    } catch (e) {
      setError("Bir hata oluştu");
      toast.error("Bir hata oluştu");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndPreview = async () => {
    if (!konu.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ konu, contentType, lang, tone, concept, maxScenes, gsSize }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Brief oluşturulamadı");
        toast.error(data.error || "Brief oluşturulamadı");
        setLoading(false);
        return;
      }

      if (data.projectId) {
        setSavedProjectId(data.projectId);
        toast.success("Brief kaydedildi — Pipeline başlatılıyor...");

        await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: data.projectId }),
        });

        // Redirect immediately to scenes page where real-time pipeline progress is shown
        router.push(`/scenes?project=${data.projectId}`);
      }
    } catch (e) {
      setError("Bir hata oluştu");
      toast.error("Bir hata oluştu");
      console.error(e);
      setLoading(false);
    }
  };

  const handleConfirmPipeline = () => {
    if (!savedProjectId) return;
    toast.success("Pipeline devam ediyor! 🚀");
    router.push(`/scenes?project=${savedProjectId}`);
  };

  const currentPlatform = CONTENT_TYPES.find(ct => ct.value === contentType)?.platform || "TikTok / Reels";

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="btn btn-ghost btn-icon">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="page-title">Yeni Brief</h1>
            <p className="page-subtitle">Molo için yeni bir içerik planla</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Konu */}
        <div>
          <label className="label">Konu *</label>
          <input
            className="input"
            placeholder="Örn: Klinik turu, Diş bakım ipuçları, Hasta karşılama..."
            value={konu}
            onChange={(e) => setKonu(e.target.value)}
          />
        </div>

        {/* İçerik Türü */}
        <div>
          <label className="label">
            <Palette size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
            İçerik Türü
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {CONTENT_TYPES.map((ct) => {
              const Icon = ct.icon;
              const isActive = contentType === ct.value;
              return (
                <div
                  key={ct.value}
                  onClick={() => setContentType(ct.value)}
                  className="glass-card"
                  style={{
                    padding: "16px",
                    cursor: "pointer",
                    textAlign: "center",
                    borderColor: isActive ? "var(--accent-blue)" : undefined,
                    background: isActive ? "rgba(59,130,246,0.08)" : undefined,
                  }}
                >
                  <Icon size={24} style={{ marginBottom: 8, color: isActive ? "var(--accent-blue)" : "var(--text-muted)" }} />
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ct.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{ct.desc}</div>
                </div>
              );
            })}
          </div>

          {contentType === "greenscreen" && (
            <div style={{ marginTop: "1rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", display: "block" }}>
                🟢 Green Screen Boyutu
              </label>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {GS_SIZES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setGsSize(s.value)}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      borderRadius: "0.75rem",
                      border: gsSize === s.value ? "2px solid #22c55e" : "1px solid rgba(255,255,255,0.1)",
                      background: gsSize === s.value ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.03)",
                      color: "#fff",
                      cursor: "pointer",
                      textAlign: "center" as const,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dil + Ton */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label className="label">
              <Globe size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
              Dil
            </label>
            <select
              className="input select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ton</label>
            <select
              className="input select"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sahne Sayısı */}
        <div>
          <label className="label">
            <Film size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
            Sahne Sayısı
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6, fontWeight: 400 }}>(≈ maliyet kontrolü)</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range"
              min={2}
              max={8}
              value={maxScenes}
              onChange={(e) => setMaxScenes(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--accent-blue)" }}
            />
            <span style={{
              fontWeight: 700, fontSize: 18, minWidth: 32, textAlign: "center",
              color: maxScenes <= 3 ? "var(--accent-green, #22c55e)" : maxScenes <= 5 ? "var(--accent-blue)" : "var(--accent-amber)",
            }}>
              {maxScenes}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {maxScenes <= 3 ? "💰 Düşük maliyet" : maxScenes <= 5 ? "⚖️ Dengeli" : "🎬 Detaylı içerik"}
            {" — "}{maxScenes} sahne × ~8-12s = ~{maxScenes * 10}s video
          </div>
        </div>

        {/* AI İçerik Önerileri */}
        <div className="glass-card" style={{ padding: 20, background: "rgba(139,92,246,0.04)", borderColor: "rgba(139,92,246,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Wand2 size={18} style={{ color: "var(--accent-purple, #a78bfa)" }} />
              <span style={{ fontWeight: 700, fontSize: 15 }}>AI İçerik Önerileri</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", background: "rgba(139,92,246,0.1)", padding: "2px 8px", borderRadius: 12 }}>
                {currentPlatform}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {suggestions.length > 0 && (
                <button
                  className="btn btn-ghost"
                  onClick={fetchSuggestions}
                  disabled={suggestLoading}
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  <RefreshCw size={13} className={suggestLoading ? "pulse" : ""} /> Yenile
                </button>
              )}
              {suggestConfigured !== false && (
                <button
                  className="btn btn-primary"
                  onClick={fetchSuggestions}
                  disabled={suggestLoading}
                  style={{ fontSize: 13, padding: "8px 16px", background: "rgba(139,92,246,0.8)" }}
                >
                  {suggestLoading ? (
                    <><Loader2 size={14} className="pulse" /> Düşünüyor...</>
                  ) : suggestions.length > 0 ? (
                    <><Lightbulb size={14} /> Yeni Fikirler</>
                  ) : (
                    <><Sparkles size={14} /> İçerik Önerisi Al</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* API not configured info */}
          {suggestConfigured === false && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: 12,
              background: "rgba(245,158,11,0.06)", borderRadius: 8,
              border: "1px solid rgba(245,158,11,0.12)",
            }}>
              <Info size={16} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {suggestMessage || "AI önerileri kullanmak için GOOGLE_API_KEY yapılandırılmalı."}
                {" "}
                <Link href="/settings" style={{ color: "var(--accent-blue)", textDecoration: "underline" }}>Ayarlar →</Link>
              </span>
            </div>
          )}

          {/* Error */}
          {suggestError && (
            <div style={{ fontSize: 12, color: "var(--accent-red)", marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.06)", borderRadius: 8 }}>
              {suggestError}
            </div>
          )}

          {/* Suggestion Cards */}
          {suggestions.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => applySuggestion(s)}
                  className="glass-card"
                  style={{
                    padding: 14,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    borderColor: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, lineHeight: 1.4 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8 }}>
                    {s.concept}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>
                      💡 {s.why}
                    </span>
                    <ArrowRight size={12} style={{ color: "var(--accent-purple, #a78bfa)", opacity: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {suggestions.length === 0 && !suggestLoading && suggestConfigured !== false && (
            <div style={{ textAlign: "center", padding: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>
              İçerik türü ve ton seçin, ardından &quot;İçerik Önerisi Al&quot; butonuna tıklayın.
            </div>
          )}
        </div>

        {/* Konsept */}
        <div>
          <label className="label">İçerik Konsepti (opsiyonel)</label>
          <textarea
            className="input textarea"
            placeholder="Molo klinikte tek başına dolaşıyor. Kendi kendine konuşuyor, şakalar yapıyor..."
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            rows={4}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: 12, background: "rgba(239,68,68,0.1)", borderRadius: "var(--radius-md)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--accent-red)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={handleSaveAndPreview}
            disabled={!konu.trim() || loading}
            style={{ opacity: !konu.trim() || loading ? 0.5 : 1 }}
          >
            <Eye size={18} />
            {loading ? "Senaryo üretiliyor..." : "Kaydet & Önizle"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleSave(true)}
            disabled={!konu.trim() || loading}
            style={{ opacity: !konu.trim() || loading ? 0.5 : 1 }}
          >
            <Rocket size={16} />
            Direkt Pipeline Başlat
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => handleSave(false)}
            disabled={!konu.trim() || loading}
            style={{ opacity: !konu.trim() || loading ? 0.5 : 1 }}
          >
            <Save size={16} />
            Sadece Kaydet
          </button>
          <Link href="/" className="btn btn-ghost">
            İptal
          </Link>
        </div>
      </div>

      {/* Senaryo Önizleme Modal */}
      {showPreview && previewScenes.length > 0 && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div className="glass-card" style={{
            maxWidth: 700, width: "100%", maxHeight: "80vh", overflow: "auto",
            padding: 32, position: "relative",
          }}>
            <button
              onClick={() => setShowPreview(false)}
              className="btn btn-ghost btn-icon"
              style={{ position: "absolute", top: 12, right: 12 }}
            >
              <X size={18} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <Sparkles size={22} style={{ color: "var(--accent-blue)" }} />
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Senaryo Önizleme</h2>
            </div>

            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              {previewScenes.length} sahne üretildi. Pipeline arka planda devam ediyor.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {previewScenes.map((s) => (
                <div key={s.scene} className="glass-card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Sahne {s.scene}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span className="badge draft" style={{ fontSize: 10 }}>{s.voice_direction}</span>
                      <span className="badge review" style={{ fontSize: 10 }}>{s.shot_type}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                    🎤 {s.text_de || s.text || ""}
                  </div>
                  {s.text_tr && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, fontStyle: "italic" }}>
                      🇹🇷 {s.text_tr}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                    <span>📸 {s.environment}</span>
                    <span>🤖 {s.molo_pose}</span>
                    <span>💭 {s.emotion_note}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button className="btn btn-primary" onClick={handleConfirmPipeline}>
                <CheckCircle2 size={16} />
                Pipeline İzle
              </button>
              <button className="btn btn-ghost" onClick={() => setShowPreview(false)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
