"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Scissors, Download, Play, Loader2, Film, CheckCircle2, Clock, Settings, Type, FolderOpen } from "lucide-react";
import type { Project } from "@/store/studio";
import { useToast } from "@/components/toast";

function EditContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<{ draft: string[]; final: string[]; subtitles: string[] }>({ draft: [], final: [], subtitles: [] });
  const [rendering, setRendering] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "subtitle" | "files">("settings");
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
  const [marginV, setMarginV] = useState(saved.marginV ?? 200);

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

  const tabs = [
    { key: "settings" as const, label: "Kurgu Ayarları", icon: <Settings size={14} /> },
    { key: "subtitle" as const, label: "Altyazı", icon: <Type size={14} /> },
    { key: "files" as const, label: "Dosyalar", icon: <FolderOpen size={14} /> },
  ];

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Duration badge */}
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

      {/* Full-width Video Player */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div style={{
          aspectRatio: isHorizontal ? "16/9" : "9/16",
          maxHeight: isHorizontal ? "65vh" : "70vh",
          background: "#000",
          margin: "0 auto",
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

      {/* Timeline — full width */}
      <div className="glass-card" style={{ padding: "12px 16px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>Timeline</div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {project.scenes.map((s, i) => {
            const dur = project.durations[i] || 0;
            const pct = totalDuration > 0 ? Math.max(dur / totalDuration * 100, 8) : 100 / project.scenes.length;
            return (
              <div key={s.scene} style={{ display: "flex", alignItems: "center", flex: `${pct} 0 0%` }}>
                <div style={{
                  width: "100%", minWidth: 50,
                  height: 36, borderRadius: 6,
                  background: `linear-gradient(135deg, rgba(59,130,246,${0.1 + (i % 2) * 0.05}), rgba(139,92,246,${0.1 + (i % 2) * 0.05}))`,
                  border: "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
                }}>
                  S{s.scene} • {dur.toFixed(1)}s
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

      {/* Settings Tabs — full width */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Tab Header */}
        <div style={{
          display: "flex", borderBottom: "1px solid var(--border-subtle)",
        }}>
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
                border: "none", cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
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
                Altyazılar cümle bazlı bölünerek gösterilir — her sahne için kısa parçalar halinde.
              </p>
            </div>
          )}

          {/* 📂 Dosyalar */}
          {activeTab === "files" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              {files.draft.length === 0 && files.final.length === 0 && (
                <p style={{ color: "var(--text-muted)" }}>Henüz dosya yok — Draft veya Final oluşturun.</p>
              )}
              {files.final.map((f, i) => (
                <div key={`f-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "rgba(0,255,120,0.04)", border: "1px solid rgba(0,255,120,0.1)" }}>
                  <span style={{ color: "var(--accent-green)", fontWeight: 600 }}><CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Final {i + 1}</span>
                  <a href={f} download className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                    <Download size={12} /> İndir
                  </a>
                </div>
              ))}
              {files.draft.map((f, i) => (
                <div key={`d-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>📋 Draft {i + 1}</span>
                  <a href={f} download className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>
                    <Download size={12} /> İndir
                  </a>
                </div>
              ))}
              {files.subtitles.map((f, i) => (
                <div key={`s-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
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
