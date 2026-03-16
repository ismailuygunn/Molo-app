"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  LayoutDashboard,
  FileText,
  Film,
  Mic2,
  ImageIcon,
  Video,
  Scissors,
  Settings,
} from "lucide-react";

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

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">M</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          
          // Build href with project query param if needed and available
          const href = item.needsProject && projectId
            ? `${item.href}?project=${encodeURIComponent(projectId)}`
            : item.href;

          // Dim items that need a project but none is selected
          const isDisabled = item.needsProject && !projectId;

          return (
            <Link
              key={item.href}
              href={href}
              className={`sidebar-item ${isActive ? "active" : ""} ${isDisabled ? "disabled" : ""}`}
              data-tooltip={item.label}
              style={isDisabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}
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
        <div className="sidebar-logo">M</div>
        <nav className="sidebar-nav" />
      </aside>
    }>
      <SidebarContent />
    </Suspense>
  );
}
