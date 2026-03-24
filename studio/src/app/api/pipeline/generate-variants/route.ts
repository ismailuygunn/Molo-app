export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join, resolve } from "path";
import { access, readdir } from "fs/promises";

const ROOT_DIR = resolve(process.cwd(), "..");
const SCRIPTS_DIR = join(ROOT_DIR, "scripts");
const PROJECTS_DIR = join(ROOT_DIR, "projects");

interface GenerateVariantsBody {
  projectId: string;
  sceneIndex: number;
  variantCount: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateVariantsBody = await req.json();
    const { projectId, sceneIndex, variantCount } = body;

    if (!projectId || sceneIndex === undefined || !variantCount) {
      return NextResponse.json(
        { error: "projectId, sceneIndex ve variantCount gerekli" },
        { status: 400 }
      );
    }

    if (
      typeof sceneIndex !== "number" ||
      sceneIndex < 0 ||
      !Number.isInteger(sceneIndex)
    ) {
      return NextResponse.json(
        { error: "sceneIndex sıfır veya pozitif tam sayı olmalı" },
        { status: 400 }
      );
    }

    if (
      typeof variantCount !== "number" ||
      variantCount < 1 ||
      variantCount > 4 ||
      !Number.isInteger(variantCount)
    ) {
      return NextResponse.json(
        { error: "variantCount 1-4 arası tam sayı olmalı" },
        { status: 400 }
      );
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const resolvedProjectDir = resolve(projectDir);

    // Path traversal protection
    if (!resolvedProjectDir.startsWith(PROJECTS_DIR)) {
      return NextResponse.json(
        { error: "Geçersiz projectId" },
        { status: 400 }
      );
    }

    // Validate project exists
    try {
      await access(projectDir);
    } catch {
      return NextResponse.json(
        { error: `Proje bulunamadı: ${projectId}` },
        { status: 404 }
      );
    }

    const briefPath = join(projectDir, "brief.md");
    const scriptPath = join(SCRIPTS_DIR, "molo_agent.py");

    // Validate brief exists
    try {
      await access(briefPath);
    } catch {
      return NextResponse.json(
        { error: "brief.md bulunamadı, önce pipeline başlatın" },
        { status: 404 }
      );
    }

    // Spawn Python process for variant generation
    const args = [
      scriptPath,
      "--regenerate-scene",
      String(sceneIndex),
      "--variants",
      String(variantCount),
      briefPath,
    ];

    return new Promise<NextResponse>((resolveResp) => {
      const child = spawn("python3", args, {
        cwd: ROOT_DIR,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", async (code: number | null) => {
        if (code === 0) {
          // Collect generated variant files from scenes directory
          const scenesDir = join(projectDir, "scenes");
          const sceneNum = String(sceneIndex + 1).padStart(2, "0");
          const variantPattern = `scene_${sceneNum}_v`;

          try {
            const files = await readdir(scenesDir);
            const variants = files
              .filter(
                (f) => f.startsWith(variantPattern) && f.endsWith(".png")
              )
              .sort()
              .map((f) => `/api/files/${projectId}/scenes/${f}`);

            resolveResp(
              NextResponse.json({
                message: `Sahne ${sceneIndex + 1} için ${variants.length} varyant üretildi`,
                variants,
                sceneIndex,
              })
            );
          } catch {
            // Fallback: build expected paths from variantCount
            const variants = Array.from({ length: variantCount }, (_, i) => {
              return `/api/files/${projectId}/scenes/scene_${sceneNum}_v${i + 1}.png`;
            });

            resolveResp(
              NextResponse.json({
                message: `Sahne ${sceneIndex + 1} için varyant üretimi tamamlandı`,
                variants,
                sceneIndex,
              })
            );
          }
        } else {
          console.error("Generate variants stderr:", stderr.slice(-500));
          resolveResp(
            NextResponse.json(
              {
                error: `Varyant üretimi başarısız (exit ${code})`,
                detail: stderr.slice(-300),
              },
              { status: 500 }
            )
          );
        }
      });

      // 120s timeout
      setTimeout(() => {
        child.kill("SIGTERM");
        resolveResp(
          NextResponse.json(
            { error: "Varyant üretimi zaman aşımına uğradı (120s)" },
            { status: 504 }
          )
        );
      }, 120000);
    });
  } catch (error) {
    console.error("Generate variants error:", error);
    return NextResponse.json(
      { error: `Varyant üretim hatası: ${error}` },
      { status: 500 }
    );
  }
}
