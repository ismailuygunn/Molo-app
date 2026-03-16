import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, readFile, rm } from "fs/promises";
import { join, resolve } from "path";

// Force runtime evaluation — project data is read from filesystem
export const dynamic = "force-dynamic";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

export async function GET() {
  try {
    const entries = await readdir(PROJECTS_DIR);
    const projects = [];

    for (const entry of entries) {
      const projectPath = join(PROJECTS_DIR, entry);
      const s = await stat(projectPath);
      if (!s.isDirectory()) continue;

      const nameParts = entry.split("_");
      const date = nameParts[0] || entry;
      const name = nameParts.slice(1).join("_") || entry;

      // Read brief if exists
      let brief = "";
      let contentType = "sosyal";
      let lang = "de";
      let title = name;

      try {
        brief = await readFile(join(projectPath, "brief.md"), "utf-8");
        // Parse content type
        for (const line of brief.split("\n")) {
          const ll = line.toLowerCase().trim();
          if (ll.includes("içerik türü:") || ll.includes("content type:") || ll.includes("tür:")) {
            const val = line.split(":")[1]?.trim().toLowerCase();
            if (["sosyal", "ekran", "robot"].includes(val || "")) contentType = val!;
          }
          if (ll.includes("dil:") || ll.includes("language:")) {
            lang = line.split(":")[1]?.trim().toLowerCase().slice(0, 2) || "de";
          }
          if (ll.includes("konu:") || ll.includes("title:") || ll.includes("başlık:")) {
            title = line.split(":")[1]?.trim() || name;
          }
          // Fallback: use first markdown # header as title
          if (title === name && line.trim().startsWith("#") && !line.trim().startsWith("##")) {
            const headerText = line.replace(/^#+\s*/, "").replace(/[🎬🎤📸🤖💡🔤📋]/g, "").trim();
            // Strip "Molo — " or "Molo - " prefix
            title = headerText.replace(/^Molo\s*[—\-]\s*/i, "").trim() || name;
          }
        }
      } catch {
        // No brief
      }

      // Check scenes.json — supports both array and {scenes:[], durations:[]} formats
      let scenes: Record<string, unknown>[] = [];
      let durations: number[] = [];
      try {
        const scenesData = JSON.parse(
          await readFile(join(projectPath, "scenes", "scenes.json"), "utf-8")
        );
        const rawScenes = Array.isArray(scenesData) ? scenesData : (scenesData.scenes || []);
        durations = Array.isArray(scenesData) ? [] : (scenesData.durations || []);
        // Normalize scene fields
        scenes = rawScenes.map((s: Record<string, unknown>) => ({
          scene: s.scene || 0,
          text_de: s.text_de || s.text || "",
          text_tr: s.text_tr || "",
          voice_direction: s.voice_direction || "neutral",
          shot_type: s.shot_type || "medium",
          emotion_note: s.emotion_note || "",
          environment: s.environment || "clinic",
          molo_pose: s.molo_pose || s.reference_image || "front",
        }));
      } catch {
        // No scenes
      }

      // Determine status
      let status = "draft";
      let finalPath = "";
      let draftPath = "";
      let thumbnailPath = "";

      try {
        await stat(join(projectPath, "final", `${name}_final.mp4`));
        status = "final";
        finalPath = `/api/files/${entry}/final/${name}_final.mp4`;
      } catch {
        try {
          await stat(join(projectPath, "draft", `${name}_draft.mp4`));
          status = "review";
          draftPath = `/api/files/${entry}/draft/${name}_draft.mp4`;
        } catch {
          // draft
        }
      }

      try {
        await stat(join(projectPath, "final", `${name}_thumbnail.png`));
        thumbnailPath = `/api/files/${entry}/final/${name}_thumbnail.png`;
      } catch {
        // No thumbnail
      }

      projects.push({
        id: entry,
        name,
        date,
        status,
        contentType,
        lang,
        brief,
        title,
        scenes,
        durations,
        pipelineStep: status === "final" ? "done" : "idle",
        pipelineProgress: status === "final" ? 100 : 0,
        thumbnailPath,
        finalPath,
        draftPath,
      });
    }

    // Sort by date desc
    projects.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Projects scan error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Support both query param and JSON body
    const url = new URL(req.url);
    let projectId = url.searchParams.get("id");
    if (!projectId) {
      try {
        const body = await req.json();
        projectId = body.projectId;
      } catch {
        // no body
      }
    }
    if (!projectId) {
      return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    
    // Safety: ensure path is within projects dir
    const resolved = resolve(projectDir);
    if (!resolved.startsWith(resolve(PROJECTS_DIR))) {
      return NextResponse.json({ error: "Geçersiz proje" }, { status: 403 });
    }

    // Check exists
    try {
      await stat(projectDir);
    } catch {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }

    await rm(projectDir, { recursive: true, force: true });

    return NextResponse.json({ message: "Proje silindi", projectId });
  } catch (error) {
    console.error("Project delete error:", error);
    return NextResponse.json({ error: "Proje silinemedi" }, { status: 500 });
  }
}
