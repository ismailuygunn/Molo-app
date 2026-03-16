"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Download, Check, ImageIcon, Loader2, ZoomIn, Film, ChevronLeft, ChevronRight } from "lucide-react";
import type { Project } from "@/store/studio";

function ImagesContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

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
        setImageFiles(data.scenes_images || []);
      });
  }, [projectId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lightbox) {
        if (e.key === "Escape") setLightbox(null);
        if (e.key === "ArrowLeft") {
          const idx = imageFiles.indexOf(lightbox);
          if (idx > 0) setLightbox(imageFiles[idx - 1]);
        }
        if (e.key === "ArrowRight") {
          const idx = imageFiles.indexOf(lightbox);
          if (idx < imageFiles.length - 1) setLightbox(imageFiles[idx + 1]);
        }
        return;
      }
      if (!imageFiles.length) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); setSelected(p => Math.max(0, p - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setSelected(p => Math.min(imageFiles.length - 1, p + 1)); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [imageFiles, lightbox]);

  if (!projectId) {
    return (
      <div className="empty-state">
        <ImageIcon size={64} />
        <h3 style={{ color: "var(--text-secondary)" }}>Proje seçilmedi</h3>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Dashboard&apos;dan bir proje seçin</p>
        <Link href="/" className="btn btn-primary">Dashboard&apos;a Dön</Link>
      </div>
    );
  }

  if (loading) return <div className="empty-state"><Loader2 size={32} className="pulse" /></div>;
  if (!project) return <div className="empty-state"><ImageIcon size={64} /><h3 style={{ color: "var(--text-secondary)" }}>Proje bulunamadı</h3></div>;

  const scene = project.scenes[selected];

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/scenes?project=${projectId}`} className="btn btn-ghost btn-icon">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="page-title">Image Studio</h1>
            <p className="page-subtitle">{imageFiles.length} görsel • {project.scenes.length} sahne</p>
          </div>
        </div>
      </div>

      {imageFiles.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <ImageIcon size={48} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 12, color: "var(--text-muted)" }}>
            Görseller henüz üretilmedi. Pipeline&apos;ı çalıştırın.
          </p>
          <Link href={`/scenes?project=${projectId}`} className="btn btn-secondary" style={{ marginTop: 12 }}>
            <Film size={14} /> Sahneler&apos;e Dön
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
          {/* Main Image Display */}
          <div>
            {/* Large Preview */}
            <div className="glass-card" style={{ padding: 12, marginBottom: 16 }}>
              <div style={{
                width: "100%",
                aspectRatio: project.contentType === "ekran" ? "16/9" : "9/16",
                maxHeight: 500,
                background: "#000",
                borderRadius: 8,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                cursor: "zoom-in",
              }}
                onClick={() => imageFiles[selected] && setLightbox(imageFiles[selected])}
              >
                <img
                  src={imageFiles[selected]}
                  alt={`Sahne ${selected + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                  <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); setLightbox(imageFiles[selected]); }} style={{ background: "rgba(0,0,0,0.5)", borderRadius: "50%", width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ZoomIn size={14} style={{ color: "#fff" }} />
                  </button>
                </div>
                {/* Navigation arrows */}
                {selected > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); setSelected(selected - 1); }} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <ChevronLeft size={18} style={{ color: "#fff" }} />
                  </button>
                )}
                {selected < imageFiles.length - 1 && (
                  <button onClick={(e) => { e.stopPropagation(); setSelected(selected + 1); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <ChevronRight size={18} style={{ color: "#fff" }} />
                  </button>
                )}
              </div>
              {/* Info bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px 0" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Sahne {selected + 1} / {imageFiles.length}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={imageFiles[selected]} download className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }}>
                    <Download size={13} /> İndir
                  </a>
                </div>
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6 }}>
              {imageFiles.map((imgSrc, i) => (
                <div
                  key={imgSrc}
                  onClick={() => setSelected(i)}
                  style={{
                    cursor: "pointer",
                    borderRadius: 6,
                    overflow: "hidden",
                    border: i === selected ? "2px solid var(--accent-blue)" : "2px solid transparent",
                    opacity: i === selected ? 1 : 0.7,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ width: "100%", height: 60, background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <img
                      src={imgSrc}
                      alt={`S${i + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onLoad={() => setLoadedImages((prev) => ({ ...prev, [i]: true }))}
                    />
                    {!loadedImages[i] && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ImageIcon size={14} style={{ opacity: 0.15 }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Scene Info */}
          <div>
            {scene && (
              <div className="glass-card" style={{ padding: 20 }}>
                <div className="section-title" style={{ fontSize: 14, marginBottom: 16 }}>Sahne Bilgisi</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
                  <div>
                    <span className="label">🤖 Referans Poz</span>
                    <div className="input">{scene.molo_pose}</div>
                  </div>
                  <div>
                    <span className="label">📸 Ortam</span>
                    <div className="input">{scene.environment}</div>
                  </div>
                  <div>
                    <span className="label">📐 Shot</span>
                    <div className="input">{scene.shot_type}</div>
                  </div>
                  <div>
                    <span className="label">💭 Duygu</span>
                    <div className="input">{scene.emotion_note}</div>
                  </div>
                  <div className="divider" />
                  <div>
                    <span className="label">🇩🇪 Metin (DE)</span>
                    <div className="input" style={{ fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {scene.text_de || (scene as unknown as Record<string, string>).text || "—"}
                    </div>
                  </div>
                  {scene.text_tr && (
                    <div>
                      <span className="label">🇹🇷 Metin (TR)</span>
                      <div className="input" style={{ fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5, fontStyle: "italic" }}>
                        {scene.text_tr}
                      </div>
                    </div>
                  )}
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
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out",
          }}
        >
          <img
            src={lightbox}
            alt="Büyütülmüş görsel"
            style={{ maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain", borderRadius: 8 }}
          />
          {/* Navigation arrows in lightbox */}
          {imageFiles.indexOf(lightbox) > 0 && (
            <button onClick={(e) => { e.stopPropagation(); const idx = imageFiles.indexOf(lightbox); setLightbox(imageFiles[idx - 1]); setSelected(idx - 1); }} style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <ChevronLeft size={24} style={{ color: "#fff" }} />
            </button>
          )}
          {imageFiles.indexOf(lightbox) < imageFiles.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); const idx = imageFiles.indexOf(lightbox); setLightbox(imageFiles[idx + 1]); setSelected(idx + 1); }} style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <ChevronRight size={24} style={{ color: "#fff" }} />
            </button>
          )}
          <div style={{ position: "absolute", bottom: 20, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
            {imageFiles.indexOf(lightbox) + 1} / {imageFiles.length} — ESC ile kapat, ← → ile gezin
          </div>
        </div>
      )}
    </>
  );
}

export default function ImagesPage() {
  return (
    <Suspense fallback={<div className="empty-state"><Loader2 size={32} className="pulse" /></div>}>
      <ImagesContent />
    </Suspense>
  );
}
