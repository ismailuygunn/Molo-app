"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Film,
  Clock,
  TrendingUp,
  Monitor,
  Smartphone,
  Bot,
  Trash2,
  Mic2,
  ImageIcon,
  Scissors,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  FolderOpen,
} from "lucide-react";
import type { Project, ContentType } from "@/store/studio";
import { useToast } from "@/components/toast";

const CONTENT_ICONS: Record<ContentType, typeof Film> = {
  sosyal: Smartphone,
  ekran: Monitor,
  robot: Bot,
};

const CONTENT_LABELS: Record<ContentType, string> = {
  sosyal: "Sosyal Medya",
  ekran: "Klinik Ekranı",
  robot: "Robot",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Film }> = {
  draft: { label: "Taslak", color: "var(--accent-amber)", icon: Film },
  review: { label: "İnceleme", color: "var(--accent-blue)", icon: Eye },
  final: { label: "Tamamlandı", color: "var(--accent-green)", icon: CheckCircle2 },
  error: { label: "Hata", color: "var(--accent-red)", icon: XCircle },
};

function StatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail?: string;
  accent: string;
}) {
  return (
    <div className={`glass-card stat-card ${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: (id: string) => void }) {
  const ContentIcon = CONTENT_ICONS[project.contentType] || Film;
  const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const projectUrl = `/scenes?project=${project.id}`;
  const totalDuration = project.durations.reduce((a, b) => a + b, 0);

  return (
    <div className="glass-card project-card" style={{ position: "relative", overflow: "hidden" }}>
      {/* Thumbnail */}
      <Link href={projectUrl} style={{ textDecoration: "none" }}>
        {project.thumbnailPath ? (
          <img
            src={project.thumbnailPath}
            alt={project.name}
            className="project-thumb"
          />
        ) : (
          <div
            className="project-thumb"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))",
            }}
          >
            <Film size={36} style={{ opacity: 0.15 }} />
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="project-info" style={{ padding: "12px 14px" }}>
        <Link href={projectUrl} style={{ textDecoration: "none" }}>
          <div className="project-name" style={{ marginBottom: 6 }}>{project.title || project.name}</div>
        </Link>

        {/* Status + Content Type Row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, padding: "2px 8px", borderRadius: 10,
            background: `color-mix(in srgb, ${statusCfg.color} 12%, transparent)`,
            color: statusCfg.color, fontWeight: 600,
          }}>
            <StatusIcon size={11} />
            {statusCfg.label}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
            <ContentIcon size={12} /> {CONTENT_LABELS[project.contentType]}
          </span>
        </div>

        {/* Stats Row */}
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
          {project.scenes.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Film size={11} /> {project.scenes.length} sahne
            </span>
          )}
          {totalDuration > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={11} /> {totalDuration.toFixed(1)}s
            </span>
          )}
          <span>{project.date}</span>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
          <Link href={`/scenes?project=${project.id}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }}>
            <FolderOpen size={12} /> Sahneler
          </Link>
          <Link href={`/images?project=${project.id}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }}>
            <ImageIcon size={12} /> Görseller
          </Link>
          <Link href={`/voice?project=${project.id}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }}>
            <Mic2 size={12} /> Ses
          </Link>
          <Link href={`/video?project=${project.id}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }}>
            <Play size={12} /> Video
          </Link>
          <Link href={`/edit?project=${project.id}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }}>
            <Scissors size={12} /> Kurgu
          </Link>
        </div>
      </div>

      {/* Delete */}
      <button
        className="btn btn-icon btn-ghost"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(project.id); }}
        style={{ position: "absolute", top: 8, right: 8, opacity: 0.3, transition: "opacity 0.2s", background: "rgba(0,0,0,0.3)", borderRadius: "50%", width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.3")}
        title="Projeyi sil"
      >
        <Trash2 size={13} style={{ color: "#fff" }} />
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchProjects = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Bu projeyi silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        toast.success("Proje silindi");
      } else {
        toast.error("Proje silinemedi");
      }
    } catch {
      toast.error("Proje silinirken hata oluştu");
    }
  };

  const totalVideos = projects.filter((p) => p.status === "final").length;
  const totalScenes = projects.reduce((a, p) => a + p.scenes.length, 0);
  const totalDuration = projects.reduce(
    (a, p) => a + p.durations.reduce((x, y) => x + y, 0),
    0
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">MOLO Studio</h1>
          <p className="page-subtitle">İSTADENTAL İçerik Üretim Platformu</p>
        </div>
        <Link href="/brief" className="btn btn-primary">
          <Plus size={18} />
          Yeni Proje
        </Link>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          label="Toplam Video"
          value={String(totalVideos)}
          detail={`${projects.length} proje`}
          accent="blue"
        />
        <StatCard
          label="Toplam Sahne"
          value={String(totalScenes)}
          detail="Kling v3 ile üretildi"
          accent="purple"
        />
        <StatCard
          label="Toplam Süre"
          value={`${(totalDuration / 60).toFixed(1)}m`}
          detail={`${totalDuration.toFixed(0)} saniye`}
          accent="cyan"
        />
        <StatCard
          label="İçerik Türleri"
          value={String(new Set(projects.map((p) => p.contentType)).size)}
          detail="sosyal / ekran / robot"
          accent="green"
        />
      </div>

      {/* Projects */}
      <div className="section-title">
        <TrendingUp size={20} />
        Son Projeler
      </div>

      {loading ? (
        <div className="empty-state">
          <Loader2 size={32} className="pulse" />
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 12 }}>
            Projeler yükleniyor...
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <Film size={64} />
          <h3 style={{ marginBottom: 8, color: "var(--text-secondary)" }}>
            Henüz proje yok
          </h3>
          <p style={{ marginBottom: 20 }}>
            İlk projenizi oluşturmak için &quot;Yeni Proje&quot; butonuna tıklayın
          </p>
          <Link href="/brief" className="btn btn-primary">
            <Plus size={18} />
            İlk Projeyi Oluştur
          </Link>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <Link href="/brief" className="fab" aria-label="Yeni Proje">
        <Plus size={24} />
      </Link>
    </>
  );
}
