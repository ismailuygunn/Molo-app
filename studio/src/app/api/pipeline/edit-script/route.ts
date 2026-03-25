export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { join, resolve } from "path";
import { readFile, writeFile, access, mkdir } from "fs/promises";

const ROOT_DIR = resolve(process.cwd(), "..");
const PROJECTS_DIR = join(ROOT_DIR, "projects");

interface SceneEdit {
  scene: number;
  text: string;
  text_tr?: string;
  voice_direction: string;
  shot_type: string;
  emotion_note?: string;
  environment: string;
  background_description?: string;
  molo_pose?: string;
}

interface EditScriptBody {
  projectId: string;
  scenes: SceneEdit[];
}

const REQUIRED_SCENE_FIELDS: (keyof SceneEdit)[] = [
  "scene",
  "text",
  "voice_direction",
  "shot_type",
  "environment",
];

export async function POST(req: NextRequest) {
  try {
    const body: EditScriptBody = await req.json();
    const { projectId, scenes } = body;

    // --- Input validation ---
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "projectId gerekli" },
        { status: 400 }
      );
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: "scenes dizisi gerekli ve bos olamaz" },
        { status: 400 }
      );
    }

    for (const s of scenes) {
      for (const field of REQUIRED_SCENE_FIELDS) {
        if (s[field] === undefined || s[field] === null || s[field] === "") {
          return NextResponse.json(
            {
              error: `Sahne ${s.scene ?? "?"} icin '${field}' alani gerekli`,
            },
            { status: 400 }
          );
        }
      }
      if (typeof s.scene !== "number" || s.scene < 1) {
        return NextResponse.json(
          { error: `Gecersiz sahne numarasi: ${s.scene}` },
          { status: 400 }
        );
      }
    }

    // --- Path traversal protection ---
    const projectDir = join(PROJECTS_DIR, projectId);
    const resolvedProjectDir = resolve(projectDir);

    if (!resolvedProjectDir.startsWith(PROJECTS_DIR)) {
      return NextResponse.json(
        { error: "Gecersiz projectId" },
        { status: 400 }
      );
    }

    // --- Validate project exists ---
    try {
      await access(projectDir);
    } catch {
      return NextResponse.json(
        { error: `Proje bulunamadi: ${projectId}` },
        { status: 404 }
      );
    }

    const scenesDir = join(projectDir, "scenes");
    await mkdir(scenesDir, { recursive: true });

    const scriptEditPath = join(scenesDir, "script_edit.json");
    const scenesJsonPath = join(scenesDir, "scenes.json");

    // 1. Write script_edit.json (full edit payload)
    const editData = {
      projectId,
      scenes,
      editedAt: new Date().toISOString(),
    };
    await writeFile(scriptEditPath, JSON.stringify(editData, null, 2), "utf-8");

    // 2. Merge into scenes.json (preserve durations and other existing fields)
    try {
      let existing: Record<string, unknown> = {};
      try {
        const raw = await readFile(scenesJsonPath, "utf-8");
        existing = JSON.parse(raw);
      } catch {
        // scenes.json does not exist yet, start fresh
      }

      const existingScenes: Record<string, unknown>[] = Array.isArray(
        (existing as { scenes?: unknown }).scenes
      )
        ? ((existing as { scenes: Record<string, unknown>[] }).scenes)
        : [];

      // Build a map of existing scenes by scene number for duration preservation
      const existingByNumber = new Map<number, Record<string, unknown>>();
      for (const es of existingScenes) {
        const num = (es as { scene?: number }).scene;
        if (typeof num === "number") {
          existingByNumber.set(num, es);
        }
      }

      // Merge: new edit data takes precedence, but keep fields like duration
      const mergedScenes = scenes.map((editedScene) => {
        const prev = existingByNumber.get(editedScene.scene) ?? {};
        return { ...prev, ...editedScene };
      });

      const updatedScenesData = {
        ...existing,
        scenes: mergedScenes,
        lastEditedAt: new Date().toISOString(),
      };

      await writeFile(
        scenesJsonPath,
        JSON.stringify(updatedScenesData, null, 2),
        "utf-8"
      );
    } catch (mergeError) {
      // Non-fatal: script_edit.json is the source of truth
      console.warn(
        "scenes.json guncellenemedi, script_edit.json yine de yazildi:",
        mergeError
      );
    }

    return NextResponse.json({
      message: "Senaryo kaydedildi",
      sceneCount: scenes.length,
    });
  } catch (error) {
    console.error("Edit script error:", error);
    return NextResponse.json(
      { error: `Senaryo kaydetme hatasi: ${error}` },
      { status: 500 }
    );
  }
}
