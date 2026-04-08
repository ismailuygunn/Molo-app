"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Square,
  SkipForward,
  RefreshCw,
  Volume2,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  Edit3,
} from "lucide-react";
import { useStudioStore } from "@/store/studio";
import type { Scene, PipelineStep } from "@/store/studio";
import { useToast } from "@/components/toast";
import { Card, Button, Badge, Progress, EmptyState } from "@/components/ui";
import { ImageApprovalPanel } from "@/components/scenes";
import { MoloLoading } from "@/components/molo";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PipelineStatus {
  step: string;
  progress: number;
  message: string;
  isRunning: boolean;
  isPaused: boolean;
  isDone: boolean;
  isError: boolean;
}

interface ProjectFiles {
  scenes_images: string[];
  audio: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  idle: "Hazir",
  starting: "Baslatiliyor...",
  script: "Senaryo uretiliyor...",
  images: "Gorseller uretiliyor...",
  image_review: "Gorsel onayi bekleniyor",
  review_images: "Gorsel onayi bekleniyor",
  review_script: "Senaryo inceleniyor",
  voice: "Sesler uretiliyor...",
  done: "Tamamlandi!",
  error: "Hata olustu",
};

const STEP_BADGE_VARIANT: Record<string, "draft" | "review" | "final" | "error" | "info" | "success"> = {
  idle: "draft",
  starting: "info",
  script: "review",
  images: "review",
  image_review: "review",
  review_images: "review",
  review_script: "review",
  voice: "review",
  done: "success",
  error: "error",
};

const POLL_INTERVAL_MS = 2000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function findSceneImage(images: string[], sceneNumber: number): string | null {
  const padded = String(sceneNumber).padStart(2, "0");
  return (
    images.find(
      (img) => img.includes(`scene_${padded}`) || img.includes(`scene${padded}`)
    ) ?? null
  );
}

function findSceneAudio(audioFiles: string[], sceneNumber: number): string | null {
  const padded = String(sceneNumber).padStart(2, "0");
  return (
    audioFiles.find(
      (a) => a.includes(`scene_${padded}`) || a.includes(`scene${padded}`)
    ) ?? null
  );
}

// ─── Audio Player ───────────────────────────────────────────────────────────

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
    setPlaying(!playing);
  }, [playing]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
      <Button
        variant="ghost"
        size="sm"
        icon={<Volume2 size={14} />}
        onClick={toggle}
        aria-label={playing ? "Sesi durdur" : "Sesi oynat"}
        style={
          playing
            ? { color: "var(--accent-teal)", borderColor: "var(--accent-teal)" }
            : undefined
        }
      >
        {playing ? "Oynatiliyor..." : "Dinle"}
      </Button>
    </div>
  );
}

// ─── Scene Row ──────────────────────────────────────────────────────────────

interface SceneRowProps {
  scene: Scene;
  imageUrl: string | null;
  audioUrl: string | null;
  showApproval: boolean;
  projectId: string;
  lang: string;
  qcScore?: Record<string, { score: number }>;
  isEditable: boolean;
  onEditSave?: (sceneNumber: number, text: string) => void;
}

function SceneRow({ scene, imageUrl, audioUrl, showApproval, projectId, lang, qcScore, isEditable, onEditSave }: SceneRowProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const displayText = lang === "tr" ? (scene.text_tr || scene.text_de) : scene.text_de;
  return (
    <Card hover={false}>
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: 20,
          flexWrap: "wrap",
        }}
      >
        {/* Image */}
        <div
          style={{
            width: 180,
            minHeight: 120,
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "var(--bg-secondary)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Sahne ${scene.scene}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
          ) : (
            <ImageIcon size={28} color="var(--text-muted)" style={{ opacity: 0.3 }} />
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Sahne {scene.scene}
            </h3>
            {scene.shot_type && <Badge variant="draft">{scene.shot_type}</Badge>}
            {scene.emotion_note && <Badge variant="info">{scene.emotion_note}</Badge>}
            {qcScore && (
              <Badge variant={Object.values(qcScore)[0]?.score >= 7 ? "final" : Object.values(qcScore)[0]?.score >= 5 ? "review" : "error"}>
                QC: {Math.round(Object.values(qcScore).reduce((sum, v) => sum + v.score, 0) / Object.values(qcScore).length)}/10
              </Badge>
            )}
          </div>

          {editing ? (
            <div style={{ marginBottom: 10 }}>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={{
                  width: "100%", minHeight: 80, padding: "8px 12px",
                  fontSize: 14, lineHeight: 1.6, borderRadius: "var(--radius-md)",
                  border: "1px solid var(--accent-teal)", background: "var(--bg-secondary)",
                  color: "var(--text-primary)", resize: "vertical", fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button variant="primary" size="sm" onClick={() => {
                  onEditSave?.(scene.scene, editText);
                  setEditing(false);
                }}>Kaydet</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Iptal</Button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", margin: "0 0 10px", cursor: isEditable ? "pointer" : "default" }}
               onClick={() => { if (isEditable) { setEditText(displayText); setEditing(true); } }}
               title={isEditable ? "Tiklayarak duzenle" : undefined}
            >
              {displayText}
              {isEditable && <Edit3 size={12} style={{ marginLeft: 6, opacity: 0.4, verticalAlign: "middle" }} />}
            </p>
          )}

          {/* Metadata */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: audioUrl ? 10 : 0,
            }}
          >
            {scene.voice_direction && (
              <span>Yonlendirme: {scene.voice_direction}</span>
            )}
            {scene.environment && <span>Ortam: {scene.environment}</span>}
            {scene.molo_pose && <span>Poz: {scene.molo_pose}</span>}
            {(scene as unknown as Record<string, unknown>).word_count != null && (
              <span>{String((scene as unknown as Record<string, unknown>).word_count)} kelime</span>
            )}
            {(scene as unknown as Record<string, unknown>).estimated_duration_s != null && (
              <span>~{String((scene as unknown as Record<string, unknown>).estimated_duration_s)}s</span>
            )}
          </div>

          {/* Audio */}
          {audioUrl && <AudioPlayer src={audioUrl} />}
        </div>
      </div>

      {/* Image Approval */}
      {showApproval && scene.imageVariants.length > 0 && (
        <div style={{ padding: "0 20px 20px" }}>
          <ImageApprovalPanel projectId={projectId} scene={scene} />
        </div>
      )}
    </Card>
  );
}

// ─── Main Content ───────────────────────────────────────────────────────────

function ScenesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const projectId = searchParams.get("project");

  const updateProject = useStudioStore((s) => s.updateProject);
  const approveAllImages = useStudioStore((s) => s.approveAllImages);
  const projects = useStudioStore((s) => s.projects);

  const project = projects.find((p) => p.id === projectId);

  const [status, setStatus] = useState<PipelineStatus>({
    step: "idle",
    progress: 0,
    message: "",
    isRunning: false,
    isPaused: false,
    isDone: false,
    isError: false,
  });
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [files, setFiles] = useState<ProjectFiles>({ scenes_images: [], audio: [] });
  const [lang, setLang] = useState("de");
  const [qcScores, setQcScores] = useState<Record<string, Record<string, { score: number }>>>({});
  const [logTail, setLogTail] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // TikTok data
  const [hookText, setHookText] = useState("");
  const [hookAlternatives, setHookAlternatives] = useState<string[]>([]);
  const [projectHashtags, setProjectHashtags] = useState<string[]>([]);
  const [projectCaption, setProjectCaption] = useState("");
  const [seriesInfo, setSeriesInfo] = useState<{ name: string; episode: number } | null>(null);
  const [hookLoading, setHookLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch status ──
  const fetchStatus = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/pipeline/status?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
      if (data.log) setLogTail(data.log);
    } catch {
      // Silent — will retry on next poll
    }
  }, [projectId]);

  // ── Fetch scenes ──
  const fetchScenes = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/scenes?projectId=${encodeURIComponent(projectId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.scenes)) {
        setScenes(data.scenes);
      }
      if (data.lang) setLang(data.lang);
      if (data.qcScores) setQcScores(data.qcScores);
      if (data.hookText) setHookText(data.hookText);
      if (data.hookAlternatives) setHookAlternatives(data.hookAlternatives);
      if (data.hashtags?.length) setProjectHashtags(data.hashtags);
      if (data.caption) setProjectCaption(data.caption);
      if (data.series) setSeriesInfo(data.series);
    } catch {
      // Silent
    }
  }, [projectId]);

  // ── Fetch files ──
  const fetchFiles = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`);
      if (!res.ok) return;
      const data = await res.json();
      setFiles({
        scenes_images: data.scenes_images ?? [],
        audio: data.audio ?? [],
      });
    } catch {
      // Silent
    }
  }, [projectId]);

  // ── Initial load ──
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchStatus(), fetchScenes(), fetchFiles()]).finally(() =>
      setLoading(false)
    );
  }, [projectId, fetchStatus, fetchScenes, fetchFiles]);

  // ── Polling ──
  useEffect(() => {
    if (!projectId) return;

    const shouldPoll = status.isRunning || status.isPaused;

    if (shouldPoll && !pollRef.current) {
      pollRef.current = setInterval(() => {
        fetchStatus();
        fetchScenes();
        fetchFiles();
      }, POLL_INTERVAL_MS);
    }

    if (!shouldPoll && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      // Final fetch to get latest data after pipeline ends
      fetchScenes();
      fetchFiles();
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [projectId, status.isRunning, status.isPaused, fetchStatus, fetchScenes, fetchFiles]);

  // ── Pipeline Actions ──
  const startPipeline = useCallback(async () => {
    if (!projectId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Pipeline baslatilamadi");
        return;
      }
      toast.success("Pipeline baslatildi");
      await fetchStatus();
    } catch {
      toast.error("Pipeline baslatilamadi");
    } finally {
      setActionLoading(false);
    }
  }, [projectId, toast, fetchStatus]);

  const stopPipeline = useCallback(async () => {
    if (!projectId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        toast.error("Pipeline durdurulamadi");
        return;
      }
      toast.info("Pipeline durduruldu");
      await fetchStatus();
    } catch {
      toast.error("Pipeline durdurulamadi");
    } finally {
      setActionLoading(false);
    }
  }, [projectId, toast, fetchStatus]);

  const resumePipeline = useCallback(async () => {
    if (!projectId) return;
    setActionLoading(true);
    try {
      // Collect approval data from store
      const approval = approveAllImages(projectId);

      // Send approval if available
      if (approval) {
        const approveRes = await fetch("/api/pipeline/approve-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, approval }),
        });
        if (!approveRes.ok) {
          toast.error("Gorsel onayi gonderilemedi");
          setActionLoading(false);
          return;
        }
      }

      // Resume pipeline
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        toast.error("Pipeline devam ettirilemedi");
        return;
      }
      toast.success("Pipeline devam ediyor");
      await fetchStatus();
    } catch {
      toast.error("Pipeline devam ettirilemedi");
    } finally {
      setActionLoading(false);
    }
  }, [projectId, toast, fetchStatus, approveAllImages]);

  // ── Edit save handler ──
  const handleEditSave = useCallback(async (sceneNumber: number, newText: string) => {
    if (!projectId) return;
    try {
      const textField = lang === "tr" ? "text_tr" : "text_de";
      const res = await fetch("/api/pipeline/edit-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scenes: [{ scene: sceneNumber, [textField]: newText, text: newText }],
        }),
      });
      if (res.ok) {
        toast.success(`Sahne ${sceneNumber} guncellendi`);
        await fetchScenes();
      } else {
        toast.error("Duzenleme kaydedilemedi");
      }
    } catch {
      toast.error("Duzenleme kaydedilemedi");
    }
  }, [projectId, lang, toast, fetchScenes]);

  // ── Derived state ──
  const stepLabel = STEP_LABELS[status.step] ?? status.step;
  const badgeVariant = STEP_BADGE_VARIANT[status.step] ?? "info";
  const isReviewStep =
    status.step === "image_review" || status.step === "review_images";
  const showApproval = status.isPaused && isReviewStep;
  const isScriptEditable = status.isPaused && (status.step === "review_script" || status.step === "review_images" || status.step === "image_review");

  // ── No project ──
  if (!projectId) {
    return (
      <EmptyState
        title="Proje secilmedi"
        description="Lutfen dashboard'dan bir proje secin."
        action={{ label: "Dashboard'a Don", onClick: () => router.push("/") }}
      />
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <MoloLoading size={56} text="Yukleniyor..." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      {/* ── Header ── */}
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              color: "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              flex: 1,
            }}
          >
            {seriesInfo ? `${seriesInfo.name} — Bölüm ${seriesInfo.episode}` : (project?.name ?? projectId)}
          </h1>
          <Badge variant={badgeVariant} pulse={status.isRunning}>
            {stepLabel}
          </Badge>
        </div>

        {/* Progress */}
        <Progress
          value={status.progress}
          label={status.message || stepLabel}
          showMolo={status.isRunning}
          color={status.isError ? "coral" : status.isDone ? "blue" : "teal"}
        />

        {/* Status messages */}
        {status.isDone && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(16, 185, 129, 0.08)",
              color: "var(--accent-green)",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} />
            Pipeline basariyla tamamlandi.
          </div>
        )}
        {status.isError && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(239, 68, 68, 0.08)",
              color: "var(--accent-red, #ef4444)",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            {status.message || "Bir hata olustu."}
          </div>
        )}
        {status.isError && logTail && (
          <details style={{ marginTop: 8, fontSize: 12 }}>
            <summary style={{ cursor: "pointer", color: "var(--text-muted)" }}>Pipeline log goster</summary>
            <pre style={{
              marginTop: 8, padding: 12, background: "var(--bg-secondary)",
              borderRadius: "var(--radius-md)", fontSize: 11, lineHeight: 1.5,
              color: "var(--text-secondary)", maxHeight: 200, overflow: "auto",
              whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>
              {logTail.slice(-500)}
            </pre>
          </details>
        )}

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {!status.isRunning && !status.isPaused && !status.isDone && (
            <Button
              variant="primary"
              size="sm"
              icon={<Play size={14} />}
              loading={actionLoading}
              onClick={startPipeline}
            >
              Pipeline Baslat
            </Button>
          )}
          {status.isError && (
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} />}
              loading={actionLoading}
              onClick={startPipeline}
            >
              Tekrar Dene
            </Button>
          )}
          {status.isRunning && (
            <Button
              variant="danger"
              size="sm"
              icon={<Square size={14} />}
              loading={actionLoading}
              onClick={stopPipeline}
            >
              Durdur
            </Button>
          )}
          {status.isPaused && (
            <Button
              variant="primary"
              size="sm"
              icon={<SkipForward size={14} />}
              loading={actionLoading}
              onClick={resumePipeline}
            >
              {isReviewStep ? "Onayla ve Devam Et" : "Devam Et"}
            </Button>
          )}
        </div>
      </header>

      {/* ── Hook Panel ── */}
      {hookText && (
        <div style={{ marginBottom: 20 }}>
        <Card hover={false}>
          <div style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              Hook (Ilk 3 saniye)
            </h3>
            <div style={{
              padding: "12px 16px", background: "rgba(20,184,166,0.06)",
              borderRadius: "var(--radius-md)", border: "1px solid rgba(20,184,166,0.15)",
              fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 12,
            }}>
              &quot;{hookText}&quot;
            </div>
            {hookAlternatives.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Alternatifler:</div>
                {hookAlternatives.map((alt, i) => (
                  <div key={i}
                    onClick={() => setHookText(alt)}
                    style={{
                      padding: "8px 12px", marginBottom: 4, borderRadius: "var(--radius-sm)",
                      background: "var(--bg-secondary)", cursor: "pointer", fontSize: 13,
                      color: "var(--text-secondary)", transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; }}
                  >
                    {alt}
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={hookLoading}
              onClick={async () => {
                if (!projectId) return;
                setHookLoading(true);
                try {
                  const sceneTexts = scenes.map((s: Scene) => s.text_de || "");
                  const res = await fetch("/api/hook/optimize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId, currentHook: hookText, sceneTexts, lang }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    if (data.hooks?.length) {
                      setHookAlternatives(data.hooks.map((h: { text: string }) => h.text));
                      toast.success(`${data.hooks.length} yeni hook onerisi olusturuldu`);
                    }
                  }
                } catch { /* silent */ }
                finally { setHookLoading(false); }
              }}
            >
              <RefreshCw size={14} /> {hookLoading ? "Olusturuluyor..." : "Yeni Hook Onerisi"}
            </Button>
          </div>
        </Card>
        </div>
      )}

      {/* ── Scenes ── */}
      {scenes.length === 0 ? (
        <Card hover={false}>
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <ImageIcon
              size={32}
              color="var(--text-muted)"
              style={{ opacity: 0.3, marginBottom: 8 }}
            />
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
              {status.step === "idle"
                ? "Pipeline baslatildiginda sahneler burada gorunecek."
                : "Sahneler henuz uretilmedi."}
            </p>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {scenes.map((scene) => (
            <SceneRow
              key={scene.scene}
              scene={scene}
              imageUrl={findSceneImage(files.scenes_images, scene.scene)}
              audioUrl={findSceneAudio(files.audio, scene.scene)}
              showApproval={showApproval}
              projectId={projectId}
              lang={lang}
              qcScore={qcScores[`scene_${String(scene.scene).padStart(2, "0")}`]}
              isEditable={isScriptEditable}
              onEditSave={handleEditSave}
            />
          ))}
        </div>
      )}

      {/* ── Hashtag & Caption Panel ── */}
      {(projectHashtags.length > 0 || projectCaption) && (
        <div style={{ marginTop: 20 }}>
        <Card hover={false}>
          <div style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
              Hashtag &amp; Caption
            </h3>
            {projectHashtags.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {projectHashtags.map((tag, i) => (
                    <Badge key={i} variant="draft">{tag}</Badge>
                  ))}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(projectHashtags.join(" "));
                    toast.success("Hashtag'ler kopyalandi");
                  }}
                  style={{
                    marginTop: 8, fontSize: 11, color: "var(--accent-teal)",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  Kopyala
                </button>
              </div>
            )}
            {projectCaption && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Caption:</div>
                <div style={{
                  padding: "10px 14px", background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-md)", fontSize: 14, color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}>
                  {projectCaption}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(projectCaption + "\n\n" + projectHashtags.join(" "));
                    toast.success("Caption + hashtag kopyalandi");
                  }}
                  style={{
                    marginTop: 6, fontSize: 11, color: "var(--accent-teal)",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  Caption + Hashtag Kopyala
                </button>
              </div>
            )}
          </div>
        </Card>
        </div>
      )}
    </div>
  );
}

// ─── Page (Suspense boundary for useSearchParams) ───────────────────────────

export default function ScenesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <MoloLoading size={56} text="Yukleniyor..." />
        </div>
      }
    >
      <ScenesContent />
    </Suspense>
  );
}
