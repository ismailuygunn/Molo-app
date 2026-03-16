"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Pause, RefreshCw, Loader2, Volume2, Mic2 } from "lucide-react";
import type { Project } from "@/store/studio";

function VoiceContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!projectId) return;
    // Fetch project
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        const p = data.find((x) => x.id === projectId);
        if (p) setProject(p);
        setLoading(false);
      });
    // Fetch audio files
    fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
      .then((r) => r.json())
      .then((data) => {
        setAudioFiles(data.audio || []);
      });
  }, [projectId]);

  const togglePlay = (index: number) => {
    if (playing === index) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const file = audioFiles[index];
      if (file) {
        const audio = new Audio(file);
        audio.onended = () => setPlaying(null);
        audio.play();
        audioRef.current = audio;
        setPlaying(index);
      }
    }
  };

  if (!projectId) {
    return (
      <div className="empty-state">
        <Mic2 size={64} />
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
        <Mic2 size={64} />
        <h3 style={{ color: "var(--text-secondary)" }}>Proje bulunamadı</h3>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 12 }}>Dashboard</Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/scenes?project=${projectId}`} className="btn btn-ghost btn-icon">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="page-title">Voice Lab</h1>
            <p className="page-subtitle">{project.scenes.length} sahne • {audioFiles.length} ses dosyası • {project.lang.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {audioFiles.length === 0 && project.scenes.length > 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <Mic2 size={48} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 12, color: "var(--text-muted)" }}>
            Ses dosyaları henüz üretilmedi. Pipeline&apos;ı çalıştırın.
          </p>
        </div>
      ) : null}

      <div style={{ maxWidth: 800, display: "flex", flexDirection: "column", gap: 12 }}>
        {project.scenes.map((scene, i) => {
          const hasAudio = i < audioFiles.length;
          return (
            <div key={scene.scene} className="glass-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  className="btn btn-icon btn-secondary"
                  onClick={() => hasAudio && togglePlay(i)}
                  disabled={!hasAudio}
                  style={{ opacity: hasAudio ? 1 : 0.3 }}
                >
                  {playing === i ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Sahne {scene.scene}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className="badge draft" style={{ fontSize: 10 }}>{scene.voice_direction}</span>
                      {project.durations[i] !== undefined && project.durations[i] > 0 && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {project.durations[i].toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Real waveform indicator */}
                  <div style={{
                    height: 24, borderRadius: 4, overflow: "hidden",
                    background: playing === i
                      ? "linear-gradient(90deg, var(--accent-blue), var(--accent-purple))"
                      : "var(--bg-elevated)",
                    opacity: hasAudio ? (playing === i ? 0.6 : 0.3) : 0.1,
                    transition: "all 0.3s ease",
                  }} />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    &quot;{(scene.text_de || (scene as unknown as Record<string, string>).text || "").slice(0, 80)}{(scene.text_de || "").length > 80 ? "..." : ""}&quot;
                  </div>
                  {scene.text_tr && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>
                      🇹🇷 {scene.text_tr.slice(0, 60)}{scene.text_tr.length > 60 ? "..." : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Gelişmiş Ayarlar */}
        <div className="divider" />
        <div className="glass-card" style={{ padding: 20 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>
            <Volume2 size={18} /> Gelişmiş Ayarlar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="label">Slowdown</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="range" className="slider" min="80" max="100" defaultValue="88" />
                <span style={{ fontSize: 13, fontFamily: "var(--font-geist-mono)", color: "var(--text-secondary)" }}>0.88x</span>
              </div>
            </div>
            <div>
              <label className="label">Ses Profili</label>
              <select className="input select" defaultValue="molo-de-v2">
                <option value="molo-de-v2">Molo DE v2</option>
                <option value="molo-tr">Molo TR</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
            Toplam: {project.durations.reduce((a, b) => a + b, 0).toFixed(1)}s → Slowdown sonrası: ~{(project.durations.reduce((a, b) => a + b, 0) / 0.88).toFixed(1)}s
          </div>
        </div>
      </div>
    </>
  );
}

export default function VoicePage() {
  return (
    <Suspense fallback={<div className="empty-state"><Loader2 size={32} className="pulse" /></div>}>
      <VoiceContent />
    </Suspense>
  );
}
