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
  Save,
  Rocket,
  Eye,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  Wand2,
  ArrowRight,
  Info,
  Film,
  Users,
  MessageSquare,
  Clapperboard,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/toast";
import { Card, Button, Badge, SelectGrid, Modal } from "@/components/ui";
import { MoloLoading, MoloPeek } from "@/components/molo";

/* ─────────────────────────── Constants ─────────────────────────── */

const CONTENT_TYPE_OPTIONS = [
  {
    id: "sosyal" as const,
    label: "Sosyal Medya",
    description: "1080x1920 dikey, enerjik -- TikTok / Reels",
    icon: <Smartphone size={22} style={{ color: "var(--accent-teal)" }} />,
  },
  {
    id: "ekran" as const,
    label: "Klinik Ekrani",
    description: "1920x1080 yatay, sinematik -- Bekleme Ekrani",
    icon: <Monitor size={22} style={{ color: "var(--accent-teal)" }} />,
  },
  {
    id: "robot" as const,
    label: "Robot Ekrani",
    description: "1080x1920 dikey, sicak -- Robot Ekrani",
    icon: <Bot size={22} style={{ color: "var(--accent-teal)" }} />,
  },
  {
    id: "greenscreen" as const,
    label: "Green Screen",
    description: "Chroma key arka plan -- Compositing",
    icon: <Film size={22} style={{ color: "var(--accent-teal)" }} />,
  },
];

const GS_SIZE_OPTIONS = [
  { id: "dikey" as const, label: "Dikey (9:16)", description: "1080x1920" },
  { id: "yatay" as const, label: "Yatay (16:9)", description: "1920x1080" },
  { id: "kare" as const, label: "Kare (1:1)", description: "1080x1080" },
];

const LANGUAGES = [
  { value: "de", label: "Almanca", flag: "DE" },
  { value: "tr", label: "Turkce", flag: "TR" },
];

const TONES = [
  "Eglenceli",
  "Bilgilendirici",
  "Sicak",
  "Afacan",
  "Heyecanli",
  "Sakin",
  "Premium",
];

const DEFAULT_CATS: [string, string][] = [
  ["trending", "Trend"],
  ["educational", "Egitici"],
  ["humor", "Komedi"],
  ["campaign", "Kampanya"],
  ["storytelling", "Hikaye"],
  ["seasonal", "Mevsimsel"],
  ["interactive", "Etkilesimli"],
];

const CATEGORY_COLORS: Record<string, string> = {
  trending: "rgba(249,115,22,0.12)",
  humor: "rgba(168,85,247,0.12)",
  educational: "rgba(34,197,94,0.12)",
  campaign: "rgba(234,179,8,0.12)",
  storytelling: "rgba(20,184,166,0.12)",
  seasonal: "rgba(236,72,153,0.12)",
  interactive: "rgba(6,182,212,0.12)",
};

const CATEGORY_BORDERS: Record<string, string> = {
  trending: "rgba(249,115,22,0.6)",
  humor: "rgba(168,85,247,0.6)",
  educational: "rgba(34,197,94,0.6)",
  campaign: "rgba(234,179,8,0.6)",
  storytelling: "rgba(20,184,166,0.6)",
  seasonal: "rgba(236,72,153,0.6)",
  interactive: "rgba(6,182,212,0.6)",
};

/* ─────────────────────────── Types ─────────────────────────── */

interface Suggestion {
  title: string;
  concept: string;
  why: string;
  hook?: string;
  category?: string;
  molo_attitude?: string;
}

interface CategoryInfo {
  label: string;
  emoji: string;
  desc: string;
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

/* ─────────────────────────── Page ─────────────────────────── */

export default function BriefPage() {
  const router = useRouter();
  const toast = useToast();

  // Core brief fields (API expects these)
  const [konu, setKonu] = useState("");
  const [contentType, setContentType] = useState("sosyal");
  const [lang, setLang] = useState("de");
  const [tone, setTone] = useState("Eglenceli");
  const [maxScenes, setMaxScenes] = useState(4);
  const [concept, setConcept] = useState("");
  const [gsSize, setGsSize] = useState("dikey");

  // New brief fields
  const [hedefKitle, setHedefKitle] = useState("");
  const [anaMesaj, setAnaMesaj] = useState("");
  const [senaryoIpuclari, setSenaryoIpuclari] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // AI Suggestion state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [suggestConfigured, setSuggestConfigured] = useState<boolean | null>(
    null
  );
  const [suggestMessage, setSuggestMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<Record<string, CategoryInfo>>(
    {}
  );

  // Preview state
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewScenes, setPreviewScenes] = useState<ScenePreview[]>([]);

  // Clear suggestions when platform or tone changes
  useEffect(() => {
    setSuggestions([]);
    setSuggestError("");
    setSelectedCategory(null);
  }, [contentType, tone]);

  /* ── Build enriched concept for API ── */
  const buildEnrichedConcept = (): string => {
    const parts: string[] = [];
    if (concept.trim()) parts.push(concept.trim());
    if (hedefKitle.trim())
      parts.push(`\nHedef Kitle: ${hedefKitle.trim()}`);
    if (anaMesaj.trim()) parts.push(`\nAna Mesaj: ${anaMesaj.trim()}`);
    if (senaryoIpuclari.trim())
      parts.push(`\nSenaryo Ipuclari: ${senaryoIpuclari.trim()}`);
    return parts.join("\n");
  };

  /* ── AI Suggestions ── */
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
          category: selectedCategory,
        }),
      });
      const data = await res.json();

      if (data.configured === false) {
        setSuggestConfigured(false);
        setSuggestMessage(data.message || "API yapilandirilmamis");
        setSuggestions([]);
        return;
      }

      setSuggestConfigured(true);

      if (!res.ok) {
        setSuggestError(data.error || "Oneriler alinamadi");
        return;
      }
      setSuggestions(data.suggestions || []);
      if (data.categories) setCategories(data.categories);
    } catch {
      setSuggestError("Baglanti hatasi");
    } finally {
      setSuggestLoading(false);
    }
  };

  const applySuggestion = (s: Suggestion) => {
    const cleanTitle = s.title
      .replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\s]+/u, "")
      .trim();
    setKonu(cleanTitle || s.title);
    const fullConcept = s.hook
      ? `${s.concept}\n\nHook: "${s.hook}"`
      : s.concept;
    setConcept(fullConcept);
    toast.success("Oneri uygulandi!");
  };

  /* ── Save & Submit ── */
  const handleSave = async (startPipeline: boolean) => {
    if (!konu.trim()) return;
    setLoading(true);
    setError("");

    const enrichedConcept = buildEnrichedConcept();

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          konu,
          contentType,
          lang,
          tone,
          concept: enrichedConcept,
          maxScenes,
          gsSize,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Brief olusturulamadi");
        toast.error(data.error || "Brief olusturulamadi");
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
          toast.success("Brief olusturuldu -- Pipeline baslatiliyor!");
          router.push(`/scenes?project=${data.projectId}`);
        } else {
          toast.success("Brief basariyla kaydedildi");
          router.push(`/scenes?project=${data.projectId}`);
        }
      }
    } catch (e) {
      setError("Bir hata olustu");
      toast.error("Bir hata olustu");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndPreview = async () => {
    if (!konu.trim()) return;
    setLoading(true);
    setError("");

    const enrichedConcept = buildEnrichedConcept();

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          konu,
          contentType,
          lang,
          tone,
          concept: enrichedConcept,
          maxScenes,
          gsSize,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Brief olusturulamadi");
        toast.error(data.error || "Brief olusturulamadi");
        setLoading(false);
        return;
      }

      if (data.projectId) {
        setSavedProjectId(data.projectId);
        toast.success("Brief kaydedildi -- Pipeline baslatiliyor...");

        await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: data.projectId }),
        });

        router.push(`/scenes?project=${data.projectId}`);
      }
    } catch (e) {
      setError("Bir hata olustu");
      toast.error("Bir hata olustu");
      console.error(e);
      setLoading(false);
    }
  };

  const handleConfirmPipeline = () => {
    if (!savedProjectId) return;
    router.push(`/scenes?project=${savedProjectId}`);
  };

  const currentPlatform =
    CONTENT_TYPE_OPTIONS.find((ct) => ct.id === contentType)?.label ||
    "Sosyal Medya";

  /* ─────────────────────────── Render ─────────────────────────── */

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="btn btn-ghost btn-icon">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Sparkles size={22} style={{ color: "var(--accent-teal)" }} />
              Yeni Brief
            </h1>
            <p className="page-subtitle">
              Molo icin yeni bir icerik planla
            </p>
          </div>
        </div>
        <MoloPeek />
      </div>

      <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Section: Konu ── */}
        <Card accent="teal">
          <div style={{ padding: 24 }}>
            <label className="label" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Konu *
            </label>
            <input
              className="input"
              placeholder="Orn: Klinik turu, Dis bakim ipuclari, Hasta karsilama..."
              value={konu}
              onChange={(e) => setKonu(e.target.value)}
              style={{ fontSize: 15 }}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              Videonun ana konusunu kisa ve net yaz.
            </p>
          </div>
        </Card>

        {/* ── Section: Icerik Turu ── */}
        <section>
          <label className="label" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Clapperboard size={15} style={{ color: "var(--accent-teal)" }} />
            Icerik Turu
          </label>
          <SelectGrid
            options={CONTENT_TYPE_OPTIONS}
            value={contentType}
            onChange={setContentType}
            columns={4}
          />

          {/* Green Screen Size Picker */}
          {contentType.startsWith("greenscreen") && (
            <div style={{ marginTop: 16 }}>
              <label className="label" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                Green Screen Boyutu
              </label>
              <SelectGrid
                options={GS_SIZE_OPTIONS}
                value={gsSize}
                onChange={setGsSize}
                columns={3}
              />
            </div>
          )}
        </section>

        {/* ── Section: Dil + Ton ── */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label className="label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Globe size={14} style={{ color: "var(--accent-teal)" }} />
              Dil
            </label>
            <select
              className="input select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" style={{ marginBottom: 6 }}>Ton</label>
            <select
              className="input select"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* ── Section: Sahne Sayisi ── */}
        <section>
          <label className="label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Film size={14} style={{ color: "var(--accent-teal)" }} />
            Sahne Sayisi
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
              (maliyet kontrolu)
            </span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range"
              min={2}
              max={8}
              value={maxScenes}
              onChange={(e) => setMaxScenes(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--accent-teal, #14b8a6)" }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: 20,
                minWidth: 36,
                textAlign: "center",
                color:
                  maxScenes <= 3
                    ? "var(--accent-green, #22c55e)"
                    : maxScenes <= 5
                      ? "var(--accent-teal, #14b8a6)"
                      : "var(--accent-coral, #f97066)",
                background:
                  maxScenes <= 3
                    ? "rgba(34,197,94,0.1)"
                    : maxScenes <= 5
                      ? "rgba(20,184,166,0.1)"
                      : "rgba(249,112,102,0.1)",
                borderRadius: "var(--radius-md)",
                padding: "4px 10px",
              }}
            >
              {maxScenes}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
            {maxScenes <= 3
              ? "Dusuk maliyet"
              : maxScenes <= 5
                ? "Dengeli"
                : "Detayli icerik"}
            {" -- "}
            {maxScenes} sahne x ~8-12s = ~{maxScenes * 10}s video
          </div>
        </section>

        {/* ── Section: AI Icerik Onerileri ── */}
        <Card accent="teal">
          <div style={{ padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wand2 size={18} style={{ color: "var(--accent-teal)" }} />
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                  AI Icerik Onerileri
                </span>
                <Badge variant="info">{currentPlatform}</Badge>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {suggestions.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RefreshCw size={13} />}
                    onClick={fetchSuggestions}
                    loading={suggestLoading}
                  >
                    Yenile
                  </Button>
                )}
                {suggestConfigured !== false && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={
                      suggestions.length > 0 ? (
                        <Lightbulb size={14} />
                      ) : (
                        <Sparkles size={14} />
                      )
                    }
                    onClick={fetchSuggestions}
                    loading={suggestLoading}
                    style={{
                      background: "linear-gradient(135deg, var(--accent-teal, #14b8a6), var(--accent-blue, #3b82f6))",
                    }}
                  >
                    {suggestLoading
                      ? "Dusunuyor..."
                      : suggestions.length > 0
                        ? "Yeni Fikirler"
                        : "Icerik Onerisi Al"}
                  </Button>
                )}
              </div>
            </div>

            {/* Kategori Chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <button
                onClick={() => setSelectedCategory(null)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1.5px solid ${!selectedCategory ? "var(--accent-teal, #14b8a6)" : "var(--border-subtle, #e2e8f0)"}`,
                  background: !selectedCategory ? "rgba(20,184,166,0.1)" : "var(--bg-card)",
                  color: !selectedCategory ? "var(--accent-teal, #14b8a6)" : "var(--text-muted)",
                  transition: "all 0.2s",
                }}
              >
                Hepsi
              </button>
              {(Object.keys(categories).length > 0
                ? Object.entries(categories).map(
                    ([key, cat]) =>
                      [key, `${cat.emoji} ${cat.label}`] as [string, string]
                  )
                : DEFAULT_CATS
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === key ? null : key)
                  }
                  style={{
                    padding: "5px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: `1.5px solid ${selectedCategory === key ? (CATEGORY_BORDERS[key] || "var(--accent-teal)") : "var(--border-subtle, #e2e8f0)"}`,
                    background:
                      selectedCategory === key
                        ? CATEGORY_COLORS[key] || "rgba(20,184,166,0.1)"
                        : "var(--bg-card)",
                    color:
                      selectedCategory === key
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                    transition: "all 0.2s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* API not configured info */}
            {suggestConfigured === false && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  background: "rgba(245,158,11,0.06)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(245,158,11,0.15)",
                }}
              >
                <Info size={16} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {suggestMessage || "AI onerileri kullanmak icin GOOGLE_API_KEY yapilandirilmali."}{" "}
                  <Link
                    href="/settings"
                    style={{ color: "var(--accent-teal)", textDecoration: "underline" }}
                  >
                    Ayarlar
                  </Link>
                </span>
              </div>
            )}

            {/* Suggest error */}
            {suggestError && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--accent-red, #ef4444)",
                  marginBottom: 12,
                  padding: "8px 12px",
                  background: "rgba(239,68,68,0.06)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                {suggestError}
              </div>
            )}

            {/* Loading state with Molo */}
            {suggestLoading && (
              <div style={{ padding: "24px 0" }}>
                <MoloLoading text="Molo dusunuyor..." />
              </div>
            )}

            {/* Suggestion Cards */}
            {!suggestLoading && suggestions.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 12,
                }}
              >
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => applySuggestion(s)}
                    className="glass-card"
                    style={{
                      padding: 16,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      borderColor: "var(--border-subtle, #e2e8f0)",
                      borderLeft: s.category
                        ? `3px solid ${CATEGORY_BORDERS[s.category] || "var(--accent-teal)"}`
                        : undefined,
                      background: "var(--bg-card)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        CATEGORY_BORDERS[s.category || ""] || "var(--accent-teal)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 24px rgba(20,184,166,0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-subtle, #e2e8f0)";
                      e.currentTarget.style.borderLeft = s.category
                        ? `3px solid ${CATEGORY_BORDERS[s.category] || "var(--accent-teal)"}`
                        : "";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Title + Category Badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4, flex: 1, color: "var(--text-primary)" }}>
                        {s.title}
                      </div>
                      {s.category && (
                        <Badge variant="info">
                          {categories[s.category]?.emoji || ""}{" "}
                          {categories[s.category]?.label || s.category}
                        </Badge>
                      )}
                    </div>

                    {/* Concept */}
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                        marginBottom: 8,
                      }}
                    >
                      {s.concept}
                    </div>

                    {/* Hook */}
                    {s.hook && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--accent-teal)",
                          fontStyle: "italic",
                          marginBottom: 10,
                          padding: "8px 10px",
                          background: "rgba(20,184,166,0.06)",
                          borderRadius: "var(--radius-md)",
                          borderLeft: "2px solid var(--accent-teal)",
                          lineHeight: 1.5,
                        }}
                      >
                        &quot;{s.hook}&quot;
                      </div>
                    )}

                    {/* Why */}
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        lineHeight: 1.5,
                        marginBottom: 8,
                      }}
                    >
                      {s.why}
                    </div>

                    {/* Footer */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {s.molo_attitude && (
                          <Badge variant="draft">{s.molo_attitude}</Badge>
                        )}
                      </div>
                      <ArrowRight
                        size={12}
                        style={{ color: "var(--accent-teal)", opacity: 0.6 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {suggestions.length === 0 &&
              !suggestLoading &&
              suggestConfigured !== false && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 0",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  Kategori secin veya dogrudan &quot;Icerik Onerisi Al&quot;
                  butonuna tiklayin.
                </div>
              )}
          </div>
        </Card>

        {/* ── Section: Icerik Konsepti ── */}
        <section>
          <label className="label" style={{ marginBottom: 6 }}>
            Icerik Konsepti (opsiyonel)
          </label>
          <textarea
            className="input textarea"
            placeholder="Molo klinikte tek basina dolasiyor. Kendi kendine konusuyor, sakalar yapiyor..."
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            rows={4}
          />
        </section>

        {/* ── Section: Ek Detaylar (New Fields) ── */}
        <Card>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <MessageSquare size={16} style={{ color: "var(--accent-coral, #f97066)" }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                Ek Detaylar
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                (opsiyonel ama onerilen)
              </span>
            </div>

            {/* Hedef Kitle */}
            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Users size={14} style={{ color: "var(--accent-teal)" }} />
                Hedef Kitle
              </label>
              <textarea
                className="input textarea"
                placeholder="Orn: 25-45 yas arasi dis hekimligi hastalar, cocuklu aileler, estetik dis tedavisi arayanlar..."
                value={hedefKitle}
                onChange={(e) => setHedefKitle(e.target.value)}
                rows={2}
              />
            </div>

            {/* Ana Mesaj */}
            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Lightbulb size={14} style={{ color: "var(--accent-teal)" }} />
                Ana Mesaj
              </label>
              <input
                className="input"
                placeholder="Orn: Dis bakim rutininizi eglenceli hale getirin!"
                value={anaMesaj}
                onChange={(e) => setAnaMesaj(e.target.value)}
              />
            </div>

            {/* Senaryo Ipuclari */}
            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Clapperboard size={14} style={{ color: "var(--accent-teal)" }} />
                Senaryo Ipuclari
              </label>
              <textarea
                className="input textarea"
                placeholder={`Orn:\n- Molo kameraya bakip seyirciyle konussun\n- Ilk sahnede surpriz eleman olsun\n- Komik bir kapanisla bitsin`}
                value={senaryoIpuclari}
                onChange={(e) => setSenaryoIpuclari(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </Card>

        {/* ── Error Display ── */}
        {error && (
          <div
            style={{
              padding: 14,
              background: "rgba(239,68,68,0.06)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(239,68,68,0.15)",
              color: "var(--accent-red, #ef4444)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            paddingTop: 4,
            paddingBottom: 32,
          }}
        >
          <Button
            variant="secondary"
            icon={<Eye size={16} />}
            onClick={handleSaveAndPreview}
            disabled={!konu.trim()}
            loading={loading}
          >
            Kaydet &amp; Onizle
          </Button>

          <Button
            variant="primary"
            icon={<Rocket size={16} />}
            onClick={() => handleSave(true)}
            disabled={!konu.trim()}
            loading={loading}
            style={{
              background:
                "linear-gradient(135deg, var(--accent-teal, #14b8a6), var(--accent-blue, #3b82f6))",
            }}
          >
            Direkt Pipeline Baslat
          </Button>

          <Button
            variant="ghost"
            icon={<Save size={16} />}
            onClick={() => handleSave(false)}
            disabled={!konu.trim()}
            loading={loading}
          >
            Sadece Kaydet
          </Button>

          <Link href="/" className="btn btn-ghost" style={{ display: "flex", alignItems: "center" }}>
            Iptal
          </Link>
        </div>
      </div>

      {/* ── Scene Preview Modal ── */}
      <Modal
        open={showPreview && previewScenes.length > 0}
        onClose={() => setShowPreview(false)}
        title="Senaryo Onizleme"
        size="lg"
      >
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          {previewScenes.length} sahne uretildi. Pipeline arka planda devam
          ediyor.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {previewScenes.map((s) => (
            <Card key={s.scene}>
              <div style={{ padding: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                    Sahne {s.scene}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Badge variant="draft">{s.voice_direction}</Badge>
                    <Badge variant="review">{s.shot_type}</Badge>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    marginBottom: 8,
                    color: "var(--text-primary)",
                  }}
                >
                  {s.text_de || s.text || ""}
                </div>
                {s.text_tr && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}
                  >
                    {s.text_tr}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 10,
                    fontSize: 11,
                    color: "var(--text-muted)",
                    flexWrap: "wrap",
                  }}
                >
                  <span>{s.environment}</span>
                  <span>{s.molo_pose}</span>
                  <span>{s.emotion_note}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <Button
            variant="primary"
            icon={<CheckCircle2 size={16} />}
            onClick={handleConfirmPipeline}
            style={{
              background:
                "linear-gradient(135deg, var(--accent-teal, #14b8a6), var(--accent-blue, #3b82f6))",
            }}
          >
            Pipeline Izle
          </Button>
          <Button variant="ghost" onClick={() => setShowPreview(false)}>
            Kapat
          </Button>
        </div>
      </Modal>
    </>
  );
}
