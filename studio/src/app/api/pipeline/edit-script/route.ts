export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join, resolve } from "path";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

export async function POST(req: NextRequest) {
  try {
    const { projectId, scenes } = await req.json();
    if (!projectId || !scenes) {
      return NextResponse.json(
        { error: "projectId ve scenes gerekli" },
        { status: 400 }
      );
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const resolvedDir = resolve(projectDir);
    if (!resolvedDir.startsWith(resolve(PROJECTS_DIR))) {
      return NextResponse.json({ error: "Geçersiz proje" }, { status: 403 });
    }

    const scenesDir = join(projectDir, "scenes");
    await mkdir(scenesDir, { recursive: true });

    // Write script_edit.json — Python pipeline reads this on resume
    const editPath = join(scenesDir, "script_edit.json");
    await writeFile(
      editPath,
      JSON.stringify({ scenes }, null, 2),
      "utf-8"
    );

    // Also update scenes.json with new texts
    const scenesJsonPath = join(scenesDir, "scenes.json");
    try {
      const existing = JSON.parse(
        await readFile(scenesJsonPath, "utf-8")
      );
      const existingScenes = Array.isArray(existing)
        ? existing
        : existing.scenes || [];

      for (const edited of scenes) {
        const target = existingScenes.find(
          (s: Record<string, unknown>) => s.scene === edited.scene
        );
        if (target) {
          if (edited.text) target.text = edited.text;
          if (edited.text_de) target.text_de = edited.text_de;
          if (edited.text_tr) target.text_tr = edited.text_tr;
        }
      }

      const output = Array.isArray(existing)
        ? existingScenes
        : { ...existing, scenes: existingScenes };
      await writeFile(
        scenesJsonPath,
        JSON.stringify(output, null, 2),
        "utf-8"
      );
    } catch {
      // scenes.json might not exist yet — that's ok, script_edit.json is primary
    }

    return NextResponse.json({
      message: "Senaryo düzenlendi",
      editedCount: scenes.length,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json(
      { error: `Senaryo düzenlenemedi: ${msg}` },
      { status: 500 }
    );
  }
}
