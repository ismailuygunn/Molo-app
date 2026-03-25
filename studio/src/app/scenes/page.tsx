"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  Suspense,
  useMemo,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Mic2,
  ImageIcon,
  Film,
  Clock,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  XCircle,
  Pause,
  ZoomIn,
  RefreshCw,
  SkipForward,
  Plus,
  Trash2,
  Save,
  Edit3,
  Eye,
  Volume2,
  FileVideo,
  FolderOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Project, Scene, FrameRole } from "@/store/studio";
import { useStudioStore } from "@/store/studio";
import { useToast } from "@/components/toast";
import { Card, Button, Badge, Progress, Modal, EmptyState } from "@/components/ui";
import { ImageApprovalPanel, SceneConfigurator, SceneCard } from "@/components/scenes";
import { MoloLoading, MoloReaction, MoloWave, MoloFloat } from "@/components/molo";

// ─── Pipeline Types & Constants ─────────────────────────────────────────────

type PipelineStepKey =
  | "idle"
  | "starting"
  | "script"
  | "review_script"
  | "voice"
  | "images"
  | "review_images"
  | "videos"
  | "edit"
  | "subtitles"
  | "slowdown"
  | "thumbnail"
  | "done"
  | "error";

type MoloMood = "happy" | "thinking" | "surprised" | "proud" | "worried";

const STEP_LABELS: Record<PipelineStepKey, string> = {
  idle: "Hazir",
  starting: "Baslatiliyor...",
  script: "Senaryo uretiiiyor...",
  review_script: "Senaryo inceleniyor",
  voice: "Sesler uretiliyor...",
  images: "Gorseller uretiliyor...",
  review_images: "Gorseller inceleniyor",
  videos: "Videolar uretiliyor (Kling)...",
  edit: "Kurgu yapiliyor...",
  subtitles: "Altyazi ekleniyor...",
  slowdown: "Final slowdown...",
  thumbnail: "Thumbnail uretiliyor...",
  done: "Tamamlandi!",
  error: "Hata olustu",
};

const STEP_DETAILS: Partial<Record<PipelineStepKey, { desc: string; eta: string }>> = {
  starting: { desc: "Pipeline baslatiliyor, brief okunuyor...", eta: "~5sn" },
  script: { desc: "Gemini ile sahne senaryosu olusturuluyor", eta: "~30sn" },
  review_script: { desc: "Senaryoyu inceleyin, duzenleyin, sonra gorsellere gecin", eta: "" },
  voice: { desc: "ElevenLabs ile ses dosyalari uretiliyor", eta: "~1dk" },
  images: { desc: "Nano Banana 2 ile referans gorselleri uretiliyor", eta: "~2dk" },
  review_images: { desc: "Gorselleri inceleyin -- kotu olanlari yeniden uretin, sonra devam edin", eta: "" },
  videos: { desc: "Kling API ile sahne videolari olusturuluyor", eta: "~5-10dk" },
  edit: { desc: "FFmpeg ile sahneler birlestiriliyor, crossfade uygulaniyor", eta: "~1dk" },
  subtitles: { desc: "Gemini ceviri + FFmpeg ile altyazi ekleniyor", eta: "~1dk" },
  slowdown: { desc: "Final video slowdown uygulaniyor", eta: "~30sn" },
  thumbnail: { desc: "Thumbnail gorseli uretiliyor", eta: "~30sn" },
  done: { desc: "Tum adimlar tamamlandi!", eta: "" },
  error: { desc: "Pipeline bir hatayla karsilasti", eta: "" },
};

const PIPELINE_STEPS: PipelineStepKey[] = [
  "script",
  "review_script",
  "images",
  "review_images",
  "voice",
  "videos",
  "edit",
  "subtitles",
  "done",
];

const STEP_MOODS: Partial<Record<PipelineStepKey, MoloMood>> = {
  script: "thinking",
  review_script: "thinking",
  images: "thinking",
  review_images: "thinking",
  voice: "happy",
  videos: "thinking",
  edit: "happy",
  subtitles: "happy",
  done: "proud",
  error: "worried",
};

const VOICE_DIRECTIONS = [
  "neutral",
  "excited",
  "calm",
  "serious",
  "warm",
  "playful",
  "professional",
];

const SHOT_TYPES = ["wide", "medium", "medium-close", "close"];

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface PipelineStatus {
  status: string;
  step: PipelineStepKey;
  progress: number;
  log: string;
  lastLine: string;
  isRunning: boolean;
  isError: boolean;
  isDone: boolean;
  isPaused?: boolean;
}

interface ProjectFiles {
  scenes_images: string[];
  scenes_videos: string[];
  audio: string[];
  draft: string[];
  final: string[];
  subtitles: string[];
}

interface ScriptEditScene {
  scene: number;
  text_de: string;
  text_tr?: string;
  voice_direction: string;
  shot_type: string;
  environment: string;
  emotion_note: string;
  molo_pose: string;
  background_description?: string;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/**
 * PipelineProgressPanel
 * Renders the pipeline progress bar, step indicators with MoloReaction,
 * elapsed time, and an expandable log viewer.
 */
function PipelineProgressPanel({
  status,
  elapsed,
}: {
  status: PipelineStatus;
  elapsed: number;
}) {
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const stepDetail = STEP_DETAILS[status.step];
  const mood = STEP_MOODS[status.step] ?? "thinking";

  useEffect(() => {
    if (showLog && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [showLog, status.log]);

  const logTail = useMemo(() => {
    if (!status.log) return "Log henuz bos...";
    return status.log.length > 1500
      ? status.log.slice(-1500)
      : status.log;
  }, [status.log]);

  return (
    <Card accent={status.isError ? "coral" : status.isDone ? "green" : "teal"}>
      <div style={{ padding: 20 }}>
        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MoloReaction mood={mood} size={28} />
            <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text-primary)" }}>
              {STEP_LABELS[status.step] || status.step}
            </span>
            {status.isPaused && (
              <Badge variant="review" pulse>Duraklatildi</Badge>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {elapsed > 0 && (
              <span style={{
                fontSize: 12, color: "var(--text-muted)",
                display: "flex", alignItems: "center", gap: 4,
                fontFamily: "var(--font-geist-mono)",
              }}>
                <Clock size={12} /> {formatElapsed(elapsed)}
              </span>
            )}
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: status.isError ? "var(--accent-coral)" : "var(--accent-teal)",
              fontFamily: "var(--font-geist-mono)",
            }}>
              {status.progress}%
            </span>
          </div>
        </div>

        {/* Step description */}
        {stepDetail && (
          <div style={{
            fontSize: 13, color: "var(--text-secondary)", marginBottom: 12,
            display: "flex", justifyContent: "space-between",
          }}>
            <span>{stepDetail.desc}</span>
            {stepDetail.eta && status.isRunning && (
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                Tahmini: {stepDetail.eta}
              </span>
            )}
          </div>
        )}

        {/* Progress bar with Molo */}
        <div style={{ marginBottom: 14 }}>
          <Progress
            value={status.progress}
            showMolo={status.isRunning}
            color={status.isError ? "coral" : status.isDone ? "teal" : "teal"}
          />
        </div>

        {/* Step indicators */}
        <div style={{
          display: "flex", gap: 3, marginBottom: 14, flexWrap: "wrap",
        }}>
          {PIPELINE_STEPS.map((step) => {
            const currentIdx = PIPELINE_STEPS.indexOf(status.step);
            const stepIdx = PIPELINE_STEPS.indexOf(step);
            const isPast = stepIdx < currentIdx;
            const isCurrent = step === status.step;
            const isReview = step === "review_script" || step === "review_images";

            return (
              <div
                key={step}
                style={{
                  flex: 1, minWidth: 55, textAlign: "center",
                  padding: "6px 4px", borderRadius: "var(--radius-sm)",
                  background: isPast
                    ? "rgba(20, 184, 166, 0.08)"
                    : isCurrent
                      ? isReview
                        ? "rgba(245, 158, 11, 0.08)"
                        : "rgba(20, 184, 166, 0.12)"
                      : "var(--bg-secondary)",
                  border: isCurrent
                    ? isReview
                      ? "1px solid rgba(245, 158, 11, 0.3)"
                      : "1px solid rgba(20, 184, 166, 0.3)"
                    : "1px solid transparent",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{
                  fontSize: 11, fontWeight: isCurrent ? 700 : isPast ? 500 : 400,
                  color: isPast
                    ? "var(--accent-green)"
                    : isCurrent
                      ? isReview ? "var(--accent-amber)" : "var(--accent-teal)"
                      : "var(--text-muted)",
                }}>
                  {isPast ? <CheckCircle2 size={11} /> : isCurrent && status.isRunning ? "●" : isCurrent && status.isPaused ? <Pause size={11} /> : "○"}
                </div>
                <div style={{
                  fontSize: 8, marginTop: 2, fontWeight: isCurrent ? 600 : 400,
                  color: isPast
                    ? "var(--accent-green)"
                    : isCurrent
                      ? isReview ? "var(--accent-amber)" : "var(--accent-teal)"
                      : "var(--text-muted)",
                }}>
                  {step.replace("_", " ")}
                </div>
              </div>
            );
          })}
        </div>

        {/* Last activity line */}
        <div style={{
          fontSize: 12, color: "var(--text-secondary)", padding: "8px 12px",
          background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)",
          marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", border: "1px solid var(--border-subtle)",
          fontFamily: "var(--font-geist-mono)",
        }}>
          {status.lastLine || "Bekleniyor..."}
        </div>

        {/* Toggle log */}
        <Button
          variant="ghost"
          size="sm"
          icon={showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          onClick={() => setShowLog(!showLog)}
          style={{ fontSize: 11 }}
        >
          {showLog ? "Log gizle" : "Detayli log goster"}
        </Button>
        {showLog && (
          <pre
            ref={logRef}
            style={{
              marginTop: 8, padding: 14,
              background: "var(--bg-primary)", borderRadius: "var(--radius-md)",
              fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6,
              maxHeight: 360, overflow: "auto", whiteSpace: "pre-wrap",
              wordBreak: "break-word", border: "1px solid var(--border-subtle)",
              fontFamily: "var(--font-geist-mono)",
            }}
          >
            {logTail}
          </pre>
        )}
      </div>
    </Card>
  );
}

/**
 * ScriptReviewPanel
 * Editable scene list for review_script state.
 * Users can edit text, voice_direction, shot_type, environment per scene.
 * Add/remove scenes, then approve to proceed to images.
 */
function ScriptReviewPanel({
  projectId,
  initialScenes,
  onApprove,
}: {
  projectId: string;
  initialScenes: Scene[];
  onApprove: () => void;
}) {
  const toast = useToast();
  const [scenes, setScenes] = useState<ScriptEditScene[]>(() =>
    initialScenes.map((s) => ({
      scene: s.scene,
      text_de: s.text_de,
      text_tr: s.text_tr,
      voice_direction: s.voice_direction,
      shot_type: s.shot_type,
      environment: s.environment,
      emotion_note: s.emotion_note,
      molo_pose: s.molo_pose,
      background_description: s.background_description,
    }))
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const updateSceneField = useCallback(
    (idx: number, field: keyof ScriptEditScene, value: string) => {
      setScenes((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
      );
    },
    []
  );

  const addScene = useCallback(() => {
    setScenes((prev) => [
      ...prev,
      {
        scene: prev.length + 1,
        text_de: "",
        voice_direction: "neutral",
        shot_type: "medium",
        environment: "",
        emotion_note: "",
        molo_pose: "default",
      },
    ]);
    setEditingIdx(scenes.length);
  }, [scenes.length]);

  const removeScene = useCallback((idx: number) => {
    setScenes((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((s, i) => ({ ...s, scene: i + 1 }));
    });
    setEditingIdx(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pipeline/edit-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, scenes }),
      });
      if (res.ok) {
        toast.success("Senaryo kaydedildi");
      } else {
        const d = await res.json();
        toast.error(d.error || "Kayit basarisiz");
      }
    } catch {
      toast.error("Kayit hatasi");
    } finally {
      setSaving(false);
    }
  }, [projectId, scenes, toast]);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      // First save
      await fetch("/api/pipeline/edit-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, scenes }),
      });
      // Then resume pipeline
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        toast.success("Senaryo onaylandi -- gorsel uretimi basliyor...");
        onApprove();
      } else {
        const d = await res.json();
        toast.error(d.error || "Onay basarisiz");
      }
    } catch {
      toast.error("Onay hatasi");
    } finally {
      setApproving(false);
    }
  }, [projectId, scenes, toast, onApprove]);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Header */}
      <Card accent="amber">
        <div style={{ padding: 20 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
          }}>
            <MoloReaction mood="thinking" size={32} />
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Senaryo Incelemesi
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                Sahne metinlerini duzenleyin, sahne ekleyin/silin, ardindan gorsellere gecin.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Scene list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {scenes.map((scene, idx) => {
          const isEditing = editingIdx === idx;

          return (
            <Card key={idx}>
              <div style={{ padding: 16 }}>
                {/* Scene header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge variant="info">S{scene.scene}</Badge>
                    <Badge variant="draft">{scene.shot_type}</Badge>
                    <Badge variant="draft">{scene.voice_direction}</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button
                      variant={isEditing ? "primary" : "ghost"}
                      size="sm"
                      icon={isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
                      onClick={() => setEditingIdx(isEditing ? null : idx)}
                    >
                      {isEditing ? "Onizle" : "Duzenle"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={14} />}
                      onClick={() => removeScene(idx)}
                      style={{ color: "var(--accent-coral)" }}
                      aria-label={`Sahne ${scene.scene} sil`}
                    />
                  </div>
                </div>

                {isEditing ? (
                  /* Edit mode */
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Scene text */}
                    <div>
                      <label className="label">Sahne Metni (DE)</label>
                      <textarea
                        className="input textarea"
                        rows={4}
                        value={scene.text_de}
                        onChange={(e) => updateSceneField(idx, "text_de", e.target.value)}
                        style={{ resize: "vertical", width: "100%", lineHeight: 1.6 }}
                        placeholder="Sahne metnini yazin..."
                      />
                    </div>

                    {/* Dropdowns row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <div>
                        <label className="label">Ses Yonu</label>
                        <select
                          className="input"
                          value={scene.voice_direction}
                          onChange={(e) => updateSceneField(idx, "voice_direction", e.target.value)}
                        >
                          {VOICE_DIRECTIONS.map((vd) => (
                            <option key={vd} value={vd}>{vd}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Cekim Tipi</label>
                        <select
                          className="input"
                          value={scene.shot_type}
                          onChange={(e) => updateSceneField(idx, "shot_type", e.target.value)}
                        >
                          {SHOT_TYPES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Ortam</label>
                        <input
                          className="input"
                          type="text"
                          value={scene.environment}
                          onChange={(e) => updateSceneField(idx, "environment", e.target.value)}
                          placeholder="studio, outdoor..."
                        />
                      </div>
                    </div>

                    {/* Emotion note */}
                    <div>
                      <label className="label">Duygu Notu</label>
                      <input
                        className="input"
                        type="text"
                        value={scene.emotion_note}
                        onChange={(e) => updateSceneField(idx, "emotion_note", e.target.value)}
                        placeholder="Sahnenin duygusal tonu..."
                      />
                    </div>
                  </div>
                ) : (
                  /* Preview mode */
                  <div>
                    <p style={{
                      fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6,
                      whiteSpace: "pre-wrap", margin: 0,
                    }}>
                      {scene.text_de || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Metin bos</span>}
                    </p>
                    {scene.environment && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                        Ortam: {scene.environment}
                      </div>
                    )}
                    {scene.emotion_note && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        Duygu: {scene.emotion_note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add scene button */}
      <Button
        variant="ghost"
        icon={<Plus size={16} />}
        onClick={addScene}
        style={{ marginTop: 12, width: "100%", border: "2px dashed var(--border-subtle)" }}
      >
        Sahne Ekle
      </Button>

      {/* Action buttons */}
      <div style={{
        display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end",
      }}>
        <Button
          variant="secondary"
          icon={<Save size={16} />}
          onClick={handleSave}
          loading={saving}
        >
          Kaydet
        </Button>
        <Button
          variant="primary"
          icon={<SkipForward size={16} />}
          onClick={handleApprove}
          loading={approving}
          style={{ background: "linear-gradient(135deg, var(--accent-teal), var(--accent-cyan))" }}
        >
          Onayla & Gorsellere Gec
        </Button>
      </div>
    </div>
  );
}

/**
 * ImageReviewPanel
 * Split layout: Scene list on left, ImageApprovalPanel + SceneConfigurator on right.
 * Active scene selection, approve-all button.
 */
function ImageReviewPanel({
  projectId,
  project,
  onApprove,
}: {
  projectId: string;
  project: Project;
  onApprove: () => void;
}) {
  const toast = useToast();
  const [activeIdx, setActiveIdx] = useState(0);
  const [approving, setApproving] = useState(false);
  const [regeneratingScene, setRegeneratingScene] = useState<{
    scene: number;
    variant: number;
  } | null>(null);
  const approveAllImages = useStudioStore((s) => s.approveAllImages);

  const activeScene = project.scenes[activeIdx];

  const allApproved = useMemo(() => {
    return project.scenes.every(
      (s) => s.selectedImageId || s.imageVariants.length === 0
    );
  }, [project.scenes]);

  const handleRegenerate = useCallback(
    async (sceneNumber: number, variantIndex: number) => {
      setRegeneratingScene({ scene: sceneNumber, variant: variantIndex });
      try {
        const res = await fetch("/api/pipeline/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            sceneIndex: sceneNumber - 1,
            variantIndex,
          }),
        });
        const d = await res.json();
        if (res.ok) {
          toast.success(`Sahne ${sceneNumber} varyant ${variantIndex + 1} yeniden uretildi`);
        } else {
          toast.error(d.error || "Yeniden uretim basarisiz");
        }
      } catch {
        toast.error("Yeniden uretim hatasi");
      } finally {
        setRegeneratingScene(null);
      }
    },
    [projectId, toast]
  );

  const handleApproveAll = useCallback(async () => {
    setApproving(true);
    try {
      const approvals = approveAllImages(projectId);
      if (!approvals) {
        toast.error("Tum sahneler icin gorsel secimi yapilmali");
        setApproving(false);
        return;
      }

      // Save approvals
      const saveRes = await fetch("/api/pipeline/approve-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, approvals }),
      });
      if (!saveRes.ok) {
        const d = await saveRes.json();
        toast.error(d.error || "Onay kaydi basarisiz");
        setApproving(false);
        return;
      }

      // Resume pipeline
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        toast.success("Gorseller onaylandi -- ses uretimi basliyor...");
        onApprove();
      } else {
        const d = await res.json();
        toast.error(d.error || "Resume basarisiz");
      }
    } catch {
      toast.error("Onay hatasi");
    } finally {
      setApproving(false);
    }
  }, [projectId, approveAllImages, toast, onApprove]);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Header banner */}
      <Card accent="amber">
        <div style={{ padding: 20 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <MoloReaction mood="thinking" size={32} />
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Gorsel Incelemesi
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                Her sahne icin bir gorsel varyant secin. Begenmediginizi yeniden uretin.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Split layout */}
      <div style={{
        display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, marginTop: 16,
      }}>
        {/* Left: Scene list sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {project.scenes.map((s, idx) => (
            <SceneCard
              key={s.scene}
              scene={s}
              isActive={idx === activeIdx}
              hasImage={s.imageVariants.length > 0}
              isApproved={!!s.selectedImageId}
              onClick={() => setActiveIdx(idx)}
            />
          ))}

          {/* Summary */}
          <div style={{
            marginTop: 12, padding: 12,
            background: "var(--bg-secondary)", borderRadius: "var(--radius-md)",
            fontSize: 12, color: "var(--text-muted)",
          }}>
            <div>
              Secilen: {project.scenes.filter((s) => s.selectedImageId).length} / {project.scenes.length}
            </div>
          </div>
        </div>

        {/* Right: Approval + Configurator */}
        <div>
          {activeScene && (
            <>
              <ImageApprovalPanel
                projectId={projectId}
                scene={activeScene}
                onRegenerate={handleRegenerate}
              />
              <div style={{ marginTop: 16 }}>
                <SceneConfigurator
                  projectId={projectId}
                  scene={activeScene}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Approve all button */}
      <div style={{ marginTop: 20 }}>
        <Button
          variant="primary"
          icon={<SkipForward size={18} />}
          onClick={handleApproveAll}
          loading={approving}
          disabled={!allApproved}
          style={{
            width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 700,
            background: allApproved
              ? "linear-gradient(135deg, var(--accent-teal), var(--accent-cyan))"
              : undefined,
          }}
        >
          {allApproved
            ? "Tumunu Onayla & Sese Gec"
            : `${project.scenes.filter((s) => !s.selectedImageId).length} sahne secim bekliyor`}
        </Button>
      </div>
    </div>
  );
}

/**
 * CompletionView
 * Shown when pipeline is done. MoloWave celebration + navigation links.
 */
function CompletionView({
  projectId,
  project,
}: {
  projectId: string;
  project: Project;
}) {
  const router = useRouter();

  return (
    <Card accent="green">
      <div style={{
        padding: 40, display: "flex", flexDirection: "column",
        alignItems: "center", textAlign: "center",
      }}>
        <MoloWave size={100} />
        <h2 style={{
          fontSize: 24, fontWeight: 700, color: "var(--accent-green)",
          marginTop: 16, marginBottom: 8,
        }}>
          Pipeline Tamamlandi!
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
          {project.scenes.length} sahne basariyla uretildi.
        </p>
        {project.durations.length > 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            Toplam sure: {project.durations.reduce((a, b) => a + b, 0).toFixed(1)}s
          </p>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Button
            variant="primary"
            icon={<Film size={16} />}
            onClick={() => router.push(`/edit?project=${projectId}`)}
          >
            Kurgu Sayfasi
          </Button>
          <Button
            variant="secondary"
            icon={<Volume2 size={16} />}
            onClick={() => router.push(`/voice?project=${projectId}`)}
          >
            Sesler
          </Button>
          <Button
            variant="secondary"
            icon={<ImageIcon size={16} />}
            onClick={() => router.push(`/images?project=${projectId}`)}
          >
            Gorseller
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * SceneDetailView
 * Default scene detail for non-review states (viewing existing scenes).
 */
function SceneDetailView({
  scene,
  project,
  projectId,
  sceneIdx,
  files,
}: {
  scene: Scene;
  project: Project;
  projectId: string;
  sceneIdx: number;
  files: ProjectFiles;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const pad = (n: number) => String(n).padStart(2, "0");
  const sceneImage = files.scenes_images.find((f) => f.includes(`scene_${pad(scene.scene)}`));
  const sceneVideo = files.scenes_videos.find((f) => f.includes(`scene_${pad(scene.scene)}`));
  const sceneAudio = files.audio.find((f) => f.includes(`scene_${pad(scene.scene)}`));

  const toggleAudio = useCallback(
    (audioPath: string) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (playingAudio) {
        setPlayingAudio(false);
        return;
      }
      const audio = new Audio(audioPath);
      audio.onended = () => setPlayingAudio(false);
      audio.play();
      audioRef.current = audio;
      setPlayingAudio(true);
    },
    [playingAudio]
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  return (
    <>
      <Card>
        <div style={{ padding: 24 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
              Sahne {scene.scene} / {project.scenes.length}
            </h2>
            <Badge variant="draft">{scene.voice_direction}</Badge>
          </div>

          {/* Image preview */}
          {sceneImage && (
            <div style={{
              marginBottom: 20, borderRadius: "var(--radius-md)",
              overflow: "hidden", position: "relative",
            }}>
              <img
                src={sceneImage}
                alt={`Sahne ${scene.scene}`}
                style={{
                  width: "100%", maxHeight: 300, objectFit: "contain",
                  background: "var(--bg-secondary)", display: "block", cursor: "zoom-in",
                }}
                onClick={() => setLightbox(sceneImage)}
              />
              <button
                onClick={() => setLightbox(sceneImage)}
                style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,0.4)", border: "none",
                  borderRadius: "50%", width: 32, height: 32, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                aria-label="Gorseli buyut"
              >
                <ZoomIn size={16} style={{ color: "#fff" }} />
              </button>
            </div>
          )}

          {/* Video preview */}
          {sceneVideo && (
            <div style={{ marginBottom: 20 }}>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <FileVideo size={12} /> Video
              </label>
              <video
                controls
                style={{
                  width: "100%", maxHeight: 250,
                  borderRadius: "var(--radius-md)", background: "var(--bg-secondary)",
                }}
                poster={sceneImage}
              >
                <source src={sceneVideo} type="video/mp4" />
              </video>
            </div>
          )}

          {/* Audio playback */}
          {sceneAudio && (
            <div style={{
              marginBottom: 20, display: "flex", alignItems: "center", gap: 10,
            }}>
              <Button
                variant="secondary"
                size="sm"
                icon={playingAudio ? <Pause size={16} /> : <Play size={16} />}
                onClick={() => toggleAudio(sceneAudio)}
                style={{ width: 36, height: 36, padding: 0 }}
              />
              <div>
                <label className="label" style={{ marginBottom: 0 }}>Ses Dosyasi</label>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {project.durations[sceneIdx] ? `${project.durations[sceneIdx].toFixed(1)}s` : ""}
                </div>
              </div>
            </div>
          )}

          {/* Scene text */}
          <div style={{ marginBottom: 20 }}>
            <label className="label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Mic2 size={12} /> Metin (DE)
            </label>
            <div
              className="input textarea"
              style={{ whiteSpace: "pre-wrap", minHeight: 72, lineHeight: 1.6 }}
            >
              {scene.text_de || "Metin bulunamadi"}
            </div>
          </div>

          {/* Turkish translation */}
          {scene.text_tr && (
            <div style={{ marginBottom: 20 }}>
              <label className="label">Metin (TR)</label>
              <div
                className="input textarea"
                style={{
                  whiteSpace: "pre-wrap", minHeight: 56, lineHeight: 1.6,
                  color: "var(--text-secondary)",
                }}
              >
                {scene.text_tr}
              </div>
            </div>
          )}

          {/* Scene details grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20,
          }}>
            <div>
              <label className="label">Ortam</label>
              <div className="input" style={{ fontSize: 13 }}>{scene.environment}</div>
            </div>
            <div>
              <label className="label">Poz</label>
              <div className="input" style={{ fontSize: 13 }}>{scene.molo_pose}</div>
            </div>
            <div>
              <label className="label">Ses Yonu</label>
              <div className="input" style={{ fontSize: 13 }}>{scene.voice_direction}</div>
            </div>
            <div>
              <label className="label">Shot</label>
              <div className="input" style={{ fontSize: 13 }}>{scene.shot_type}</div>
            </div>
          </div>

          {/* Emotion note */}
          {scene.emotion_note && (
            <div style={{ marginBottom: 20 }}>
              <label className="label">Duygu Notu</label>
              <div className="input" style={{ fontSize: 13 }}>{scene.emotion_note}</div>
            </div>
          )}

          {/* Navigation links */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/images?project=${projectId}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
              <ImageIcon size={14} /> Gorseller <ChevronRight size={14} />
            </Link>
            <Link href={`/voice?project=${projectId}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
              <Mic2 size={14} /> Sesler <ChevronRight size={14} />
            </Link>
            <Link href={`/video?project=${projectId}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
              <Film size={14} /> Videolar <ChevronRight size={14} />
            </Link>
            <Link href={`/edit?project=${projectId}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
              <ChevronRight size={14} /> Kurgu
            </Link>
          </div>
        </div>
      </Card>

      {/* Lightbox */}
      {lightbox && (
        <Modal open onClose={() => setLightbox(null)} size="lg">
          <img
            src={lightbox}
            alt="Buyutulmus gorsel"
            style={{ width: "100%", borderRadius: "var(--radius-md)" }}
          />
        </Modal>
      )}
    </>
  );
}

// ─── Main Content ───────────────────────────────────────────────────────────

function ScenesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("project");
  const toast = useToast();

  // Local state
  const [project, setProject] = useState<Project | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [files, setFiles] = useState<ProjectFiles>({
    scenes_images: [], scenes_videos: [], audio: [],
    draft: [], final: [], subtitles: [],
  });
  const [elapsed, setElapsed] = useState(0);
  const [pipelineStartTime, setPipelineStartTime] = useState<number | null>(null);

  // Store integration
  const storeSetProjects = useStudioStore((s) => s.setProjects);

  // Refs for intervals
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef(false);
  const redirectedRef = useRef(false);

  // ─── Data Fetchers ──────────────────────────────────────────────────────

  const fetchProject = useCallback(() => {
    if (!projectId) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        const p = data.find((x) => x.id === projectId);
        if (p) {
          setProject(p);
          storeSetProjects(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, storeSetProjects]);

  const fetchFiles = useCallback(() => {
    if (!projectId) return;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
      .then((r) => r.json())
      .then((data: ProjectFiles) => setFiles(data))
      .catch(() => {});
  }, [projectId]);

  const fetchStatus = useCallback(() => {
    if (!projectId) return;
    fetch(`/api/pipeline/status?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((data: PipelineStatus) => {
        setPipelineStatus(data);

        // Start elapsed timer if running and not yet started
        if (data.isRunning && !elapsedRef.current) {
          setPipelineStartTime(Date.now());
          elapsedRef.current = setInterval(() => {
            setPipelineStartTime((prev) => {
              if (!prev) return prev;
              setElapsed(Math.floor((Date.now() - prev) / 1000));
              return prev;
            });
          }, 1000);
        }

        // Handle completion or error
        if (data.isDone || data.isError) {
          fetchProject();
          fetchFiles();
          if (elapsedRef.current) {
            clearInterval(elapsedRef.current);
            elapsedRef.current = null;
          }
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            if (data.isDone) {
              toast.success("Pipeline tamamlandi!");
              if (!redirectedRef.current) {
                redirectedRef.current = true;
                setTimeout(() => {
                  router.push(`/edit?project=${projectId}`);
                }, 3000);
              }
            }
            if (data.isError) toast.error("Pipeline hatasi -- logu kontrol edin");
          }
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      })
      .catch(console.error);
  }, [projectId, fetchProject, fetchFiles, toast, router]);

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchProject();
    fetchFiles();
    fetchStatus();
  }, [fetchProject, fetchFiles, fetchStatus]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      fetchStatus();
      fetchFiles();
      fetchProject();
    }, 3000);
  }, [fetchStatus, fetchFiles, fetchProject]);

  // Auto-start polling when pipeline is running or paused
  useEffect(() => {
    if ((pipelineStatus?.isRunning || pipelineStatus?.isPaused) && !pollingRef.current) {
      startPolling();
    }
  }, [pipelineStatus?.isRunning, pipelineStatus?.isPaused, startPolling]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!project) return;
      // Don't capture when user is typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveScene((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveScene((prev) => Math.min(project.scenes.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [project]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handlePipeline = async () => {
    if (!projectId) return;
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.pid) {
        notifiedRef.current = false;
        redirectedRef.current = false;
        toast.info("Pipeline baslatildi -- ilerleme takip ediliyor...");
        setPipelineStatus({
          status: "running",
          step: "starting" as PipelineStepKey,
          progress: 5,
          log: "",
          lastLine: "Pipeline baslatildi...",
          isRunning: true,
          isError: false,
          isDone: false,
        });
        startPolling();
      }
    } catch {
      toast.error("Pipeline baslatilamadi");
    }
  };

  const handleStopPipeline = async () => {
    if (!projectId) return;
    try {
      const res = await fetch("/api/pipeline", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        toast.info("Pipeline durduruldu");
        fetchStatus();
      }
    } catch {
      toast.error("Pipeline durdurulamadi");
    }
  };

  // ─── Derived State ────────────────────────────────────────────────────

  const isRunning = pipelineStatus?.isRunning ?? false;
  const isPaused = pipelineStatus?.isPaused ?? false;
  const currentStep = pipelineStatus?.step as PipelineStepKey | undefined;
  const isReviewScript = currentStep === "review_script";
  const isReviewImages = currentStep === "review_images";
  const isDone = pipelineStatus?.isDone ?? false;
  const isError = pipelineStatus?.isError ?? false;
  const showProgress =
    pipelineStatus && pipelineStatus.status !== "idle" && !isReviewScript && !isReviewImages;

  // ─── Empty States ─────────────────────────────────────────────────────

  if (!projectId) {
    return (
      <EmptyState
        title="Proje secilmedi"
        description="Dashboard'dan bir proje secin"
        action={{ label: "Dashboard'a Don", onClick: () => router.push("/") }}
        icon={<Film size={64} color="var(--text-muted)" />}
      />
    );
  }

  if (loading) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: 80,
      }}>
        <MoloLoading size={56} text="Yukleniyor..." />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Proje bulunamadi"
        description="Bu proje mevcut degil veya silinmis olabilir"
        action={{ label: "Dashboard'a Don", onClick: () => router.push("/") }}
        icon={<Film size={64} color="var(--text-muted)" />}
      />
    );
  }

  const scene = project.scenes[activeScene];

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <>
      {/* Page Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: "var(--radius-md)",
              background: "var(--bg-secondary)", color: "var(--text-secondary)",
              textDecoration: "none", border: "1px solid var(--border-subtle)",
            }}
            aria-label="Dashboard'a don"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {project.title || project.name}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>
              {project.scenes.length} sahne &middot; {project.contentType} &middot; {project.lang.toUpperCase()}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {(isRunning && !isPaused) && (
            <Button
              variant="ghost"
              size="sm"
              icon={<XCircle size={16} />}
              onClick={handleStopPipeline}
              style={{ color: "var(--accent-coral)" }}
            >
              Durdur
            </Button>
          )}
          <Button
            variant="primary"
            icon={isRunning ? undefined : <Play size={16} />}
            onClick={handlePipeline}
            loading={isRunning && !isPaused}
            disabled={isRunning || isPaused}
          >
            {isRunning ? "Calisiyor..." : isPaused ? "Duraklatildi" : "Pipeline Baslat"}
          </Button>
        </div>
      </header>

      {/* Pipeline Progress -- visible during generation steps */}
      {showProgress && (
        <div style={{ marginBottom: 20 }}>
          <PipelineProgressPanel status={pipelineStatus} elapsed={elapsed} />
        </div>
      )}

      {/* ── SCRIPT REVIEW MODE ─────────────────────────────────────────── */}
      {isReviewScript && project.scenes.length > 0 && (
        <>
          {pipelineStatus && (
            <div style={{ marginBottom: 16 }}>
              <PipelineProgressPanel status={pipelineStatus} elapsed={elapsed} />
            </div>
          )}
          <ScriptReviewPanel
            projectId={projectId}
            initialScenes={project.scenes}
            onApprove={() => {
              fetchStatus();
              fetchProject();
            }}
          />
        </>
      )}

      {/* ── IMAGE REVIEW MODE ──────────────────────────────────────────── */}
      {isReviewImages && project.scenes.length > 0 && (
        <>
          {pipelineStatus && (
            <div style={{ marginBottom: 16 }}>
              <PipelineProgressPanel status={pipelineStatus} elapsed={elapsed} />
            </div>
          )}
          <ImageReviewPanel
            projectId={projectId}
            project={project}
            onApprove={() => {
              fetchStatus();
              fetchProject();
            }}
          />
        </>
      )}

      {/* ── COMPLETION VIEW ────────────────────────────────────────────── */}
      {isDone && (
        <div style={{ marginBottom: 24 }}>
          <CompletionView projectId={projectId} project={project} />
        </div>
      )}

      {/* ── ERROR VIEW ─────────────────────────────────────────────────── */}
      {isError && pipelineStatus && (
        <Card accent="coral">
          <div style={{
            padding: 24, display: "flex", flexDirection: "column",
            alignItems: "center", textAlign: "center",
          }}>
            <MoloReaction mood="worried" size={48} />
            <h3 style={{
              fontSize: 18, fontWeight: 700, color: "var(--accent-coral)",
              marginTop: 12, marginBottom: 8,
            }}>
              Pipeline Hatasi
            </h3>
            <p style={{
              fontSize: 13, color: "var(--text-secondary)", marginBottom: 16,
              maxWidth: 480,
            }}>
              {pipelineStatus.lastLine || "Bilinmeyen hata"}
            </p>
            <Button
              variant="primary"
              icon={<RefreshCw size={16} />}
              onClick={handlePipeline}
            >
              Tekrar Dene
            </Button>
          </div>
        </Card>
      )}

      {/* ── DEFAULT SCENE VIEW ─────────────────────────────────────────── */}
      {!isReviewScript && !isReviewImages && !isDone && (
        <>
          {project.scenes.length === 0 ? (
            <EmptyState
              title={isRunning ? "Sahneler olusturuluyor..." : "Henuz sahne yok"}
              description={
                isRunning
                  ? "Sahne verileri olusturuluyor, sayfa otomatik guncellenecek..."
                  : "Pipeline'i baslatarak senaryo uretin"
              }
              action={
                isRunning
                  ? undefined
                  : { label: "Senaryo Uret & Pipeline Baslat", onClick: handlePipeline }
              }
              icon={
                isRunning
                  ? <MoloLoading size={64} />
                  : <Sparkles size={64} color="var(--accent-teal)" />
              }
            />
          ) : (
            <div style={{
              display: "grid", gridTemplateColumns: "280px 1fr",
              gap: 20, alignItems: "start",
            }}>
              {/* Left: Timeline sidebar */}
              <aside style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: "var(--text-secondary)",
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
                }}>
                  <Film size={16} color="var(--accent-teal)" /> Timeline
                </div>

                {project.scenes.map((s, i) => {
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const hasImg = files.scenes_images.some((f) => f.includes(`scene_${pad(s.scene)}`));

                  return (
                    <SceneCard
                      key={s.scene}
                      scene={s}
                      isActive={i === activeScene}
                      hasImage={hasImg}
                      isApproved={!!s.selectedImageId}
                      onClick={() => setActiveScene(i)}
                    />
                  );
                })}

                {/* File summary */}
                <div style={{
                  marginTop: 12, padding: 14,
                  background: "var(--bg-secondary)", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                }}>
                  <div style={{
                    fontWeight: 600, fontSize: 12, color: "var(--text-secondary)",
                    display: "flex", alignItems: "center", gap: 4, marginBottom: 8,
                  }}>
                    <FolderOpen size={13} /> Proje Dosyalari
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
                    <span>{files.scenes_images.length} gorsel</span>
                    <span>{files.audio.length} ses</span>
                    <span>{files.scenes_videos.length} video</span>
                    <span>{files.draft.length} draft</span>
                    <span>{files.final.length} final</span>
                    <span>{files.subtitles.length} altyazi</span>
                    {project.durations.length > 0 && (
                      <span style={{ fontWeight: 600, marginTop: 4 }}>
                        Toplam: {project.durations.reduce((a, b) => a + b, 0).toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
              </aside>

              {/* Right: Scene detail */}
              <main>
                {scene && (
                  <SceneDetailView
                    scene={scene}
                    project={project}
                    projectId={projectId}
                    sceneIdx={activeScene}
                    files={files}
                  />
                )}
              </main>
            </div>
          )}
        </>
      )}

      {/* Floating Molo decoration */}
      <div style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 10,
        pointerEvents: "none",
      }}>
        <MoloFloat size={60} opacity={0.1} />
      </div>
    </>
  );
}

// ─── Page Export ─────────────────────────────────────────────────────────────

export default function ScenesPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 80,
        }}>
          <MoloLoading size={48} text="Sahneler yukleniyor..." />
        </div>
      }
    >
      <ScenesContent />
    </Suspense>
  );
}
