"use client";

import { useState } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/toast";

const CONTENT_TYPES = [
  { value: "sosyal", label: "Sosyal Medya", icon: Smartphone, desc: "1080×1920 dikey, enerjik" },
  { value: "ekran", label: "Klinik Ekranı", icon: Monitor, desc: "1920×1080 yatay, sinematik" },
  { value: "robot", label: "Robot Ekranı", icon: Bot, desc: "1080×1920 dikey, sıcak" },
];

const LANGUAGES = [
  { value: "de", label: "🇩🇪 Almanca", flag: "DE" },
  { value: "tr", label: "🇹🇷 Türkçe", flag: "TR" },
];

const TONES = [
  "Eğlenceli", "Bilgilendirici", "Sıcak", "Afacan",
  "Heyecanlı", "Sakin", "Premium",
];

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
  const [concept, setConcept] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Preview state
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewScenes, setPreviewScenes] = useState<ScenePreview[]>([]);
  const [pipelineStarting, setPipelineStarting] = useState(false);

  const handleSave = async (startPipeline: boolean) => {
    if (!konu.trim()) return;
    setLoading(true);
    setError("");

    try {
      // Create brief
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ konu, contentType, lang, tone, concept }),
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
          // Start pipeline
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
      // Save brief first
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ konu, contentType, lang, tone, concept }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Brief oluşturulamadı");
        toast.error(data.error || "Brief oluşturulamadı");
        return;
      }

      if (data.projectId) {
        setSavedProjectId(data.projectId);
        toast.success("Brief kaydedildi — Senaryo üretiliyor...");

        // Start pipeline (it will generate script first)
        await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: data.projectId }),
        });

        // Poll for scenes.json to appear
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const scenesRes = await fetch(`/api/projects/${encodeURIComponent(data.projectId)}/scenes`);
            const scenesData = await scenesRes.json();
            if (scenesData.scenes && scenesData.scenes.length > 0) {
              clearInterval(pollInterval);
              setPreviewScenes(scenesData.scenes);
              setShowPreview(true);
              setLoading(false);
            }
          } catch {
            // ignore
          }
          if (attempts > 60) {
            clearInterval(pollInterval);
            setLoading(false);
            toast.warning("Senaryo üretimi uzun sürüyor — sahneler sayfasını kontrol edin");
            router.push(`/scenes?project=${data.projectId}`);
          }
        }, 3000);
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
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
