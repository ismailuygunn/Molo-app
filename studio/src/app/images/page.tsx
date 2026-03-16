"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Download, Check, ImageIcon, Loader2, ZoomIn } from "lucide-react";
import type { Project } from "@/store/studio";

function ImagesContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!projectId) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        const p = data.find((x) => x.id === projectId);
        if (p) setProject(p);
        setLoading(false);
      });
    // Fetch real image files
    fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
      .then((r) => r.json())
      .then((data) => {
        setImageFiles(data.scenes_images || []);
      });
  }, [projectId]);

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

  if (loading) {
    return <div className="empty-state"><Loader2 size={32} className="pulse" /></div>;
  }

  if (!project) {
    return (
      <div className="empty-state">
        <ImageIcon size={64} />
        <h3 style={{ color: "var(--text-secondary)" }}>Proje bulunamadı</h3>
      </div>
    );
  }

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
        </div>
      ) : (
        <>
          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            {imageFiles.map((imgSrc, i) => (
              <div
                key={imgSrc}
                className={`glass-card`}
                onClick={() => setSelected(i)}
                style={{
                  cursor: "pointer",
                  padding: 0,
                  overflow: "hidden",
                  borderColor: i === selected ? "var(--accent-blue)" : undefined,
                }}
              >
                <div style={{ width: "100%", height: 200, background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <img
                    src={imgSrc}
                    alt={`Sahne ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onLoad={() => setLoadedImages((prev) => ({ ...prev, [i]: true }))}
                  />
                  {!loadedImages[i] && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ImageIcon size={24} style={{ opacity: 0.15 }} />
                    </div>
                  )}
                </div>
                <div style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Sahne {i + 1}</span>
                  <Check size={14} style={{ color: "var(--accent-green)" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Detay */}
          {scene && (
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Sahne {selected + 1} Detay</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" style={{ fontSize: 12 }}>
                    <ZoomIn size={14} /> Büyüt
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 12 }}>
                    <RefreshCw size={14} /> Yeniden Üret
                  </button>
                  <a href={imageFiles[selected]} download className="btn btn-secondary" style={{ fontSize: 12 }}>
                    <Download size={14} /> İndir
                  </a>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                <div><span className="label">Referans</span><div className="input">{scene.molo_pose}</div></div>
                <div><span className="label">Ortam</span><div className="input">{scene.environment}</div></div>
                <div><span className="label">Shot</span><div className="input">{scene.shot_type}</div></div>
                <div><span className="label">Duygu</span><div className="input">{scene.emotion_note}</div></div>
              </div>
              {/* Metinler */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <span className="label">🇩🇪 Metin (DE)</span>
                  <div className="input" style={{ fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {scene.text_de || (scene as unknown as Record<string, string>).text || "—"}
                  </div>
                </div>
                <div>
                  <span className="label">🇹🇷 Metin (TR)</span>
                  <div className="input" style={{ fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5, color: scene.text_tr ? "var(--text-secondary)" : "var(--text-muted)", fontStyle: scene.text_tr ? "normal" : "italic" }}>
                    {scene.text_tr || "Çeviri bekleniyor..."}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
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
