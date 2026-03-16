"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Scissors, Download, Play, Loader2 } from "lucide-react";
import type { Project } from "@/store/studio";
import { useToast } from "@/components/toast";

function EditContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<{ draft: string[]; final: string[] }>({ draft: [], final: [] });
  const [crossfade, setCrossfade] = useState(0.7);
  const [slowdown, setSlowdown] = useState(88);
  const [crf, setCrf] = useState(16);
  const [transition, setTransition] = useState("fade");
  const [rendering, setRendering] = useState(false);
  const toast = useToast();

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
        setFiles({ draft: data.draft || [], final: data.final || [] });
      });
  }, [projectId]);

  const handleRender = async (type: "draft" | "final") => {
    if (!projectId) return;
    setRendering(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type,
          crossfade,
          slowdown: slowdown / 100,
          crf,
          transition,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`Render hatası: ${data.error}`);
        setRendering(false);
        return;
      }

      toast.info("Render başlatıldı, işleniyor...");

      // Poll render log until done
      const pollInterval = setInterval(async () => {
        try {
          const logRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`);
          const logData = await logRes.json();
          // Check if new draft/final appeared
          const newDrafts = logData.draft || [];
          const newFinals = logData.final || [];
          const hasDraft = newDrafts.length > files.draft.length;
          const hasFinal = newFinals.length > files.final.length;

          if (hasDraft || hasFinal) {
            clearInterval(pollInterval);
            setFiles({ draft: newDrafts, final: newFinals });
            toast.success(`${type === "final" ? "Final" : "Draft"} render tamamlandı!`);
            setRendering(false);
          }
        } catch {
          // ignore polling errors
        }
      }, 3000);

      // Safety timeout: stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (rendering) {
          setRendering(false);
          toast.warning("Render uzun sürüyor, lütfen dosyaları kontrol edin");
        }
      }, 300000);
    } catch (e) {
      console.error(e);
      toast.error("Render başlatılamadı");
      setRendering(false);
    }
  };

  if (!projectId) {
    return (
      <div className="empty-state">
        <Scissors size={64} />
        <h3 style={{ color: "var(--text-secondary)" }}>Proje seçilmedi</h3>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Dashboard&apos;dan bir proje seçin</p>
        <Link href="/" className="btn btn-primary">Dashboard&apos;a Dön</Link>
      </div>
    );
  }

  if (loading) return <div className="empty-state"><Loader2 size={32} className="pulse" /></div>;
  if (!project) return <div className="empty-state"><Scissors size={64} /><h3 style={{ color: "var(--text-secondary)" }}>Proje bulunamadı</h3></div>;

  const totalDuration = project.durations.reduce((a, b) => a + b, 0);
  const finalDuration = totalDuration / (slowdown / 100);

  // Pick the best available video
  const videoSrc = files.final[0] || files.draft[0] || project.finalPath || project.draftPath || "";

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/scenes?project=${projectId}`} className="btn btn-ghost btn-icon"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="page-title">Edit Bay</h1>
            <p className="page-subtitle">Final kurgu ayarları</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => handleRender("draft")} disabled={rendering}>
            {rendering ? <Loader2 size={16} className="pulse" /> : <Play size={16} />} Draft Oluştur
          </button>
          <button className="btn btn-primary" onClick={() => handleRender("final")} disabled={rendering}>
            <Download size={16} /> Final Dışa Aktar
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Video Player */}
        <div>
          <div className="glass-card" style={{ padding: 16 }}>
            <div className="video-container" style={{ marginBottom: 16, aspectRatio: project.contentType === "ekran" ? "16/9" : "9/16", maxHeight: 450 }}>
              {videoSrc ? (
                <video
                  key={videoSrc}
                  controls
                  style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
                >
                  <source src={videoSrc} type="video/mp4" />
                </video>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 14 }}>
                  Henüz video yok — Draft oluşturun
                </div>
              )}
            </div>
            {/* Timeline */}
            <div style={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              {project.scenes.map((s, i) => (
                <div key={s.scene} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{
                    flex: 1,
                    minWidth: 60,
                    height: 32,
                    background: "var(--bg-card)",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                  }}>
                    S{s.scene} • {(project.durations[i] || 0).toFixed(1)}s
                  </div>
                  {i < project.scenes.length - 1 && (
                    <div style={{ width: 20, textAlign: "center", fontSize: 9, color: "var(--text-muted)" }}>
                      ↕{crossfade}s
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ayarlar Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Kurgu Ayarları */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div className="section-title" style={{ fontSize: 14 }}>Kurgu Ayarları</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Crossfade</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" className="slider" min="0" max="15" value={crossfade * 10} onChange={(e) => setCrossfade(Number(e.target.value) / 10)} />
                  <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", minWidth: 35 }}>{crossfade}s</span>
                </div>
              </div>
              <div>
                <label className="label">Slowdown</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" className="slider" min="80" max="100" value={slowdown} onChange={(e) => setSlowdown(Number(e.target.value))} />
                  <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", minWidth: 45 }}>{(slowdown/100).toFixed(2)}x</span>
                </div>
              </div>
              <div>
                <label className="label">Kalite (CRF)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" className="slider" min="14" max="22" value={crf} onChange={(e) => setCrf(Number(e.target.value))} />
                  <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", minWidth: 20 }}>{crf}</span>
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
          </div>

          {/* Altyazı Ayarları */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div className="section-title" style={{ fontSize: 14 }}>Altyazı</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" defaultChecked /> İngilizce altyazı ekle
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="label">Font Size</label>
                  <input className="input" defaultValue="42" style={{ fontSize: 13 }} />
                </div>
                <div>
                  <label className="label">MarginV</label>
                  <input className="input" defaultValue="550" style={{ fontSize: 13 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Özet */}
          <div className="glass-card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tahmini Süre</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-geist-mono)", color: "var(--accent-cyan)" }}>
              {finalDuration.toFixed(1)}s
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              ({totalDuration.toFixed(1)}s ham → {(slowdown/100).toFixed(2)}x slowdown)
            </div>
          </div>

          {/* Available files */}
          {(files.draft.length > 0 || files.final.length > 0) && (
            <div className="glass-card" style={{ padding: 16 }}>
              <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>Mevcut Dosyalar</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {files.draft.length > 0 && <div>📋 {files.draft.length} draft</div>}
                {files.final.length > 0 && <div>🎬 {files.final.length} final</div>}
              </div>
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
