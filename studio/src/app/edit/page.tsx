"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Download, Play, Loader2, Film, Clock, Settings,
  Type, FolderOpen, Volume2, VolumeX, Eye, Pause, CheckCircle2, X,
  Save, Edit3, AlertTriangle, Info
} from "lucide-react";
import type { Project } from "@/store/studio";
import { useToast } from "@/components/toast";

/* ────────────── Types ────────────── */
interface SceneFiles {
  scenes_images: string[];
  scenes_videos: string[];
  audio: string[];
  draft: FileInfo[];
  final: FileInfo[];
  subtitles: FileInfo[];
}

interface FileInfo {
  url: string;
  size: number;
  name: string;
}

interface SubtitleEntry {
  index: number;
  start: string;
  end: string;
  text: string;
}

/* ────────────── Scene Preview Modal ────────────── */
function SceneModal({ src, type, onClose }: { src: string; type: "video" | "audio"; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "85vh" }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -40, right: 0,
            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
            color: "#fff", padding: "6px 10px", cursor: "pointer", fontSize: 14,
          }}
        >
          <X size={18} />
        </button>
        {type === "video" ? (
          <video autoPlay controls style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: 12 }}>
            <source src={src} type="video/mp4" />
          </video>
        ) : (
          <div style={{
            background: "var(--bg-card)", borderRadius: 16, padding: 32,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          }}>
            <Volume2 size={48} style={{ color: "var(--accent-cyan)", opacity: 0.5 }} />
            <audio autoPlay controls style={{ width: 400 }}>
              <source src={src} type="audio/mpeg" />
            </audio>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────── Scene Card ────────────── */
function SceneCard({
  index, scene, project, sceneFiles, onPreview,
}: {
  index: number;
  scene: { scene: number; text_de: string };
  project: Project;
  sceneFiles: SceneFiles;
  onPreview: (src: string, type: "video" | "audio") => void;
}) {
  const dur = project.durations[index] || 0;
  const imgSrc = sceneFiles.scenes_images[index];
  const vidSrc = sceneFiles.scenes_videos[index];
  const audSrc = sceneFiles.audio[index];

  return (
    <div style={{
      minWidth: 140, maxWidth: 180, flex: "1 0 140px",
      background: "var(--bg-card)", borderRadius: 12,
      border: "1px solid var(--border-subtle)",
      overflow: "hidden", transition: "all 0.2s",
    }}>
      {/* Thumbnail */}
      <div style={{ position: "relative", aspectRatio: "16/9", background: "#111", overflow: "hidden" }}>
        {imgSrc ? (
          <img src={imgSrc} alt={`S${scene.scene}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#333" }}>
            <Film size={24} />
          </div>
        )}
        {/* Scene number overlay */}
        <div style={{
          position: "absolute", top: 6, left: 6,
          background: "rgba(0,0,0,0.7)", borderRadius: 6,
          padding: "2px 7px", fontSize: 10, fontWeight: 700,
          color: "var(--accent-cyan)", backdropFilter: "blur(4px)",
        }}>
          S{scene.scene}
        </div>
        {/* Duration badge */}
        <div style={{
          position: "absolute", bottom: 6, right: 6,
          background: "rgba(0,0,0,0.7)", borderRadius: 6,
          padding: "2px 6px", fontSize: 10, fontWeight: 600,
          color: "#fff", fontFamily: "var(--font-geist-mono)",
        }}>
          {dur.toFixed(1)}s
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: "8px 10px", display: "flex", gap: 4 }}>
        {vidSrc && (
          <button
            onClick={() => onPreview(vidSrc, "video")}
            title="Video önizle"
            style={{
              flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
              color: "var(--accent-blue)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 3, transition: "all 0.15s",
            }}
          >
            <Eye size={12} /> Video
          </button>
        )}
        {audSrc && (
          <button
            onClick={() => onPreview(audSrc, "audio")}
            title="Ses dinle"
            style={{
              flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)",
              color: "var(--accent-purple)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 3, transition: "all 0.15s",
            }}
          >
            <Volume2 size={12} /> Ses
          </button>
        )}
      </div>

      {/* Scene text preview */}
      <div style={{
        padding: "0 10px 8px", fontSize: 10, color: "var(--text-muted)",
        lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
      }}>
        {scene.text_de}
      </div>
    </div>
  );
}

/* ────────────── Main Edit Content ────────────── */
function EditContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [sceneFiles, setSceneFiles] = useState<SceneFiles>({
    scenes_images: [], scenes_videos: [], audio: [], draft: [], final: [], subtitles: [],
  });
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "subtitle" | "files">("settings");
  const [previewModal, setPreviewModal] = useState<{ src: string; type: "video" | "audio" } | null>(null);
  const [subtitleEntries, setSubtitleEntries] = useState<SubtitleEntry[]>([]);
  const [subtitlesDirty, setSubtitlesDirty] = useState(false);
  const [savingSubs, setSavingSubs] = useState(false);
  const [selectedSubIdx, setSelectedSubIdx] = useState(0);
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [lastRenderConfig, setLastRenderConfig] = useState<Record<string, unknown> | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const toast = useToast();

  // localStorage persistence
  const storageKey = `molo_edit_${projectId}`;
  const saved = typeof window !== "undefined" ? JSON.parse(localStorage.getItem(storageKey) || "{}") : {};
  const [crossfade, setCrossfade] = useState(saved.crossfade ?? 0.7);
  const [slowdown, setSlowdown] = useState(saved.slowdown ?? 88);
  const [crf, setCrf] = useState(saved.crf ?? 16);
  const [transition, setTransition] = useState(saved.transition ?? "fade");
  const [addSubs, setAddSubs] = useState(saved.addSubs !== false);
  const [fontSize, setFontSize] = useState(saved.fontSize ?? 42);
  const [marginV, setMarginV] = useState(saved.marginV ?? 200);

  useEffect(() => {
    if (projectId) {
      const currentConfig = { crossfade, slowdown, crf, transition, addSubs, fontSize, marginV };
      localStorage.setItem(storageKey, JSON.stringify(currentConfig));
      // Check if settings changed since last render
      if (lastRenderConfig) {
        const changed = Object.keys(currentConfig).some(
          (k) => (currentConfig as Record<string, unknown>)[k] !== (lastRenderConfig as Record<string, unknown>)[k]
        );
        setSettingsChanged(changed);
      }
    }
  }, [crossfade, slowdown, crf, transition, addSubs, fontSize, marginV, projectId, storageKey, lastRenderConfig]);

  // Fetch project + files
  useEffect(() => {
    if (!projectId) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        const p = data.find((x) => x.id === projectId);
        if (p) setProject(p);
        setLoading(false);
      });
    fetchFiles();
  }, [projectId]);

  // Fetch subtitles for preview
  useEffect(() => {
    if (sceneFiles.subtitles.length === 0) return;
    const assFile = sceneFiles.subtitles.find(f => f.name.endsWith('.ass')) || sceneFiles.subtitles.find(f => f.name.endsWith('.srt'));
    if (!assFile) return;
    fetch(assFile.url)
      .then(r => r.text())
      .then(content => {
        if (assFile.name.endsWith('.ass')) {
          // Parse ASS Dialogue lines
          const entries: SubtitleEntry[] = [];
          const lines = content.split('\n');
          let idx = 1;
          for (const line of lines) {
            if (line.startsWith('Dialogue:')) {
              const parts = line.substring(10).split(',');
              if (parts.length >= 10) {
                const start = parts[1].trim();
                const end = parts[2].trim();
                const text = parts.slice(9).join(',').replace(/\\N/g, ' ').replace(/\{[^}]*\}/g, '').trim();
                if (text) entries.push({ index: idx++, start, end, text });
              }
            }
          }
          setSubtitleEntries(entries);
        } else {
          // Parse SRT
          const blocks = content.trim().split('\n\n');
          const entries: SubtitleEntry[] = [];
          for (const block of blocks) {
            const lines = block.split('\n');
            if (lines.length >= 3) {
              const [start, end] = lines[1].split(' --> ');
              const text = lines.slice(2).join(' ').trim();
              entries.push({ index: parseInt(lines[0]), start: start.trim(), end: end.trim(), text });
            }
          }
          setSubtitleEntries(entries);
        }
      })
      .catch(() => {});
  }, [sceneFiles.subtitles]);

  const fetchFiles = () => {
    if (!projectId) return;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
      .then((r) => r.json())
      .then((data) => {
        // scenes_images, scenes_videos, audio remain string[]
        // draft, final, subtitles are now FileInfo[]
        const toFileInfo = (arr: unknown[]): FileInfo[] =>
          arr.map((item: unknown) =>
            typeof item === 'string'
              ? { url: item, size: 0, name: item.split('/').pop() || '' }
              : item as FileInfo
          );
        setSceneFiles({
          scenes_images: data.scenes_images || [],
          scenes_videos: data.scenes_videos || [],
          audio: data.audio || [],
          draft: toFileInfo(data.draft || []),
          final: toFileInfo(data.final || []),
          subtitles: toFileInfo(data.subtitles || []),
        });
      });
  };

  const handleRender = async (type: "draft" | "final") => {
    if (!projectId) return;
    setRendering(true);
    setRenderProgress("Render başlatılıyor...");
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, type, crossfade, slowdown: slowdown / 100, crf, transition,
          addSubtitles: addSubs, fontSize, marginV,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`Render hatası: ${data.error}`);
        setRendering(false);
        setRenderProgress("");
        return;
      }

      toast.info("Render başlatıldı, işleniyor...");
      setLastRenderConfig({ crossfade, slowdown, crf, transition, addSubs, fontSize, marginV });
      setSettingsChanged(false);

      // Poll render status via log-based API
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/render/status?project=${encodeURIComponent(projectId)}`);
          const status = await statusRes.json();

          if (status.lastLine) {
            setRenderProgress(status.lastLine);
          }

          if (status.completed) {
            clearInterval(pollInterval);
            setRendering(false);
            setRenderProgress("");
            fetchFiles();
            setRenderKey(k => k + 1);
            toast.success(`${type === "final" ? "Final" : "Draft"} render tamamlandı!`);
          } else if (status.error) {
            clearInterval(pollInterval);
            setRendering(false);
            setRenderProgress("");
            toast.error("Render başarısız — logları kontrol edin");
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        setRendering(false);
        setRenderProgress("");
        fetchFiles();
        toast.warning("Render uzun sürüyor — dosyaları kontrol edin");
      }, 300000);
    } catch (e) {
      console.error(e);
      toast.error("Render başlatılamadı");
      setRendering(false);
      setRenderProgress("");
    }
  };

  // ────── Empty states ──────
  if (!projectId) {
    return (
      <div className="empty-state">
        <Film size={64} />
        <h3 style={{ color: "var(--text-secondary)" }}>Proje seçilmedi</h3>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Dashboard&apos;dan bir proje seçin</p>
        <Link href="/" className="btn btn-primary">Dashboard&apos;a Dön</Link>
      </div>
    );
  }
  if (loading) return <div className="empty-state"><Loader2 size={32} className="pulse" /></div>;
  if (!project) return <div className="empty-state"><Film size={64} /><h3 style={{ color: "var(--text-secondary)" }}>Proje bulunamadı</h3></div>;

  const totalDuration = project.durations.reduce((a, b) => a + b, 0);
  const finalDuration = totalDuration / (slowdown / 100);
  const videoSrc = (sceneFiles.final[0]?.url || sceneFiles.draft[0]?.url || "");
  const isHorizontal = project.contentType === "ekran";

  const tabs = [
    { key: "settings" as const, label: "Kurgu Ayarları", icon: <Settings size={14} /> },
    { key: "subtitle" as const, label: "Altyazı", icon: <Type size={14} /> },
    { key: "files" as const, label: "Dosyalar", icon: <FolderOpen size={14} /> },
  ];

  return (
    <>
      {/* Modal */}
      {previewModal && (
        <SceneModal src={previewModal.src} type={previewModal.type} onClose={() => setPreviewModal(null)} />
      )}

      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/scenes?project=${projectId}`} className="btn btn-ghost btn-icon"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="page-title">Edit Bay</h1>
            <p className="page-subtitle">{project.scenes.length} sahne • {project.contentType === "ekran" ? "16:9" : "9:16"}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            padding: "6px 14px", borderRadius: 20,
            background: "rgba(0,255,200,0.08)", border: "1px solid rgba(0,255,200,0.15)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Clock size={13} style={{ color: "var(--accent-cyan)" }} />
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-geist-mono)", color: "var(--accent-cyan)" }}>
              {finalDuration.toFixed(1)}s
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              ({totalDuration.toFixed(0)}s × {(slowdown / 100).toFixed(2)})
            </span>
          </div>
          {settingsChanged && (
            <div style={{
              padding: "5px 12px", borderRadius: 16,
              background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, color: "var(--accent-amber)",
            }}>
              <AlertTriangle size={12} /> Ayarlar değişti
            </div>
          )}
          <button className="btn btn-secondary" onClick={() => handleRender("draft")} disabled={rendering}
            title={`Crossfade: ${crossfade}s, Slowdown: ${(slowdown/100).toFixed(2)}x, CRF: ${crf}, Geçiş: ${transition}${addSubs ? `, Font: ${fontSize}pt` : ''}`}>
            {rendering ? <Loader2 size={16} className="pulse" /> : <Play size={16} />} Draft
          </button>
          <button className="btn btn-primary" onClick={() => handleRender("final")} disabled={rendering}
            title={`Crossfade: ${crossfade}s, Slowdown: ${(slowdown/100).toFixed(2)}x, CRF: ${crf}, Geçiş: ${transition}${addSubs ? `, Font: ${fontSize}pt` : ''}`}>
            <Download size={16} /> Final
          </button>
        </div>
      </div>

      {/* ═══ FAZ 1: SAHNE PANELİ ═══ */}
      <div className="glass-card" style={{ padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" as const }}>
          Sahneler
        </div>
        <div style={{
          display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4,
          scrollbarWidth: "thin" as const,
        }}>
          {project.scenes.map((s, i) => (
            <SceneCard
              key={s.scene}
              index={i}
              scene={s}
              project={project}
              sceneFiles={sceneFiles}
              onPreview={(src, type) => setPreviewModal({ src, type })}
            />
          ))}
        </div>
      </div>

      {/* Render Progress */}
      {rendering && renderProgress && (
        <div style={{
          padding: "10px 16px", marginBottom: 16, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))",
          border: "1px solid rgba(59,130,246,0.15)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Loader2 size={16} className="pulse" style={{ color: "var(--accent-blue)" }} />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{renderProgress}</span>
        </div>
      )}

      {/* ═══ VIDEO PLAYER ═══ */}
      <div style={{
        marginBottom: 16, display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: videoSrc ? 0 : 120,
      }}>
      {videoSrc ? (
          <div style={{ position: "relative", display: "inline-block" }}>
            <video key={`${videoSrc}_${renderKey}`} controls style={{
              maxHeight: "45vh", maxWidth: "100%", width: "auto",
              display: "block", borderRadius: 12,
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            }}>
              <source src={videoSrc} type="video/mp4" />
            </video>
            <a
              href={videoSrc}
              download
              style={{
                position: "absolute", top: 12, right: 12,
                background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10, padding: "8px 14px",
                color: "#fff", fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6,
                textDecoration: "none", cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.8)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.7)"; }}
            >
              <Download size={14} /> MP4 İndir
            </a>
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 120, width: "100%", borderRadius: 12,
            border: "1px dashed var(--border-subtle)",
            color: "var(--text-muted)", fontSize: 13, flexDirection: "column", gap: 6,
          }}>
            <Film size={28} style={{ opacity: 0.15 }} />
            Henüz video yok — Draft oluşturun
          </div>
        )}
      </div>

      {/* ═══ FAZ 2: INTERACTIVE TIMELINE ═══ */}
      <div className="glass-card" style={{ padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>Timeline</div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
          {project.scenes.map((s, i) => {
            const dur = project.durations[i] || 0;
            const pct = totalDuration > 0 ? Math.max(dur / totalDuration * 100, 8) : 100 / project.scenes.length;
            const imgSrc = sceneFiles.scenes_images[i];
            const vidSrc = sceneFiles.scenes_videos[i];
            return (
              <div key={s.scene} style={{ display: "flex", alignItems: "center", flex: `${pct} 0 0%` }}>
                <div
                  onClick={() => vidSrc && setPreviewModal({ src: vidSrc, type: "video" })}
                  style={{
                    width: "100%", minWidth: 80, height: 56, borderRadius: 8,
                    background: imgSrc
                      ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${imgSrc}) center/cover`
                      : `linear-gradient(135deg, rgba(59,130,246,${0.1 + (i % 2) * 0.05}), rgba(139,92,246,${0.1 + (i % 2) * 0.05}))`,
                    border: "1px solid var(--border-subtle)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    cursor: vidSrc ? "pointer" : "default",
                    transition: "all 0.2s", position: "relative", overflow: "hidden",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                    S{s.scene}
                  </span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-geist-mono)" }}>
                    {dur.toFixed(1)}s
                  </span>
                </div>
                {i < project.scenes.length - 1 && (
                  <div style={{
                    minWidth: 28, textAlign: "center", fontSize: 8,
                    color: "var(--accent-cyan)", fontWeight: 600,
                  }}>
                    ↕{crossfade}s
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ SETTINGS TABS ═══ */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: "12px 16px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
                color: activeTab === tab.key ? "var(--accent-cyan)" : "var(--text-muted)",
                background: activeTab === tab.key ? "rgba(0,255,200,0.04)" : "transparent",
                borderBottom: activeTab === tab.key ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                border: "none", cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {/* ⚙ Kurgu Ayarları */}
          {activeTab === "settings" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 600 }}>
              <div>
                <label className="label">Crossfade</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" className="slider" min="0" max="15" value={crossfade * 10} onChange={(e) => setCrossfade(Number(e.target.value) / 10)} />
                  <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", minWidth: 35, color: "var(--text-secondary)" }}>{crossfade}s</span>
                </div>
              </div>
              <div>
                <label className="label">Slowdown</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" className="slider" min="80" max="100" value={slowdown} onChange={(e) => setSlowdown(Number(e.target.value))} />
                  <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", minWidth: 45, color: "var(--text-secondary)" }}>{(slowdown / 100).toFixed(2)}x</span>
                </div>
              </div>
              <div>
                <label className="label">Kalite (CRF)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" className="slider" min="14" max="22" value={crf} onChange={(e) => setCrf(Number(e.target.value))} />
                  <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", minWidth: 20, color: "var(--text-secondary)" }}>{crf}</span>
                </div>
              </div>
              <div>
                <label className="label">Geçiş Tipi</label>
                <select className="input select" value={transition} onChange={(e) => setTransition(e.target.value)} style={{ fontSize: 13 }}>
                  <option value="fade">Fade</option>
                  <option value="fadeblack">Fade Black</option>
                  <option value="fadewhite">Fade White</option>
                  <option value="dissolve">Dissolve</option>
                  <option value="wipeleft">Wipe Left</option>
                  <option value="wiperight">Wipe Right</option>
                  <option value="wipeup">Wipe Up</option>
                  <option value="wipedown">Wipe Down</option>
                  <option value="slideright">Slide Right</option>
                  <option value="slideleft">Slide Left</option>
                  <option value="slideup">Slide Up</option>
                  <option value="slidedown">Slide Down</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "5px 12px" }}
                  onClick={() => {
                    setCrossfade(0.7); setSlowdown(88); setCrf(16); setTransition("fade");
                  }}
                >
                  Varsayılanlara Sıfırla
                </button>
              </div>
            </div>
          )}

          {/* 💬 Altyazı */}
          {activeTab === "subtitle" && (
            <div>
              {/* Controls row */}
              <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" as const, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={addSubs} onChange={(e) => setAddSubs(e.target.checked)} /> İngilizce altyazı ekle
                </label>
                {addSubs && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <label className="label" style={{ margin: 0, fontSize: 11 }}>Font Size</label>
                      <input className="input" type="number" value={fontSize}
                        min={10} max={100}
                        onChange={(e) => setFontSize(Math.max(10, Math.min(100, Number(e.target.value))))}
                        style={{ fontSize: 12, width: 65, padding: "4px 8px" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <label className="label" style={{ margin: 0, fontSize: 11 }}>MarginV</label>
                      <input className="input" type="number" value={marginV}
                        min={0} max={800}
                        onChange={(e) => setMarginV(Math.max(0, Math.min(800, Number(e.target.value))))}
                        style={{ fontSize: 12, width: 65, padding: "4px 8px" }} />
                    </div>
                    {subtitlesDirty && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: "6px 14px", fontSize: 12 }}
                        disabled={savingSubs}
                        onClick={async () => {
                          setSavingSubs(true);
                          try {
                            const ct = project.contentType === "ekran"
                              ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
                            const res = await fetch(`/api/projects/${encodeURIComponent(projectId!)}/save-subtitles`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                entries: subtitleEntries, fontSize, marginV,
                                width: ct.w, height: ct.h,
                              }),
                            });
                            const data = await res.json();
                            if (data.error) toast.error(data.error);
                            else { toast.success("Altyazılar kaydedildi!"); setSubtitlesDirty(false); }
                          } catch { toast.error("Kaydetme hatası"); }
                          setSavingSubs(false);
                        }}
                      >
                        {savingSubs ? <Loader2 size={12} className="pulse" /> : <Save size={12} />}
                        Kaydet
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ═══ CANLI ALTYAZI ÖNİZLEME ═══ */}
              {addSubs && subtitleEntries.length > 0 && (
                <div style={{
                  marginBottom: 16, borderRadius: 10, overflow: "hidden",
                  border: "1px solid var(--border-subtle)",
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                    padding: "6px 12px", letterSpacing: 0.5, background: "rgba(255,255,255,0.02)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>CANLI ÖNİZLEME — Sahne {selectedSubIdx + 1}</span>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 400 }}>
                      Font: {fontSize}pt, Margin: {marginV}
                    </span>
                  </div>
                  <div style={{
                    position: "relative",
                    aspectRatio: isHorizontal ? "16/9" : "9/16",
                    maxHeight: isHorizontal ? 220 : 200,
                    background: "#000",
                    display: "flex", alignItems: "flex-end", justifyContent: "center",
                    overflow: "hidden", margin: "0 auto",
                  }}>
                    {/* Scene image background */}
                    {sceneFiles.scenes_images[Math.min(selectedSubIdx, sceneFiles.scenes_images.length - 1)] && (
                      <img
                        src={sceneFiles.scenes_images[Math.min(selectedSubIdx, sceneFiles.scenes_images.length - 1)]}
                        alt="preview"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }}
                      />
                    )}
                    {/* Subtitle text overlay */}
                    <div style={{
                      position: "relative", zIndex: 1,
                      textAlign: "center",
                      padding: `0 16px ${Math.max(8, Math.round(marginV / 25))}px`,
                      width: "100%",
                    }}>
                      <span style={{
                        fontSize: Math.max(10, Math.min(28, Math.round(fontSize / 2))),
                        fontWeight: 700, color: "#fff",
                        textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)",
                        lineHeight: 1.4, display: "inline-block",
                        background: "rgba(0,0,0,0.5)", padding: "4px 10px", borderRadius: 6,
                      }}>
                        {subtitleEntries[selectedSubIdx]?.text || "..."}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ EDITABLE SUBTITLE LIST ═══ */}
              {subtitleEntries.length > 0 ? (
                <div style={{ borderRadius: 10, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                  <div style={{
                    padding: "8px 12px", fontSize: 11, fontWeight: 700,
                    color: "var(--accent-cyan)", background: "rgba(0,255,200,0.04)",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>ALTYAZI DÜZENLEME ({subtitleEntries.length} parça)</span>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 400 }}>
                      Metin düzenleyip &quot;Kaydet&quot; tuşuna basın
                    </span>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: "auto", scrollbarWidth: "thin" as const }}>
                    {subtitleEntries.map((entry, idx) => (
                      <div
                        key={entry.index}
                        onClick={() => setSelectedSubIdx(idx)}
                        style={{
                          display: "flex", gap: 8, padding: "8px 12px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          fontSize: 12, alignItems: "flex-start",
                          background: selectedSubIdx === idx ? "rgba(0,255,200,0.04)" : "transparent",
                          cursor: "pointer", transition: "background 0.15s",
                        }}
                      >
                        {/* Index badge */}
                        <span style={{
                          minWidth: 24, textAlign: "center", fontSize: 10, fontWeight: 700,
                          color: selectedSubIdx === idx ? "var(--accent-cyan)" : "var(--text-muted)",
                          background: selectedSubIdx === idx ? "rgba(0,255,200,0.12)" : "rgba(255,255,255,0.04)",
                          borderRadius: 4, padding: "2px 4px", marginTop: 2,
                        }}>
                          {entry.index}
                        </span>
                        {/* Timestamp */}
                        <div style={{ minWidth: 110, fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--text-muted)", lineHeight: 2 }}>
                          {entry.start} → {entry.end}
                        </div>
                        {/* Editable text */}
                        <textarea
                          value={entry.text}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const updated = [...subtitleEntries];
                            updated[idx] = { ...entry, text: e.target.value };
                            setSubtitleEntries(updated);
                            setSubtitlesDirty(true);
                          }}
                          rows={Math.max(1, Math.ceil(entry.text.length / 50))}
                          style={{
                            flex: 1, fontSize: 12, lineHeight: 1.4,
                            color: "var(--text-primary)",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 6, padding: "4px 8px",
                            resize: "vertical", minHeight: 28,
                            fontFamily: "inherit", outline: "none",
                          }}
                        />
                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = subtitleEntries.filter((_, j) => j !== idx);
                            // Re-index
                            const reindexed = updated.map((e, i) => ({ ...e, index: i + 1 }));
                            setSubtitleEntries(reindexed);
                            setSubtitlesDirty(true);
                            if (selectedSubIdx >= reindexed.length) setSelectedSubIdx(Math.max(0, reindexed.length - 1));
                          }}
                          title="Bu altyazıyı sil"
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--text-muted)", padding: 4, borderRadius: 4,
                            opacity: 0.4, transition: "opacity 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : sceneFiles.subtitles.length === 0 ? (
                <div style={{
                  padding: 24, textAlign: "center", borderRadius: 10,
                  border: "1px dashed var(--border-subtle)",
                  color: "var(--text-muted)", fontSize: 13,
                }}>
                  <Type size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p>Henüz altyazı yok — Draft veya Final render sonrası oluşturulur.</p>
                </div>
              ) : (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  <Loader2 size={16} className="pulse" style={{ marginBottom: 4 }} />
                  <p>Altyazı dosyası yükleniyor...</p>
                </div>
              )}
            </div>
          )}

          {/* 📂 Dosyalar */}
          {activeTab === "files" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              {sceneFiles.draft.length === 0 && sceneFiles.final.length === 0 && (
                <div style={{
                  padding: 24, textAlign: "center", borderRadius: 10,
                  border: "1px dashed var(--border-subtle)",
                  color: "var(--text-muted)", fontSize: 13,
                }}>
                  <FolderOpen size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p>Henüz dosya yok — Draft veya Final oluşturun.</p>
                </div>
              )}

              {/* Final files */}
              {sceneFiles.final.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-green)", marginBottom: 6, letterSpacing: 0.5 }}>
                    FINAL ({sceneFiles.final.length})
                  </div>
                  {sceneFiles.final.map((f, i) => (
                    <div key={`f-${i}`} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 12px", borderRadius: 8, marginBottom: 4,
                      background: "rgba(0,255,120,0.04)", border: "1px solid rgba(0,255,120,0.1)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CheckCircle2 size={14} style={{ color: "var(--accent-green)" }} />
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 12 }}>{f.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            {f.size > 0 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setPreviewModal({ src: f.url, type: "video" })} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                          <Eye size={12} /> Oynat
                        </button>
                        <a href={f.url} download className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                          <Download size={12} /> İndir
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Draft files */}
              {sceneFiles.draft.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: 0.5 }}>
                    DRAFT ({sceneFiles.draft.length})
                  </div>
                  {sceneFiles.draft.map((f, i) => (
                    <div key={`d-${i}`} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 12px", borderRadius: 8, marginBottom: 4,
                      background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Film size={14} style={{ color: "var(--text-muted)" }} />
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 12 }}>{f.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            {f.size > 0 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setPreviewModal({ src: f.url, type: "video" })} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                          <Eye size={12} /> Oynat
                        </button>
                        <a href={f.url} download className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                          <Download size={12} /> İndir
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Subtitle files */}
              {sceneFiles.subtitles.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-cyan)", marginBottom: 6, letterSpacing: 0.5 }}>
                    ALTYAZI ({sceneFiles.subtitles.length})
                  </div>
                  {sceneFiles.subtitles.map((f, i) => (
                    <div key={`s-${i}`} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 12px", borderRadius: 8, marginBottom: 4,
                      background: "rgba(0,255,200,0.02)", border: "1px solid var(--border-subtle)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Type size={14} style={{ color: "var(--accent-cyan)" }} />
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 12 }}>{f.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            {f.size > 0 ? `${(f.size / 1024).toFixed(1)} KB` : ""}
                          </div>
                        </div>
                      </div>
                      <a href={f.url} download className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                        <Download size={12} /> İndir
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<div className="empty-state"><Loader2 size={32} className="pulse" /></div>}>
      <EditContent />
    </Suspense>
  );
}
