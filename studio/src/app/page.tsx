"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Film,
  Clock,
  Zap,
  TrendingUp,
  Monitor,
  Smartphone,
  Bot,
  Trash2,
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

  return (
    <div className="glass-card project-card" style={{ position: "relative" }}>
      <Link href={`/scenes?project=${project.id}`} style={{ textDecoration: "none" }}>
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
            }}
          >
            <Film size={40} style={{ opacity: 0.2 }} />
          </div>
        )}
        <div className="project-info">
          <div className="project-name">{project.title || project.name}</div>
          <div className="project-meta">
            <span className={`badge ${project.status}`}>{project.status}</span>
            <ContentIcon size={14} />
            <span>{CONTENT_LABELS[project.contentType]}</span>
            <span>•</span>
            <span>{project.date}</span>
          </div>
          {project.scenes.length > 0 && (
            <div className="project-meta" style={{ marginTop: 6 }}>
              <Film size={12} />
              <span>{project.scenes.length} sahne</span>
              {project.durations.length > 0 && (
                <>
                  <Clock size={12} />
                  <span>
                    {project.durations.reduce((a, b) => a + b, 0).toFixed(1)}s
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </Link>
      <button
        className="btn btn-icon btn-ghost"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(project.id); }}
        style={{ position: "absolute", top: 8, right: 8, opacity: 0.4, transition: "opacity 0.2s" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
        title="Projeyi sil"
      >
        <Trash2 size={14} />
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
          <div className="pulse" style={{ fontSize: 14, color: "var(--text-muted)" }}>
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
            İlk projenizi oluşturmak için "Yeni Proje" butonuna tıklayın
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
