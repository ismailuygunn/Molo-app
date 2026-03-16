"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Check, Film, Loader2, Clock, Zap } from "lucide-react";
import type { Project } from "@/store/studio";

function VideoContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoFiles, setVideoFiles] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        const p = data.find((x) => x.id === projectId);
        if (p) setProject(p);
        setLoading(false);
      });
    // Fetch real files
    fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
      .then((r) => r.json())
      .then((data) => {
        setVideoFiles(data.scenes_videos || []);
        setImageFiles(data.scenes_images || []);
      });
  }, [projectId]);

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

  const scene = project.scenes[selected];
  const hasVideos = videoFiles.length > 0;

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
        {hasVideos && (
          <button className="btn btn-primary">
            <Check size={16} /> Tüm Videoları Onayla
          </button>
        )}
      </div>

      {!hasVideos ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <Film size={48} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 12, color: "var(--text-muted)" }}>
            Videolar henüz üretilmedi. Pipeline&apos;ı çalıştırın.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
          {/* Video Player */}
          <div>
            {scene && (
              <div className="glass-card" style={{ padding: 16 }}>
                <div className="video-container" style={{ marginBottom: 16, aspectRatio: project.contentType === "ekran" ? "16/9" : "9/16", maxHeight: 450 }}>
                  <video
                    key={selected}
                    controls
                    autoPlay
                    style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
                    poster={imageFiles[selected]}
                  >
                    {videoFiles[selected] && <source src={videoFiles[selected]} type="video/mp4" />}
                  </video>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>Sahne {selected + 1}</span>
                  <div style={{ display: "flex", gap: 8 }}>
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
            <div className="section-title" style={{ marginBottom: 12 }}>
              <Zap size={16} /> İlerleme
            </div>
            <div className="progress-bar" style={{ marginBottom: 16 }}>
              <div className="progress-fill" style={{ width: `${Math.round((videoFiles.length / Math.max(project.scenes.length, 1)) * 100)}%` }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {project.scenes.map((s, i) => {
                const hasVideo = i < videoFiles.length;
                return (
                  <div
                    key={s.scene}
                    className={`timeline-item ${i === selected ? "active" : ""}`}
                    onClick={() => setSelected(i)}
                    style={{ opacity: hasVideo ? 1 : 0.5 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>S{s.scene}</span>
                        {hasVideo && <Check size={14} style={{ color: "var(--accent-green)" }} />}
                      </div>
                      {project.durations[i] !== undefined && project.durations[i] > 0 && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                          <Clock size={10} /> {project.durations[i].toFixed(1)}s
                        </span>
                      )}
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
    <Suspense fallback={<div className="empty-state"><Loader2 size={32} className="pulse" /></div>}>
      <VideoContent />
    </Suspense>
  );
}
