import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, readFile, rm } from "fs/promises";
import { join, resolve } from "path";

export const dynamic = "force-dynamic";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

export async function GET() {
  try {
    const entries = await readdir(PROJECTS_DIR);
    const projects = [];

    for (const entry of entries) {
      // ═══ Per-project try-catch — one bad project never breaks the API ═══
      try {
        const projectPath = join(PROJECTS_DIR, entry);
        const s = await stat(projectPath);
        if (!s.isDirectory()) continue;

        const nameParts = entry.split("_");
        const date = nameParts[0] || entry;
        const name = nameParts.slice(1).join("_") || entry;

        // URI-encode for paths with special characters (ü, ä, emoji etc.)
        const enc = encodeURIComponent(entry);

        // ── Brief ──
        let brief = "";
        let contentType = "sosyal";
        let lang = "de";
        let title = name;

        try {
          brief = await readFile(join(projectPath, "brief.md"), "utf-8");
          const contentMarkers = ["içerik türü:", "İçerik türü:", "icerik turu:", "content type:", "tür:"];
          const langMap: Record<string, string> = {
            "de": "de", "deutsch": "de", "almanca": "de", "german": "de", "🇩🇪": "de",
            "tr": "tr", "türkçe": "tr", "turkish": "tr", "🇹🇷": "tr",
            "en": "en", "english": "en", "ingilizce": "en", "🇬🇧": "en", "🇺🇸": "en",
          };
          for (const line of brief.split("\n")) {
            const stripped = line.trim();
            const ll = stripped.toLowerCase();
            if (contentMarkers.some(m => ll.includes(m.toLowerCase()) || stripped.includes(m))) {
              const val = stripped.split(":").slice(1).join(":").trim().toLowerCase();
              if (["sosyal", "ekran", "robot"].includes(val)) contentType = val;
            }
            if (ll.includes("dil:") || ll.includes("language:")) {
              const raw = stripped.split(":").slice(1).join(":").trim().toLowerCase();
              for (const [key, code] of Object.entries(langMap)) {
                if (raw.includes(key)) { lang = code; break; }
              }
            }
            if (ll.includes("konu:") || ll.includes("title:") || ll.includes("başlık:")) {
              title = line.split(":").slice(1).join(":").trim() || name;
            }
            if (title === name && line.trim().startsWith("#") && !line.trim().startsWith("##")) {
              const hdr = line.replace(/^#+\s*/, "").replace(/[🎬🎤📸🤖💡🔤📋]/g, "").trim();
              title = hdr.replace(/^Molo\s*[—\-]\s*/i, "").trim() || name;
            }
          }
        } catch { /* no brief */ }

        // ── Scenes ──
        let scenes: Record<string, unknown>[] = [];
        let durations: number[] = [];
        try {
          const raw = JSON.parse(await readFile(join(projectPath, "scenes", "scenes.json"), "utf-8"));
          const arr = Array.isArray(raw) ? raw : (raw.scenes || []);
          durations = Array.isArray(raw) ? [] : (raw.durations || []);
          scenes = arr.map((s: Record<string, unknown>) => ({
            scene: s.scene || 0,
            text_de: s.text_de || s.text || "",
            text_tr: s.text_tr || "",
            voice_direction: s.voice_direction || "neutral",
            shot_type: s.shot_type || "medium",
            emotion_note: s.emotion_note || "",
            environment: s.environment || "clinic",
            molo_pose: s.molo_pose || s.reference_image || "front",
          }));
        } catch { /* no scenes */ }

        // ── Status — smart scan for any MP4/thumbnail ──
        let status = "draft";
        let finalPath = "";
        let draftPath = "";
        let thumbnailPath = "";

        // Scan final/ directory
        try {
          const finalFiles = await readdir(join(projectPath, "final"));
          const mp4 = finalFiles.find(f => f.endsWith("_final.mp4")) || finalFiles.find(f => f.endsWith(".mp4"));
          if (mp4) {
            status = "final";
            finalPath = `/api/files/${enc}/final/${encodeURIComponent(mp4)}`;
          }
          const thumb = finalFiles.find(f => f.includes("thumbnail")) || finalFiles.find(f => f.includes("thumb"));
          if (thumb) {
            thumbnailPath = `/api/files/${enc}/final/${encodeURIComponent(thumb)}`;
          }
        } catch { /* no final dir */ }

        // Scan draft/ if no final
        if (status !== "final") {
          try {
            const draftFiles = await readdir(join(projectPath, "draft"));
            const mp4 = draftFiles.find(f => f.endsWith(".mp4"));
            if (mp4) {
              status = "review";
              draftPath = `/api/files/${enc}/draft/${encodeURIComponent(mp4)}`;
            }
          } catch { /* no draft dir */ }
        }

        // Fallback thumbnail: first scene ref image
        if (!thumbnailPath) {
          try {
            const sFiles = await readdir(join(projectPath, "scenes"));
            const ref = sFiles.filter(f => f.endsWith("_ref.png") || f.endsWith("_ref.jpg")).sort()[0];
            if (ref) thumbnailPath = `/api/files/${enc}/scenes/${ref}`;
          } catch { /* no scenes dir */ }
        }

        // ── Pipeline status ──
        let pipelineStep = status === "final" ? "done" : "idle";
        let pipelineProgress = status === "final" ? 100 : 0;
        try {
          const pd = JSON.parse(await readFile(join(projectPath, "progress.json"), "utf-8"));
          pipelineStep = pd.step || pipelineStep;
          pipelineProgress = pd.progress ?? pipelineProgress;
        } catch { /* no progress */ }

        projects.push({
          id: entry, name, date, status, contentType, lang, brief, title,
          scenes, durations, pipelineStep, pipelineProgress,
          thumbnailPath, finalPath, draftPath,
        });
      } catch (err) {
        // Log but don't crash — skip this project
        console.error(`Project scan error for "${entry}":`, err);
      }
    }

    projects.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Projects scan error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let projectId = url.searchParams.get("id");
    if (!projectId) {
      try { const body = await req.json(); projectId = body.projectId; } catch { /* no body */ }
    }
    if (!projectId) {
      return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const resolved = resolve(projectDir);
    if (!resolved.startsWith(resolve(PROJECTS_DIR))) {
      return NextResponse.json({ error: "Geçersiz proje" }, { status: 403 });
    }

    try { await stat(projectDir); } catch {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }

    await rm(projectDir, { recursive: true, force: true });
    return NextResponse.json({ message: "Proje silindi", projectId });
  } catch (error) {
    console.error("Project delete error:", error);
    return NextResponse.json({ error: "Proje silinemedi" }, { status: 500 });
  }
}
