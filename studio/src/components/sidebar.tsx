"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  Film,
  Mic2,
  ImageIcon,
  Video,
  Scissors,
  Settings,
  ChevronDown,
  FolderOpen,
} from "lucide-react";

interface SidebarProject {
  id: string;
  name: string;
  title?: string;
}

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", needsProject: false },
  { href: "/brief", icon: FileText, label: "Brief", needsProject: false },
  { href: "/scenes", icon: Film, label: "Sahneler", needsProject: true },
  { href: "/voice", icon: Mic2, label: "Ses", needsProject: true },
  { href: "/images", icon: ImageIcon, label: "Görseller", needsProject: true },
  { href: "/video", icon: Video, label: "Video", needsProject: true },
  { href: "/edit", icon: Scissors, label: "Kurgu", needsProject: true },
  { href: "/settings", icon: Settings, label: "Ayarlar", needsProject: false },
];

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Fetch projects for the dropdown
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.map((p: SidebarProject) => ({ id: p.id, name: p.name, title: p.title })));
      })
      .catch(() => {});
  }, []);

  const activeProject = projects.find(p => p.id === projectId);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" title="Molo Studio">
          <svg viewBox="0 0 32 32" width={22} height={22}>
            <rect x="4" y="8" width="24" height="16" rx="7" fill="#0A1628" />
            <circle cx="12" cy="15.5" r="2.5" fill="#00D4FF" />
            <circle cx="20" cy="15.5" r="2.5" fill="#00D4FF" />
            <path d="M12 20 Q16 24 20 20" fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

      {/* Project Picker */}
      {projectId && activeProject && (
        <div style={{ padding: "0 8px", marginBottom: 8, position: "relative" }}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            style={{
              width: "100%", padding: "6px 4px", borderRadius: 6,
              background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)",
              color: "var(--text-secondary)", fontSize: 10, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, justifyContent: "center",
              textAlign: "center", lineHeight: 1.3,
            }}
            title={activeProject.title || activeProject.name}
          >
            <FolderOpen size={10} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 30 }}>
              {(activeProject.title || activeProject.name).slice(0, 6)}
            </span>
            <ChevronDown size={8} />
          </button>

          {/* Dropdown */}
          {showPicker && (
            <div style={{
              position: "absolute", left: "100%", top: 0, marginLeft: 8,
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              borderRadius: 8, padding: 4, minWidth: 200, zIndex: 100,
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", padding: "4px 8px", marginBottom: 2 }}>
                Proje Seç
              </div>
              {projects.map(p => (
                <Link
                  key={p.id}
                  href={`/scenes?project=${encodeURIComponent(p.id)}`}
                  onClick={() => setShowPicker(false)}
                  style={{
                    display: "block", padding: "6px 10px", borderRadius: 4,
                    fontSize: 12, color: p.id === projectId ? "var(--accent-teal)" : "var(--text-secondary)",
                    textDecoration: "none", fontWeight: p.id === projectId ? 600 : 400,
                    background: p.id === projectId ? "rgba(20,184,166,0.08)" : "transparent",
                  }}
                >
                  {p.title || p.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          
          const href = item.needsProject && projectId
            ? `${item.href}?project=${encodeURIComponent(projectId)}`
            : item.href;

          const isDisabled = item.needsProject && !projectId;

          return (
            <Link
              key={item.href}
              href={isDisabled ? "/" : href}
              className={`sidebar-item ${isActive ? "active" : ""} ${isDisabled ? "disabled" : ""}`}
              data-tooltip={item.label}
              style={isDisabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}
              title={item.label}
            >
              <Icon size={20} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={
      <aside className="sidebar">
        <div className="sidebar-logo" title="Molo Studio">
          <svg viewBox="0 0 32 32" width={22} height={22}>
            <rect x="4" y="8" width="24" height="16" rx="7" fill="#0A1628" />
            <circle cx="12" cy="15.5" r="2.5" fill="#00D4FF" />
            <circle cx="20" cy="15.5" r="2.5" fill="#00D4FF" />
            <path d="M12 20 Q16 24 20 20" fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <nav className="sidebar-nav" />
      </aside>
    }>
      <SidebarContent />
    </Suspense>
  );
}
