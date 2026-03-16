"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Scissors, Download, Play, Loader2, Film, CheckCircle2, Clock, Settings } from "lucide-react";
import type { Project } from "@/store/studio";
import { useToast } from "@/components/toast";

function EditContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<{ draft: string[]; final: string[]; subtitles: string[] }>({ draft: [], final: [], subtitles: [] });
  const [rendering, setRendering] = useState(false);
  const toast = useToast();

  // localStorage persistence for render params
  const storageKey = `molo_edit_${projectId}`;
  const saved = typeof window !== "undefined" ? JSON.parse(localStorage.getItem(storageKey) || "{}") : {};
  const [crossfade, setCrossfade] = useState(saved.crossfade ?? 0.7);
  const [slowdown, setSlowdown] = useState(saved.slowdown ?? 88);
  const [crf, setCrf] = useState(saved.crf ?? 16);
  const [transition, setTransition] = useState(saved.transition ?? "fade");
  const [addSubs, setAddSubs] = useState(saved.addSubs !== false);
  const [fontSize, setFontSize] = useState(saved.fontSize ?? 42);
  const [marginV, setMarginV] = useState(saved.marginV ?? 550);

  // Save to localStorage on change
  useEffect(() => {
    if (projectId) {
      localStorage.setItem(storageKey, JSON.stringify({ crossfade, slowdown, crf, transition, addSubs, fontSize, marginV }));
    }
  }, [crossfade, slowdown, crf, transition, addSubs, fontSize, marginV, projectId, storageKey]);

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
        setFiles({ draft: data.draft || [], final: data.final || [], subtitles: data.subtitles || [] });
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
          projectId, type, crossfade, slowdown: slowdown / 100, crf, transition,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`Render hatası: ${data.error}`);
        setRendering(false);
        return;
      }

      toast.info("Render başlatıldı, işleniyor...");

      const pollInterval = setInterval(async () => {
        try {
          const logRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`);
          const logData = await logRes.json();
          const newDrafts = logData.draft || [];
          const newFinals = logData.final || [];
          const hasDraft = newDrafts.length > files.draft.length;
          const hasFinal = newFinals.length > files.final.length;

          if (hasDraft || hasFinal) {
            clearInterval(pollInterval);
            setFiles({ draft: newDrafts, final: newFinals, subtitles: logData.subtitles || [] });
            toast.success(`${type === "final" ? "Final" : "Draft"} render tamamlandı!`);
            setRendering(false);
          }
        } catch {
          // ignore
        }
      }, 3000);

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
  const videoSrc = files.final[0] || files.draft[0] || "";
  const isHorizontal = project.contentType === "ekran";

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/scenes?project=${projectId}`} className="btn btn-ghost btn-icon"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="page-title">Edit Bay</h1>
            <p className="page-subtitle">Final kurgu ayarları • {project.scenes.length} sahne</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => handleRender("draft")} disabled={rendering}>
            {rendering ? <Loader2 size={16} className="pulse" /> : <Play size={16} />} Draft
          </button>
          <button className="btn btn-primary" onClick={() => handleRender("final")} disabled={rendering}>
            <Download size={16} /> Final
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        {/* Video Player + Timeline */}
        <div>
          <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ marginBottom: 16, aspectRatio: isHorizontal ? "16/9" : "9/16", maxHeight: 450, background: "#000", borderRadius: 8, overflow: "hidden" }}>
              {videoSrc ? (
                <video key={videoSrc} controls style={{ width: "100%", height: "100%", objectFit: "contain" }}>
                  <source src={videoSrc} type="video/mp4" />
                </video>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 14, flexDirection: "column", gap: 8 }}>
                  <Film size={32} style={{ opacity: 0.2 }} />
                  Henüz video yok — Draft oluşturun
                </div>
              )}
            </div>

            {/* Visual Timeline */}
            <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Timeline</div>
            <div style={{ display: "flex", alignItems: "center", gap: 2, overflowX: "auto", paddingBottom: 4 }}>
              {project.scenes.map((s, i) => {
                const dur = project.durations[i] || 0;
                const pct = totalDuration > 0 ? Math.max(dur / totalDuration * 100, 8) : 100 / project.scenes.length;
                return (
                  <div key={s.scene} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{
                      width: `${pct}%`, minWidth: 50,
                      height: 36, borderRadius: 6,
                      background: `linear-gradient(135deg, rgba(59,130,246,${0.1 + (i % 2) * 0.05}), rgba(139,92,246,${0.1 + (i % 2) * 0.05}))`,
                      border: "1px solid var(--border-subtle)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
                      cursor: "default",
                    }}>
                      S{s.scene} • {dur.toFixed(1)}s
                    </div>
                    {i < project.scenes.length - 1 && (
                      <div style={{
                        width: 24, textAlign: "center", fontSize: 8,
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
        </div>

        {/* Settings Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Duration Summary */}
          <div className="glass-card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tahmini Süre</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-geist-mono)", color: "var(--accent-cyan)" }}>
              {finalDuration.toFixed(1)}s
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              ({totalDuration.toFixed(1)}s ham → {(slowdown / 100).toFixed(2)}x slowdown)
            </div>
          </div>

          {/* Kurgu Ayarları */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div className="section-title" style={{ fontSize: 14, marginBottom: 14 }}>
              <Settings size={15} /> Kurgu Ayarları
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
          </div>

          {/* Altyazı */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div className="section-title" style={{ fontSize: 14, marginBottom: 12 }}>Altyazı</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
              <input type="checkbox" checked={addSubs} onChange={(e) => setAddSubs(e.target.checked)} /> İngilizce altyazı ekle
            </label>
            {addSubs && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
          </div>

          {/* Available files */}
          {(files.draft.length > 0 || files.final.length > 0) && (
            <div className="glass-card" style={{ padding: 16 }}>
              <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>Mevcut Dosyalar</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                {files.draft.map((f, i) => (
                  <div key={`d-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)" }}>📋 Draft {i + 1}</span>
                    <a href={f} download className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }}>
                      <Download size={11} /> İndir
                    </a>
                  </div>
                ))}
                {files.final.map((f, i) => (
                  <div key={`f-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>🎬 Final {i + 1}</span>
                    <a href={f} download className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }}>
                      <Download size={11} /> İndir
                    </a>
                  </div>
                ))}
                {files.subtitles.map((f, i) => (
                  <div key={`s-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)" }}>💬 Altyazı {i + 1}</span>
                    <a href={f} download className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }}>
                      <Download size={11} /> İndir
                    </a>
                  </div>
                ))}
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
