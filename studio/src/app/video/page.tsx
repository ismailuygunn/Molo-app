"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Check, Film, Loader2, Clock, Zap, ImageIcon, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { MoloLoading } from "@/components/molo";
import type { Project } from "@/store/studio";

function VideoContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoFiles, setVideoFiles] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        const p = data.find((x) => x.id === projectId);
        if (p) setProject(p);
        setLoading(false);
      });
    fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
      .then((r) => r.json())
      .then((data) => {
        setVideoFiles(data.scenes_videos || []);
        setImageFiles(data.scenes_images || []);
      });
  }, [projectId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!project) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); setSelected(p => Math.max(0, p - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setSelected(p => Math.min(project.scenes.length - 1, p + 1)); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [project]);

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

  if (loading) return <div className="empty-state"><MoloLoading text="Videolar yükleniyor..." /></div>;
  if (!project) return <div className="empty-state"><Film size={64} /><h3 style={{ color: "var(--text-secondary)" }}>Proje bulunamadı</h3></div>;

  const scene = project.scenes[selected];
  const hasVideos = videoFiles.length > 0;
  const isHorizontal = project.contentType === "ekran";

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/scenes?project=${projectId}`} className="btn btn-ghost btn-icon"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="page-title">Video Preview</h1>
            <p className="page-subtitle">Kling v3 • {videoFiles.length}/{project.scenes.length} video hazır</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {hasVideos && (
            <button
              className="btn btn-ghost"
              onClick={() => setShowComparison(!showComparison)}
              style={{ fontSize: 12 }}
            >
              <ImageIcon size={14} /> {showComparison ? "Video" : "Karşılaştır"}
            </button>
          )}
          {hasVideos && (
            <button className="btn btn-primary">
              <Check size={16} /> Tüm Videoları Onayla
            </button>
          )}
        </div>
      </div>

      {!hasVideos ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <Film size={48} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 12, color: "var(--text-muted)" }}>
            Videolar henüz üretilmedi. Pipeline&apos;ı çalıştırın.
          </p>
          <Link href={`/scenes?project=${projectId}`} className="btn btn-secondary" style={{ marginTop: 12 }}>
            Sahneler&apos;e Dön
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 }}>
          {/* Video/Comparison Player */}
          <div>
            {scene && (
              <div className="glass-card" style={{ padding: 16 }}>
                {showComparison ? (
                  /* Side-by-side: Image vs Video */
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--text-muted)" }}>📸 Referans Görsel</div>
                      <div style={{ aspectRatio: isHorizontal ? "16/9" : "9/16", maxHeight: 400, background: "var(--bg-secondary)", borderRadius: 8, overflow: "hidden" }}>
                        {imageFiles[selected] ? (
                          <img src={imageFiles[selected]} alt="Referans" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                            Görsel yok
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--text-muted)" }}>🎬 Video</div>
                      <div style={{ aspectRatio: isHorizontal ? "16/9" : "9/16", maxHeight: 400, background: "var(--bg-secondary)", borderRadius: 8, overflow: "hidden" }}>
                        <video key={selected} controls autoPlay style={{ width: "100%", height: "100%", objectFit: "contain" }}>
                          {videoFiles[selected] && <source src={videoFiles[selected]} type="video/mp4" />}
                        </video>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Normal video player */
                  <div style={{ marginBottom: 16, position: "relative" }}>
                    <div style={{ aspectRatio: isHorizontal ? "16/9" : "9/16", maxHeight: 500, background: "var(--bg-secondary)", borderRadius: 8, overflow: "hidden" }}>
                      <video
                        key={selected}
                        controls
                        autoPlay
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        poster={imageFiles[selected]}
                      >
                        {videoFiles[selected] && <source src={videoFiles[selected]} type="video/mp4" />}
                      </video>
                    </div>
                    {/* Nav arrows */}
                    {selected > 0 && (
                      <button onClick={() => setSelected(selected - 1)} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.3)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <ChevronLeft size={18} style={{ color: "#fff" }} />
                      </button>
                    )}
                    {selected < videoFiles.length - 1 && (
                      <button onClick={() => setSelected(selected + 1)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.3)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <ChevronRight size={18} style={{ color: "#fff" }} />
                      </button>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>Sahne {selected + 1} / {project.scenes.length}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {videoFiles[selected] && (
                      <a href={videoFiles[selected]} download className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }}>
                        <Download size={13} /> İndir
                      </a>
                    )}
                    <button className="btn btn-secondary" style={{ fontSize: 12 }}>
                      <RefreshCw size={14} /> Yeniden Üret
                    </button>
                    <button className="btn btn-primary" style={{ fontSize: 12 }}>
                      <Check size={14} /> Onayla
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sahne Listesi */}
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>
              <Zap size={16} /> İlerleme
            </div>
            <div className="progress-bar" style={{ marginBottom: 16 }}>
              <div className="progress-fill" style={{ width: `${Math.round((videoFiles.length / Math.max(project.scenes.length, 1)) * 100)}%` }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              {videoFiles.length} / {project.scenes.length} video tamamlandı
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {project.scenes.map((s, i) => {
                const hasVideo = i < videoFiles.length;
                const isActive = i === selected;
                return (
                  <div
                    key={s.scene}
                    className={`timeline-item ${isActive ? "active" : ""}`}
                    onClick={() => setSelected(i)}
                    style={{ opacity: hasVideo ? 1 : 0.5, padding: "8px 12px" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>S{s.scene}</span>
                        {hasVideo && <Check size={12} style={{ color: "var(--accent-green)" }} />}
                        {!hasVideo && <span style={{ fontSize: 9, color: "var(--accent-amber)" }}>⏳</span>}
                      </div>
                      {project.durations[i] !== undefined && project.durations[i] > 0 && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                          <Clock size={10} /> {project.durations[i].toFixed(1)}s
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(s.text_de || (s as unknown as Record<string, string>).text || "").slice(0, 40)}...
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function VideoPage() {
  return (
    <Suspense fallback={<div className="empty-state"><MoloLoading text="Yükleniyor..." /></div>}>
      <VideoContent />
    </Suspense>
  );
}
