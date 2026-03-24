"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Pause, Loader2, Volume2, Mic2, Film, SkipForward, SkipBack, Clock } from "lucide-react";
import { MoloLoading } from "@/components/molo";
import type { Project } from "@/store/studio";

function VoiceContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setAudioFiles(data.audio || []);
      });
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const togglePlay = (index: number) => {
    if (playing === index) {
      audioRef.current?.pause();
      setPlaying(null);
      if (progressTimer.current) clearInterval(progressTimer.current);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      if (progressTimer.current) clearInterval(progressTimer.current);
    }

    const file = audioFiles[index];
    if (file) {
      const audio = new Audio(file);
      audio.onended = () => {
        setPlaying(null);
        setProgress(p => ({ ...p, [index]: 100 }));
        if (progressTimer.current) clearInterval(progressTimer.current);
      };
      audio.play();
      audioRef.current = audio;
      setPlaying(index);

      progressTimer.current = setInterval(() => {
        if (audio.duration) {
          setProgress(p => ({ ...p, [index]: (audio.currentTime / audio.duration) * 100 }));
        }
      }, 100);
    }
  };

  const playAll = () => {
    if (audioFiles.length === 0) return;
    let current = 0;

    const playNext = () => {
      if (current >= audioFiles.length) {
        setPlaying(null);
        return;
      }
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(audioFiles[current]);
      const idx = current;
      audio.onended = () => {
        current++;
        setProgress(p => ({ ...p, [idx]: 100 }));
        playNext();
      };
      audio.play();
      audioRef.current = audio;
      setPlaying(idx);

      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = setInterval(() => {
        if (audio.duration) {
          setProgress(p => ({ ...p, [idx]: (audio.currentTime / audio.duration) * 100 }));
        }
      }, 100);
    };

    playNext();
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

  if (loading) return <div className="empty-state"><MoloLoading text="Ses dosyaları yükleniyor..." /></div>;
  if (!project) return <div className="empty-state"><Mic2 size={64} /><h3 style={{ color: "var(--text-secondary)" }}>Proje bulunamadı</h3><Link href="/" className="btn btn-primary" style={{ marginTop: 12 }}>Dashboard</Link></div>;

  const totalDuration = project.durations.reduce((a, b) => a + b, 0);

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
        {audioFiles.length > 0 && (
          <button className="btn btn-primary" onClick={playAll}>
            <Play size={16} /> Tümünü Oynat
          </button>
        )}
      </div>

      {/* Duration summary */}
      {totalDuration > 0 && (
        <div className="glass-card" style={{ padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Clock size={16} style={{ color: "var(--accent-cyan)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Toplam Süre</span>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <span style={{ color: "var(--text-secondary)" }}>{totalDuration.toFixed(1)}s ham</span>
            <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>~{(totalDuration / 0.88).toFixed(1)}s slow</span>
          </div>
        </div>
      )}

      {audioFiles.length === 0 && project.scenes.length > 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <Mic2 size={48} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 12, color: "var(--text-muted)" }}>
            Ses dosyaları henüz üretilmedi. Pipeline&apos;ı çalıştırın.
          </p>
          <Link href={`/scenes?project=${projectId}`} className="btn btn-secondary" style={{ marginTop: 12 }}>
            <Film size={14} /> Sahneler&apos;e Dön
          </Link>
        </div>
      ) : null}

      <div style={{ maxWidth: 800, display: "flex", flexDirection: "column", gap: 10 }}>
        {project.scenes.map((scene, i) => {
          const hasAudio = i < audioFiles.length;
          const isPlaying = playing === i;
          const pct = progress[i] || 0;
          return (
            <div key={scene.scene} className="glass-card" style={{ padding: 14, borderColor: isPlaying ? "var(--accent-teal)" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  className="btn btn-icon btn-secondary"
                  onClick={() => hasAudio && togglePlay(i)}
                  disabled={!hasAudio}
                  style={{
                    opacity: hasAudio ? 1 : 0.3,
                    width: 38, height: 38, padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isPlaying ? "rgba(20,184,166,0.15)" : undefined,
                  }}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Sahne {scene.scene}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className="badge draft" style={{ fontSize: 10 }}>{scene.voice_direction}</span>
                      {project.durations[i] !== undefined && project.durations[i] > 0 && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-geist-mono)" }}>
                          {project.durations[i].toFixed(1)}s
                        </span>
                      )}
                      {!hasAudio && (
                        <span style={{ fontSize: 10, color: "var(--accent-amber)", background: "rgba(245,158,11,0.1)", padding: "1px 6px", borderRadius: 6 }}>
                          ⏳ Bekleniyor
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{
                    height: 4, borderRadius: 2, overflow: "hidden",
                    background: "var(--bg-elevated)", marginBottom: 6,
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${isPlaying ? pct : (hasAudio ? 100 : 0)}%`,
                      background: isPlaying
                        ? "linear-gradient(90deg, var(--accent-teal), var(--accent-cyan, #06b6d4))"
                        : hasAudio ? "rgba(20,184,166,0.3)" : "transparent",
                      transition: isPlaying ? "width 0.1s linear" : "width 0.3s ease",
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
        </div>
      </div>
    </>
  );
}

export default function VoicePage() {
  return (
    <Suspense fallback={<div className="empty-state"><MoloLoading text="Yükleniyor..." /></div>}>
      <VoiceContent />
    </Suspense>
  );
}
