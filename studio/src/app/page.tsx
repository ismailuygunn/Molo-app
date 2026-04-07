"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Film,
  Clock,
  TrendingUp,
  Monitor,
  Smartphone,
  Bot,
  Trash2,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  FolderOpen,
} from "lucide-react";
import type { Project, ContentType } from "@/store/studio";
import { useToast } from "@/components/toast";
import { Card, Badge, EmptyState, Progress } from "@/components/ui";
import { MoloFloat, MoloReaction } from "@/components/molo";

/* ─── Content type config ─── */

const CONTENT_ICONS: Partial<Record<ContentType, typeof Film>> = {
  sosyal: Smartphone,
  ekran: Monitor,
  robot: Bot,
};

const CONTENT_LABELS: Partial<Record<ContentType, string>> = {
  sosyal: "Sosyal Medya",
  ekran: "Klinik Ekrani",
  robot: "Robot",
  greenscreen: "Green Screen",
  "greenscreen-yatay": "GS Yatay",
  "greenscreen-kare": "GS Kare",
};

/* ─── Status config ─── */

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "draft" | "review" | "final" | "error"; icon: typeof Film }
> = {
  draft: { label: "Taslak", variant: "draft", icon: Film },
  review: { label: "Inceleme", variant: "review", icon: Eye },
  final: { label: "Tamamlandi", variant: "final", icon: CheckCircle2 },
  error: { label: "Hata", variant: "error", icon: XCircle },
};

/* ─── Pipeline step progress mapping ─── */

const PIPELINE_PROGRESS: Record<string, number> = {
  idle: 0,
  script: 15,
  images: 40,
  image_review: 50,
  voice: 75,
  done: 100,
  error: 0,
};

/* ─── Stat Card ─── */

function StatCard({
  label,
  value,
  detail,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  accent: "teal" | "coral" | "blue" | "purple" | "green" | "amber";
  icon: typeof Film;
}) {
  return (
    <Card accent={accent} hover={false}>
      <div style={{ padding: "20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon size={16} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            {label}
          </span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
          {value}
        </div>
        {detail && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
            {detail}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─── Project Card ─── */

function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (id: string) => void;
}) {
  const ContentIcon = CONTENT_ICONS[project.contentType] || Film;
  const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const projectUrl = `/scenes?project=${project.id}`;
  const totalDuration = project.durations.reduce((a, b) => a + b, 0);
  const progressValue =
    project.pipelineProgress ?? PIPELINE_PROGRESS[project.pipelineStep] ?? 0;
  const isCompleted = project.status === "final";

  return (
    <Card hover className="project-card" accent={isCompleted ? "green" : undefined}>
      <div style={{ position: "relative", overflow: "hidden" }}>
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
                background:
                  "linear-gradient(135deg, rgba(20,184,166,0.08), rgba(251,146,60,0.08))",
              }}
            >
              <Film size={36} style={{ opacity: 0.15 }} />
            </div>
          )}
        </Link>

        {/* Completed badge with MoloReaction */}
        {isCompleted && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(255,255,255,0.92)",
              borderRadius: 12,
              padding: "2px 8px 2px 4px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }}
          >
            <MoloReaction mood="happy" size={20} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent-green)" }}>
              Tamam
            </span>
          </div>
        )}

        {/* Delete */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(project.id);
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            opacity: 0.3,
            transition: "opacity 0.2s",
            background: "rgba(0,0,0,0.3)",
            borderRadius: "50%",
            width: 28,
            height: 28,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.3")}
          title="Projeyi sil"
          aria-label="Projeyi sil"
        >
          <Trash2 size={13} style={{ color: "#fff" }} />
        </button>
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px" }}>
        <Link href={projectUrl} style={{ textDecoration: "none" }}>
          <div className="project-name" style={{ marginBottom: 6 }}>
            {project.title || project.name}
          </div>
        </Link>

        {/* Status + Content Type Row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Badge variant={statusCfg.variant} pulse={project.status === "review"}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <StatusIcon size={11} />
              {statusCfg.label}
            </span>
          </Badge>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <ContentIcon size={12} /> {CONTENT_LABELS[project.contentType]}
          </span>
        </div>

        {/* Pipeline Progress */}
        {progressValue > 0 && progressValue < 100 && (
          <div style={{ marginBottom: 8 }}>
            <Progress value={progressValue} showMolo color="teal" />
          </div>
        )}

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
          <Link
            href={`/scenes?project=${project.id}`}
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "4px 8px" }}
          >
            <FolderOpen size={12} /> Sahneler
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ─── Dashboard Page ─── */

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const router = useRouter();

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
    if (!confirm("Bu projeyi silmek istediginize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        toast.success("Proje silindi");
      } else {
        toast.error("Proje silinemedi");
      }
    } catch {
      toast.error("Proje silinirken hata olustu");
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
      {/* Floating Molo background decoration */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <MoloFloat opacity={0.06} size={200} />
      </div>

      {/* Page Header */}
      <div className="page-header" style={{ position: "relative", zIndex: 1 }}>
        <div>
          <h1 className="page-title">MOLO Studio</h1>
          <p className="page-subtitle">ISTADENTAL Icerik Uretim Platformu</p>
        </div>
        <Link
          href="/brief"
          className="btn btn-primary"
          style={{
            background: "linear-gradient(135deg, var(--accent-teal), var(--accent-cyan, #06b6d4))",
            border: "none",
          }}
        >
          <Plus size={18} />
          Yeni Proje
        </Link>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ position: "relative", zIndex: 1 }}>
        <StatCard
          label="Toplam Proje"
          value={String(projects.length)}
          detail={`${totalVideos} tamamlandi`}
          accent="teal"
          icon={Film}
        />
        <StatCard
          label="Toplam Sahne"
          value={String(totalScenes)}
          detail="Gemini ile uretildi"
          accent="purple"
          icon={TrendingUp}
        />
        <StatCard
          label="Toplam Sure"
          value={`${(totalDuration / 60).toFixed(1)}m`}
          detail={`${totalDuration.toFixed(0)} saniye`}
          accent="coral"
          icon={Clock}
        />
        <StatCard
          label="Icerik Turleri"
          value={String(new Set(projects.map((p) => p.contentType)).size)}
          detail="sosyal / ekran / robot"
          accent="green"
          icon={Monitor}
        />
      </div>

      {/* Projects */}
      <div className="section-title" style={{ position: "relative", zIndex: 1 }}>
        <TrendingUp size={20} />
        Son Projeler
      </div>

      {loading ? (
        <div className="empty-state">
          <Loader2 size={32} className="pulse" />
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 12 }}>
            Projeler yukleniyor...
          </div>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="Henuz proje yok!"
          description="Hadi ilk icerigini olusturalim"
          action={{
            label: "Yeni Proje",
            onClick: () => router.push("/brief"),
          }}
        />
      ) : (
        <div className="project-grid" style={{ position: "relative", zIndex: 1 }}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/brief"
        className="fab"
        aria-label="Yeni Proje"
        style={{
          background: "linear-gradient(135deg, var(--accent-teal), var(--accent-cyan, #06b6d4))",
          boxShadow: "0 4px 20px rgba(20,184,166,0.35)",
        }}
      >
        <Plus size={24} />
      </Link>
    </>
  );
}
