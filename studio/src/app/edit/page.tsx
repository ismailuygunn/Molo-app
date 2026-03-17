"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Download, Play, Loader2, Film, Clock, Settings,
  Type, FolderOpen, Volume2, VolumeX, Eye, Pause, CheckCircle2, X
} from "lucide-react";
import type { Project } from "@/store/studio";
import { useToast } from "@/components/toast";

/* ────────────── Types ────────────── */
interface SceneFiles {
  scenes_images: string[];
  scenes_videos: string[];
  audio: string[];
  draft: string[];
  final: string[];
  subtitles: string[];
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
  scene: { scene: number; text: string };
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
        {scene.text}
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
      localStorage.setItem(storageKey, JSON.stringify({ crossfade, slowdown, crf, transition, addSubs, fontSize, marginV }));
    }
  }, [crossfade, slowdown, crf, transition, addSubs, fontSize, marginV, projectId, storageKey]);

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

  const fetchFiles = () => {
    if (!projectId) return;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
      .then((r) => r.json())
      .then((data) => setSceneFiles({
        scenes_images: data.scenes_images || [],
        scenes_videos: data.scenes_videos || [],
        audio: data.audio || [],
        draft: data.draft || [],
        final: data.final || [],
        subtitles: data.subtitles || [],
      }));
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

      // Poll for progress via render log
      const startDraftCount = sceneFiles.draft.length;
      const startFinalCount = sceneFiles.final.length;

      const pollInterval = setInterval(async () => {
        try {
          const logRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`);
          const logData = await logRes.json();
          const newDrafts = logData.draft || [];
          const newFinals = logData.final || [];

          // Check for new per-scene drafts (s01_final.mp4 etc)
          const sceneDrafts = newDrafts.filter((f: string) => /s\d+_final\.mp4/.test(f));
          if (sceneDrafts.length > 0 && project) {
            setRenderProgress(`Sahneler birleştiriliyor... (${sceneDrafts.length}/${project.scenes.length})`);
          }

          const hasDraft = newDrafts.length > startDraftCount;
          const hasFinal = newFinals.length > startFinalCount;

          if (hasDraft || hasFinal) {
            clearInterval(pollInterval);
            setSceneFiles({
              scenes_images: logData.scenes_images || [],
              scenes_videos: logData.scenes_videos || [],
              audio: logData.audio || [],
              draft: newDrafts,
              final: newFinals,
              subtitles: logData.subtitles || [],
            });
            toast.success(`${type === "final" ? "Final" : "Draft"} render tamamlandı!`);
            setRendering(false);
            setRenderProgress("");
          }
        } catch {
          // ignore poll errors
        }
      }, 3000);

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
  const videoSrc = sceneFiles.final[0] || sceneFiles.draft[0] || "";
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
          <button className="btn btn-secondary" onClick={() => handleRender("draft")} disabled={rendering}>
            {rendering ? <Loader2 size={16} className="pulse" /> : <Play size={16} />} Draft
          </button>
          <button className="btn btn-primary" onClick={() => handleRender("final")} disabled={rendering}>
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

      {/* ═══ VIDEO PLAYER (full width) ═══ */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <div style={{
          aspectRatio: isHorizontal ? "16/9" : "9/16",
          maxHeight: isHorizontal ? "60vh" : "65vh",
          background: "#000", margin: "0 auto",
        }}>
          {videoSrc ? (
            <video key={videoSrc} controls style={{ width: "100%", height: "100%", objectFit: "contain" }}>
              <source src={videoSrc} type="video/mp4" />
            </video>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 14, flexDirection: "column", gap: 8 }}>
              <Film size={40} style={{ opacity: 0.15 }} />
              Henüz video yok — Draft oluşturun
            </div>
          )}
        </div>
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
                  <option value="dissolve">Dissolve</option>
                  <option value="wipeleft">Wipe Left</option>
                  <option value="slideright">Slide Right</option>
                </select>
              </div>
            </div>
          )}

          {/* 💬 Altyazı */}
          {activeTab === "subtitle" && (
            <div style={{ maxWidth: 500 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 16 }}>
                <input type="checkbox" checked={addSubs} onChange={(e) => setAddSubs(e.target.checked)} /> İngilizce altyazı ekle
              </label>
              {addSubs && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label className="label">Font Size</label>
                    <input className="input" type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ fontSize: 13 }} />
                  </div>
                  <div>
                    <label className="label">MarginV</label>
                    <input className="input" type="number" value={marginV} onChange={(e) => setMarginV(Number(e.target.value))} style={{ fontSize: 13 }} />
                  </div>
                </div>
              )}
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
                Altyazılar cümle bazlı bölünerek gösterilir. Draft/Final renderda uygulanır.
              </p>
            </div>
          )}

          {/* 📂 Dosyalar */}
          {activeTab === "files" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              {sceneFiles.draft.length === 0 && sceneFiles.final.length === 0 && (
                <p style={{ color: "var(--text-muted)" }}>Henüz dosya yok — Draft veya Final oluşturun.</p>
              )}
              {sceneFiles.final.map((f, i) => (
                <div key={`f-${i}`} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", borderRadius: 8,
                  background: "rgba(0,255,120,0.04)", border: "1px solid rgba(0,255,120,0.1)",
                }}>
                  <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>
                    <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                    Final {i + 1}
                  </span>
                  <a href={f} download className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                    <Download size={12} /> İndir
                  </a>
                </div>
              ))}
              {sceneFiles.draft.map((f, i) => (
                <div key={`d-${i}`} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)",
                }}>
                  <span style={{ color: "var(--text-secondary)" }}>📋 Draft {i + 1}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setPreviewModal({ src: f, type: "video" })} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                      <Eye size={12} /> Oynat
                    </button>
                    <a href={f} download className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                      <Download size={12} /> İndir
                    </a>
                  </div>
                </div>
              ))}
              {sceneFiles.subtitles.map((f, i) => (
                <div key={`s-${i}`} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)",
                }}>
                  <span style={{ color: "var(--text-muted)" }}>💬 Altyazı {i + 1}</span>
                  <a href={f} download className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                    <Download size={12} /> İndir
                  </a>
                </div>
              ))}
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
