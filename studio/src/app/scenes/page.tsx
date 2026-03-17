"use client";

import { useEffect, useState, useRef, useCallback, Suspense, useMemo } from "react";
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
  RefreshCw,
  SkipForward,
} from "lucide-react";
import type { Project, Scene } from "@/store/studio";
import { useToast } from "@/components/toast";

// Pipeline step labels & details
const STEP_LABELS: Record<string, string> = {
  idle: "Hazır",
  starting: "Başlatılıyor...",
  script: "📝 Senaryo üretiliyor...",
  voice: "🎤 Sesler üretiliyor...",
  approval: "✅ Onaylandı",
  images: "📸 Görseller üretiliyor...",
  review_images: "⏸️ Görseller inceleniyor",
  videos: "🎬 Videolar üretiliyor (Kling)...",
  edit: "✂️ Kurgu yapılıyor...",
  subtitles: "💬 Altyazı ekleniyor...",
  slowdown: "🐢 Final slowdown...",
  thumbnail: "🖼️ Thumbnail üretiliyor...",
  done: "🎉 Tamamlandı!",
  error: "❌ Hata oluştu",
};

const STEP_DETAILS: Record<string, { desc: string; eta: string }> = {
  starting: { desc: "Pipeline başlatılıyor, brief okunuyor...", eta: "~5sn" },
  script: { desc: "Gemini ile sahne senaryosu oluşturuluyor", eta: "~30sn" },
  voice: { desc: "ElevenLabs ile ses dosyaları üretiliyor", eta: "~1dk" },
  approval: { desc: "Sahne yapısı otomatik onaylanıyor", eta: "~5sn" },
  images: { desc: "Nano Banana 2 ile referans görselleri üretiliyor", eta: "~2dk" },
  review_images: { desc: "Görselleri inceleyin — kötü olanları yeniden üretin, sonra devam edin", eta: "" },
  videos: { desc: "Kling API ile sahne videoları oluşturuluyor", eta: "~5-10dk" },
  edit: { desc: "FFmpeg ile sahneler birleştiriliyor, crossfade uygulanıyor", eta: "~1dk" },
  subtitles: { desc: "Gemini çeviri + FFmpeg ile altyazı ekleniyor", eta: "~1dk" },
  slowdown: { desc: "Final video slowdown uygulanıyor", eta: "~30sn" },
  thumbnail: { desc: "Thumbnail görseli üretiliyor", eta: "~30sn" },
  done: { desc: "Tüm adımlar tamamlandı!", eta: "" },
  error: { desc: "Pipeline bir hatayla karşılaştı", eta: "" },
};

const PIPELINE_STEPS = ["script", "voice", "images", "videos", "edit", "subtitles", "done"];

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
}

interface PipelineStatus {
  status: string;
  step: string;
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

function PipelineProgress({ status, elapsed, compact }: { status: PipelineStatus; elapsed: number; compact?: boolean }) {
  const [showLog, setShowLog] = useState(!compact);
  const logRef = useRef<HTMLPreElement>(null);
  const stepDetail = STEP_DETAILS[status.step];

  // Auto-scroll log to bottom
  useEffect(() => {
    if (showLog && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [showLog, status.log]);

  return (
    <div className="glass-card" style={{ padding: compact ? 20 : 16, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {status.isPaused && <Pause size={18} style={{ color: "#f59e0b" }} />}
          {status.isRunning && !status.isPaused && <Loader2 size={18} className="pulse" style={{ color: "var(--accent-blue)" }} />}
          {status.isDone && <CheckCircle2 size={18} style={{ color: "var(--accent-green)" }} />}
          {status.isError && <XCircle size={18} style={{ color: "var(--accent-red)" }} />}
          <span style={{ fontWeight: 700, fontSize: compact ? 18 : 14 }}>
            {STEP_LABELS[status.step] || status.step}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {elapsed > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} /> {formatElapsed(elapsed)}
            </span>
          )}
          <span style={{ fontSize: 13, color: status.isError ? "var(--accent-red)" : "var(--accent-blue)", fontWeight: 700, fontFamily: "var(--font-geist-mono)" }}>
            {status.progress}%
          </span>
        </div>
      </div>

      {/* Step description */}
      {stepDetail && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
          <span>{stepDetail.desc}</span>
          {stepDetail.eta && status.isRunning && (
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Tahmini: {stepDetail.eta}</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="progress-bar" style={{ marginBottom: 12, height: compact ? 8 : 6 }}>
        <div
          className="progress-fill"
          style={{
            width: `${status.progress}%`,
            background: status.isError ? "var(--accent-red)" : status.isDone ? "var(--accent-green)" : undefined,
            transition: "width 0.5s ease",
          }}
        />
      </div>

      {/* Step indicators — pipeline stepper */}
      <div style={{ display: "flex", gap: 2, marginBottom: 12, flexWrap: "wrap" }}>
        {PIPELINE_STEPS.map((step) => {
          const currentIdx = PIPELINE_STEPS.indexOf(status.step);
          const stepIdx = PIPELINE_STEPS.indexOf(step);
          const isPast = stepIdx < currentIdx;
          const isCurrent = step === status.step;

          return (
            <div
              key={step}
              style={{
                flex: 1,
                minWidth: 60,
                textAlign: "center",
                padding: "6px 4px",
                borderRadius: 8,
                background: isPast ? "rgba(16,185,129,0.12)" : isCurrent ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                border: isCurrent ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                transition: "all 0.3s ease",
              }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: isCurrent ? 700 : isPast ? 500 : 400,
                color: isPast ? "var(--accent-green)" : isCurrent ? "var(--accent-blue)" : "var(--text-muted)",
              }}>
                {isPast ? "✓" : isCurrent && status.isRunning ? "●" : "○"}
              </div>
              <div style={{
                fontSize: 9,
                marginTop: 2,
                color: isPast ? "var(--accent-green)" : isCurrent ? "var(--accent-blue)" : "var(--text-muted)",
                fontWeight: isCurrent ? 600 : 400,
              }}>
                {step}
              </div>
            </div>
          );
        })}
      </div>

      {/* Last activity line */}
      <div style={{
        fontSize: 12, color: "var(--text-secondary)", padding: "8px 12px",
        background: "var(--bg-primary)", borderRadius: 8, marginBottom: 8,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        border: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-geist-mono)",
      }}>
        {status.lastLine || "Bekleniyor..."}
      </div>

      {/* Toggle log */}
      <button
        onClick={() => setShowLog(!showLog)}
        className="btn btn-ghost"
        style={{ fontSize: 11, padding: "4px 10px" }}
      >
        {showLog ? "▲ Log gizle" : "▼ Detaylı log göster"}
      </button>
      {showLog && (
        <pre ref={logRef} style={{
          marginTop: 8, padding: 12, background: "#0a0a0f", borderRadius: 8,
          fontSize: 11, color: "#a0aec0", lineHeight: 1.6,
          maxHeight: compact ? 400 : 300, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
          border: "1px solid rgba(255,255,255,0.05)",
          fontFamily: "var(--font-geist-mono)",
        }}>
          {status.log || "Log henüz boş..."}
        </pre>
      )}
    </div>
  );
}

function ScenesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [files, setFiles] = useState<ProjectFiles>({ scenes_images: [], scenes_videos: [], audio: [], draft: [], final: [], subtitles: [] });
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pipelineStartTime, setPipelineStartTime] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToast();
  const notifiedRef = useRef(false);
  const redirectedRef = useRef(false);

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

        // Start timer if running and not started yet
        if (data.isRunning && !elapsedRef.current) {
          setPipelineStartTime(Date.now());
          elapsedRef.current = setInterval(() => {
            setPipelineStartTime(prev => {
              if (!prev) return prev;
              setElapsed(Math.floor((Date.now() - prev) / 1000));
              return prev;
            });
          }, 1000);
        }

        if (data.isDone || data.isError) {
          fetchProject();
          fetchFiles();
          // Stop elapsed timer
          if (elapsedRef.current) {
            clearInterval(elapsedRef.current);
            elapsedRef.current = null;
          }
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            if (data.isDone) {
              toast.success("Pipeline tamamlandı! 🎉 Kurgu sayfasına yönlendiriliyorsunuz...");
              // Auto-redirect to edit page after 2 seconds
              if (!redirectedRef.current) {
                redirectedRef.current = true;
                setTimeout(() => {
                  router.push(`/edit?project=${projectId}`);
                }, 2500);
              }
            }
            if (data.isError) toast.error("Pipeline hatası — log'u kontrol edin");
          }
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      })
      .catch(console.error);
  }, [projectId, fetchProject, fetchFiles, toast, router]);

  useEffect(() => {
    fetchProject();
    fetchFiles();
    fetchStatus();
  }, [fetchProject, fetchFiles, fetchStatus]);

  // Auto-start polling when pipeline is running or paused on page load
  useEffect(() => {
    if ((pipelineStatus?.isRunning || pipelineStatus?.isPaused) && !pollingRef.current) {
      startPolling();
    }
  }, [pipelineStatus?.isRunning, pipelineStatus?.isPaused]);

  // Resume handler
  const handleResume = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        toast.success("Pipeline devam ediyor — video üretimi başlıyor...");
        fetchStatus();
      } else {
        const d = await res.json();
        toast.error(d.error || "Resume başarısız");
      }
    } catch {
      toast.error("Resume hatası");
    }
  }, [projectId, fetchStatus, toast]);

  // Regenerate handler
  const handleRegenerate = useCallback(async (sceneIdx: number) => {
    if (!projectId) return;
    setRegenerating(sceneIdx);
    try {
      const res = await fetch("/api/pipeline/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sceneIndex: sceneIdx }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(`Sahne ${sceneIdx + 1} yeniden üretildi ✅`);
        fetchFiles();
      } else {
        toast.error(d.error || "Yeniden üretim başarısız");
      }
    } catch {
      toast.error("Yeniden üretim hatası");
    } finally {
      setRegenerating(null);
    }
  }, [projectId, fetchFiles, toast]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      fetchStatus();
      fetchFiles();
      fetchProject();
    }, 3000);
  }, [fetchStatus, fetchFiles, fetchProject]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
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

  // Get scene-specific files (zero-padded to match pipeline naming: scene_01, scene_02, etc.)
  const pad = (n: number) => String(n).padStart(2, '0');
  const getSceneImage = (sceneNum: number) => files.scenes_images.find(f => f.includes(`scene_${pad(sceneNum)}`));
  const getSceneVideo = (sceneNum: number) => files.scenes_videos.find(f => f.includes(`scene_${pad(sceneNum)}`));
  const getSceneAudio = (sceneNum: number) => files.audio.find(f => f.includes(`scene_${pad(sceneNum)}`));

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
  const isPaused = pipelineStatus?.isPaused || false;
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
          {isPaused && (
            <button className="btn btn-primary" onClick={handleResume} style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
              <SkipForward size={16} /> Video Üretimine Geç
            </button>
          )}
          <button className="btn btn-primary" onClick={handlePipeline} disabled={isRunning || isPaused}>
            {isRunning ? <Loader2 size={16} className="pulse" /> : <Play size={16} />}
            {isRunning ? "Çalışıyor..." : isPaused ? "Duraklatıldı" : "Pipeline Başlat"}
          </button>
        </div>
      </div>

      {/* Pipeline Progress — always visible when running/done/error */}
      {pipelineStatus && pipelineStatus.status !== "idle" && (
        <PipelineProgress 
          status={pipelineStatus} 
          elapsed={elapsed}
          compact={project.scenes.length === 0}
        />
      )}

      {/* Paused state — image review banner */}
      {isPaused && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 20, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Pause size={24} style={{ color: "#f59e0b" }} />
            <div>
              <h3 style={{ color: "#f59e0b", margin: 0, fontSize: 16 }}>Görseller İnceleniyor</h3>
              <p style={{ color: "var(--text-secondary)", margin: "4px 0 0", fontSize: 13 }}>
                Görselleri inceleyin. Kötü olanların üzerindeki 🔄 butonuyla yeniden üretin.
                Hazır olduğunuzda aşağıdaki butonla video üretimine geçin.
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleResume} style={{ width: "100%", background: "linear-gradient(135deg, #10b981, #059669)", padding: "12px 0", fontSize: 15, fontWeight: 700 }}>
            <SkipForward size={18} /> ✅ Devam Et — Video Üretimine Geç
          </button>
        </div>
      )}

      {/* Done state — redirect notice */}
      {pipelineStatus?.isDone && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 20, textAlign: "center", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <CheckCircle2 size={32} style={{ color: "var(--accent-green)", marginBottom: 8 }} />
          <h3 style={{ color: "var(--accent-green)", marginBottom: 8 }}>Pipeline Tamamlandı!</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>Kurgu sayfasına yönlendiriliyorsunuz...</p>
          <button className="btn btn-primary" onClick={() => router.push(`/edit?project=${projectId}`)}>
            <Film size={16} /> Kurgu Sayfasına Git
          </button>
        </div>
      )}

      {project.scenes.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          {isRunning ? (
            <>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Sahne verileri oluşturuluyor, sayfa otomatik güncellenecek...
              </p>
            </>
          ) : pipelineStatus?.isDone ? null : (
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
                      {isPaused && (
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleRegenerate(activeScene)}
                          disabled={regenerating !== null}
                          title="Bu görseli yeniden üret"
                          style={{ background: "rgba(245,158,11,0.85)", borderRadius: "50%", width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          {regenerating === activeScene ? <Loader2 size={14} className="pulse" style={{ color: "#fff" }} /> : <RefreshCw size={14} style={{ color: "#fff" }} />}
                        </button>
                      )}
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
