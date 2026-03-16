"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Volume2,
  FileVideo,
  FolderOpen,
  Pause,
  ZoomIn,
  Download,
} from "lucide-react";
import type { Project, Scene } from "@/store/studio";
import { useToast } from "@/components/toast";

// Pipeline step labels
const STEP_LABELS: Record<string, string> = {
  idle: "Hazır",
  starting: "Başlatılıyor...",
  script: "📝 Senaryo üretiliyor...",
  voice: "🎤 Sesler üretiliyor...",
  approval: "✅ Onaylandı",
  images: "📸 Görseller üretiliyor...",
  videos: "🎬 Videolar üretiliyor (Kling v3)...",
  edit: "✂️ Kurgu yapılıyor...",
  subtitles: "💬 Altyazı ekleniyor...",
  slowdown: "🐢 Final slowdown...",
  thumbnail: "🖼️ Thumbnail üretiliyor...",
  done: "🎉 Tamamlandı!",
  error: "❌ Hata oluştu",
};

interface PipelineStatus {
  status: string;
  step: string;
  progress: number;
  log: string;
  lastLine: string;
  isRunning: boolean;
  isError: boolean;
  isDone: boolean;
}

interface ProjectFiles {
  scenes_images: string[];
  scenes_videos: string[];
  audio: string[];
  draft: string[];
  final: string[];
  subtitles: string[];
}

// Media status indicator for each scene
function MediaIndicator({ has, icon: Icon, label }: { has: boolean; icon: typeof Film; label: string }) {
  return (
    <span
      title={label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 10, padding: "2px 6px", borderRadius: 8,
        background: has ? "rgba(16,185,129,0.1)" : "rgba(100,116,139,0.08)",
        color: has ? "var(--accent-green)" : "var(--text-muted)",
        fontWeight: has ? 600 : 400,
      }}
    >
      <Icon size={10} /> {label}
    </span>
  );
}

function SceneCard({
  scene,
  duration,
  isActive,
  onClick,
  hasImage,
  hasAudio,
  hasVideo,
}: {
  scene: Scene;
  duration?: number;
  isActive: boolean;
  onClick: () => void;
  hasImage: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
}) {
  return (
    <div
      className={`timeline-item ${isActive ? "active" : ""}`}
      onClick={onClick}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>S{scene.scene}</span>
        {duration !== undefined && duration > 0 && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
            <Clock size={10} />
            {duration.toFixed(1)}s
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
        {scene.text_de || (scene as unknown as Record<string, string>).text || ""}
      </div>
      {scene.text_tr && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.3, marginTop: 4, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const }}>
          🇹🇷 {scene.text_tr}
        </div>
      )}
      {/* Media indicators */}
      <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
        <MediaIndicator has={hasImage} icon={ImageIcon} label="Görsel" />
        <MediaIndicator has={hasAudio} icon={Volume2} label="Ses" />
        <MediaIndicator has={hasVideo} icon={FileVideo} label="Video" />
        <span className="badge draft" style={{ fontSize: 9 }}>{scene.voice_direction}</span>
      </div>
    </div>
  );
}

function PipelineProgress({ status }: { status: PipelineStatus }) {
  const [showLog, setShowLog] = useState(false);

  return (
    <div className="glass-card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {status.isRunning && <Loader2 size={16} className="pulse" style={{ color: "var(--accent-blue)" }} />}
          {status.isDone && <CheckCircle2 size={16} style={{ color: "var(--accent-green)" }} />}
          {status.isError && <XCircle size={16} style={{ color: "var(--accent-red)" }} />}
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {STEP_LABELS[status.step] || status.step}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-geist-mono)" }}>
          {status.progress}%
        </span>
      </div>

      <div className="progress-bar" style={{ marginBottom: 8 }}>
        <div
          className="progress-fill"
          style={{
            width: `${status.progress}%`,
            background: status.isError ? "var(--accent-red)" : undefined,
          }}
        />
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {["script", "voice", "images", "videos", "edit", "subtitles", "done"].map((step) => {
          const steps = ["script", "voice", "images", "videos", "edit", "subtitles", "done"];
          const currentIdx = steps.indexOf(status.step);
          const stepIdx = steps.indexOf(step);
          const isPast = stepIdx < currentIdx;
          const isCurrent = step === status.step;

          return (
            <span
              key={step}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 12,
                background: isPast ? "rgba(16,185,129,0.15)" : isCurrent ? "rgba(59,130,246,0.15)" : "var(--bg-primary)",
                color: isPast ? "var(--accent-green)" : isCurrent ? "var(--accent-blue)" : "var(--text-muted)",
                fontWeight: isCurrent ? 600 : 400,
              }}
            >
              {isPast ? "✓ " : ""}{step}
            </span>
          );
        })}
      </div>

      {/* Last line */}
      <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {status.lastLine}
      </div>

      {/* Toggle log */}
      <button
        onClick={() => setShowLog(!showLog)}
        className="btn btn-ghost"
        style={{ fontSize: 11, marginTop: 8, padding: "4px 8px" }}
      >
        {showLog ? "Log gizle" : "Log göster"}
      </button>
      {showLog && (
        <pre style={{
          marginTop: 8, padding: 12, background: "var(--bg-primary)", borderRadius: 8,
          fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5,
          maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
          border: "1px solid var(--border-subtle)",
        }}>
          {status.log || "Log henüz boş..."}
        </pre>
      )}
    </div>
  );
}

function ScenesContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [files, setFiles] = useState<ProjectFiles>({ scenes_images: [], scenes_videos: [], audio: [], draft: [], final: [], subtitles: [] });
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToast();
  const notifiedRef = useRef(false);

  // Fetch project data
  const fetchProject = useCallback(() => {
    if (!projectId) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        const p = data.find((x) => x.id === projectId);
        if (p) setProject(p);
        setLoading(false);
      });
  }, [projectId]);

  // Fetch project files
  const fetchFiles = useCallback(() => {
    if (!projectId) return;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
      .then((r) => r.json())
      .then((data: ProjectFiles) => setFiles(data))
      .catch(() => {});
  }, [projectId]);

  // Fetch pipeline status
  const fetchStatus = useCallback(() => {
    if (!projectId) return;
    fetch(`/api/pipeline/status?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((data: PipelineStatus) => {
        setPipelineStatus(data);
        if (data.isDone || data.isError) {
          fetchProject();
          fetchFiles();
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            if (data.isDone) toast.success("Pipeline tamamlandı! 🎉");
            if (data.isError) toast.error("Pipeline hatası — log'u kontrol edin");
          }
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      })
      .catch(console.error);
  }, [projectId, fetchProject, fetchFiles, toast]);

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
    }, 3000);
  }, [fetchStatus, fetchFiles]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!project) return;
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
        toast.info("Pipeline başlatıldı — ilerleme takip ediliyor...");
        setPipelineStatus({
          status: "running", step: "starting", progress: 5,
          log: "", lastLine: "Pipeline başlatıldı...",
          isRunning: true, isError: false, isDone: false,
        });
        startPolling();
      }
    } catch (e) {
      console.error(e);
      toast.error("Pipeline başlatılamadı");
    }
  };

  // Audio playback
  const toggleAudio = (audioPath: string) => {
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
  };

  // Get scene-specific files
  const getSceneImage = (sceneNum: number) => files.scenes_images.find(f => f.includes(`scene_${sceneNum}_`)) || files.scenes_images[sceneNum - 1];
  const getSceneVideo = (sceneNum: number) => files.scenes_videos.find(f => f.includes(`scene_${sceneNum}`)) || files.scenes_videos[sceneNum - 1];
  const getSceneAudio = (sceneNum: number) => files.audio.find(f => f.includes(`scene_${sceneNum}`)) || files.audio[sceneNum - 1];

  if (!projectId) {
    return (
      <div className="empty-state">
        <Film size={64} />
        <h3 style={{ marginBottom: 8, color: "var(--text-secondary)" }}>Proje seçilmedi</h3>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Dashboard&apos;dan bir proje seçin</p>
        <Link href="/" className="btn btn-primary">Dashboard&apos;a Dön</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="empty-state">
        <Loader2 size={32} className="pulse" />
        <p style={{ marginTop: 12 }}>Yükleniyor...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="empty-state">
        <Film size={64} />
        <h3 style={{ marginBottom: 8, color: "var(--text-secondary)" }}>Proje bulunamadı</h3>
        <Link href="/" className="btn btn-primary">Dashboard&apos;a Dön</Link>
      </div>
    );
  }

  const scene = project.scenes[activeScene];
  const isRunning = pipelineStatus?.isRunning || false;
  const sceneImage = scene ? getSceneImage(scene.scene) : undefined;
  const sceneVideo = scene ? getSceneVideo(scene.scene) : undefined;
  const sceneAudio = scene ? getSceneAudio(scene.scene) : undefined;

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="btn btn-ghost btn-icon">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="page-title">{project.title || project.name}</h1>
            <p className="page-subtitle">{project.scenes.length} sahne • {project.contentType} • {project.lang.toUpperCase()}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={handlePipeline} disabled={isRunning}>
            {isRunning ? <Loader2 size={16} className="pulse" /> : <Play size={16} />}
            {isRunning ? "Çalışıyor..." : "Pipeline Başlat"}
          </button>
        </div>
      </div>

      {/* Pipeline Progress */}
      {pipelineStatus && pipelineStatus.status !== "idle" && (
        <PipelineProgress status={pipelineStatus} />
      )}

      {project.scenes.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 60 }}>
          {isRunning ? (
            <>
              <Loader2 size={64} className="pulse" style={{ color: "var(--accent-blue)" }} />
              <h3 style={{ marginBottom: 8, color: "var(--text-secondary)", marginTop: 16 }}>
                Pipeline çalışıyor...
              </h3>
              <p>Senaryo üretiliyor, lütfen bekleyin</p>
            </>
          ) : (
            <>
              <Sparkles size={64} />
              <h3 style={{ marginBottom: 8, color: "var(--text-secondary)" }}>
                Henüz sahne yok
              </h3>
              <p style={{ marginBottom: 20 }}>
                Pipeline&apos;ı başlatarak senaryo üretin
              </p>
              <button className="btn btn-primary" onClick={handlePipeline}>
                <Sparkles size={18} />
                Senaryo Üret &amp; Pipeline Başlat
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="split-layout">
          {/* Sol: Timeline */}
          <div className="split-left">
            <div className="section-title" style={{ marginBottom: 12 }}>
              <Film size={18} /> Timeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {project.scenes.map((s, i) => (
                <SceneCard
                  key={s.scene}
                  scene={s}
                  duration={project.durations[i]}
                  isActive={i === activeScene}
                  onClick={() => setActiveScene(i)}
                  hasImage={!!getSceneImage(s.scene)}
                  hasAudio={!!getSceneAudio(s.scene)}
                  hasVideo={!!getSceneVideo(s.scene)}
                />
              ))}
            </div>
            <div className="divider" />

            {/* Proje Dosyaları Özeti */}
            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <FolderOpen size={13} /> Proje Dosyaları
              </div>
              <div>🖼️ {files.scenes_images.length} görsel</div>
              <div>🔊 {files.audio.length} ses</div>
              <div>🎬 {files.scenes_videos.length} video</div>
              <div>📋 {files.draft.length} draft</div>
              <div>🎯 {files.final.length} final</div>
              <div>💬 {files.subtitles.length} altyazı</div>
              <div style={{ marginTop: 4, fontWeight: 600 }}>
                Toplam: {project.durations.reduce((a, b) => a + b, 0).toFixed(1)}s
              </div>
            </div>
          </div>

          {/* Sağ: Sahne Detayı */}
          <div className="split-right">
            {scene && (
              <div className="glass-card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 600 }}>
                    Sahne {scene.scene} / {project.scenes.length}
                  </h2>
                  <span className="badge draft">{scene.voice_direction}</span>
                </div>

                {/* Görsel Önizleme */}
                {sceneImage && (
                  <div style={{ marginBottom: 20, borderRadius: 8, overflow: "hidden", position: "relative" }}>
                    <img
                      src={sceneImage}
                      alt={`Sahne ${scene.scene}`}
                      style={{
                        width: "100%", maxHeight: 300, objectFit: "contain",
                        background: "#000", display: "block", cursor: "zoom-in",
                      }}
                      onClick={() => setLightbox(sceneImage)}
                    />
                    <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-icon" onClick={() => setLightbox(sceneImage)} style={{ background: "rgba(0,0,0,0.5)", borderRadius: "50%", width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ZoomIn size={14} style={{ color: "#fff" }} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Video Önizleme */}
                {sceneVideo && (
                  <div style={{ marginBottom: 20 }}>
                    <label className="label"><FileVideo size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} /> Video</label>
                    <video
                      controls
                      style={{ width: "100%", maxHeight: 250, borderRadius: 8, background: "#000" }}
                      poster={sceneImage}
                    >
                      <source src={sceneVideo} type="video/mp4" />
                    </video>
                  </div>
                )}

                {/* Ses Oynatma */}
                {sceneAudio && (
                  <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                    <button className="btn btn-secondary btn-icon" onClick={() => toggleAudio(sceneAudio)} style={{ width: 36, height: 36, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {playingAudio ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <label className="label" style={{ marginBottom: 0 }}>🔊 Ses Dosyası</label>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {project.durations[activeScene] ? `${project.durations[activeScene].toFixed(1)}s` : ""}
                      </div>
                    </div>
                  </div>
                )}

                {/* Metin */}
                <div style={{ marginBottom: 20 }}>
                  <label className="label">
                    <Mic2 size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                    Metin (DE)
                  </label>
                  <div className="input textarea" style={{ whiteSpace: "pre-wrap", minHeight: 72, lineHeight: 1.6 }}>
                    {scene.text_de || (scene as unknown as Record<string, string>).text || "Metin bulunamadı"}
                  </div>
                </div>

                {/* Türkçe Çeviri */}
                <div style={{ marginBottom: 20 }}>
                  <label className="label">🇹🇷 Metin (TR)</label>
                  <div className="input textarea" style={{ whiteSpace: "pre-wrap", minHeight: 56, lineHeight: 1.6, color: scene.text_tr ? "var(--text-secondary)" : "var(--text-muted)", fontStyle: scene.text_tr ? "normal" : "italic" }}>
                    {scene.text_tr || "Çeviri bekleniyor..."}
                  </div>
                </div>

                {/* Sahne Detayları Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div>
                    <label className="label">📸 Ortam</label>
                    <div className="input" style={{ fontSize: 13 }}>{scene.environment}</div>
                  </div>
                  <div>
                    <label className="label">🤖 Poz</label>
                    <div className="input" style={{ fontSize: 13 }}>{scene.molo_pose}</div>
                  </div>
                  <div>
                    <label className="label">🎭 Ses Yönü</label>
                    <div className="input" style={{ fontSize: 13 }}>{scene.voice_direction}</div>
                  </div>
                  <div>
                    <label className="label">📐 Shot</label>
                    <div className="input" style={{ fontSize: 13 }}>{scene.shot_type}</div>
                  </div>
                </div>

                {/* Duygu Notu */}
                <div style={{ marginBottom: 20 }}>
                  <label className="label">💭 Duygu Notu</label>
                  <div className="input" style={{ fontSize: 13 }}>{scene.emotion_note}</div>
                </div>

                {/* Navigation */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/images?project=${projectId}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
                    <ImageIcon size={14} /> Görseller
                    <ChevronRight size={14} />
                  </Link>
                  <Link href={`/voice?project=${projectId}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
                    <Mic2 size={14} /> Sesler
                    <ChevronRight size={14} />
                  </Link>
                  <Link href={`/video?project=${projectId}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
                    <Film size={14} /> Videolar
                    <ChevronRight size={14} />
                  </Link>
                  <Link href={`/edit?project=${projectId}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
                    <Download size={14} /> Kurgu
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out",
          }}
        >
          <img
            src={lightbox}
            alt="Büyütülmüş görsel"
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
          />
        </div>
      )}
    </>
  );
}

export default function ScenesPage() {
  return (
    <Suspense fallback={<div className="empty-state"><Loader2 size={32} className="pulse" /></div>}>
      <ScenesContent />
    </Suspense>
  );
}
