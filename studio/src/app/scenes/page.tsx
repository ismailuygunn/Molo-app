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
}

function SceneRow({ scene, imageUrl, audioUrl, showApproval, projectId }: SceneRowProps) {
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
          </div>

          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              margin: "0 0 10px",
            }}
          >
            {scene.text_de}
          </p>

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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch status ──
  const fetchStatus = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/pipeline/status?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
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

  // ── Derived state ──
  const stepLabel = STEP_LABELS[status.step] ?? status.step;
  const badgeVariant = STEP_BADGE_VARIANT[status.step] ?? "info";
  const isReviewStep =
    status.step === "image_review" || status.step === "review_images";
  const showApproval = status.isPaused && isReviewStep;

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
            {project?.name ?? projectId}
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
            />
          ))}
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
