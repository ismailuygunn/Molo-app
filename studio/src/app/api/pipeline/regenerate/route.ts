export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join, resolve } from "path";
import { readFile } from "fs/promises";

const ROOT_DIR = resolve(process.cwd(), "..");
const SCRIPTS_DIR = join(ROOT_DIR, "scripts");
const PROJECTS_DIR = join(ROOT_DIR, "projects");

export async function POST(req: NextRequest) {
  try {
    const { projectId, sceneIndex } = await req.json();
    if (!projectId || sceneIndex === undefined) {
      return NextResponse.json(
        { error: "projectId ve sceneIndex gerekli" },
        { status: 400 }
      );
    }

    const projectDir = join(PROJECTS_DIR, projectId);

    // Pipeline paused mı kontrol et
    const progressPath = join(projectDir, "progress.json");
    try {
      const raw = await readFile(progressPath, "utf-8");
      const data = JSON.parse(raw);
      if (!data.isPaused) {
        return NextResponse.json(
          { error: "Pipeline duraklatılmış değil — sadece pause sırasında yeniden üretim yapılabilir" },
          { status: 409 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Pipeline durumu okunamadı" },
        { status: 500 }
      );
    }

    // Python ile tek sahne yeniden üret
    const script = `
import sys
sys.path.insert(0, "${SCRIPTS_DIR}")
from molo_agent import regenerate_single_image
result = regenerate_single_image(${sceneIndex}, "${projectDir}")
if result:
    print(f"OK:{result}")
else:
    print("FAIL")
    sys.exit(1)
`;

    return new Promise<NextResponse>((resolveResp) => {
      const child = spawn("python3", ["-c", script], {
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

      child.on("close", (code: number | null) => {
        if (code === 0) {
          const okLine = stdout.split("\n").find((l) => l.startsWith("OK:"));
          const newPath = okLine?.replace("OK:", "").trim() || "";
          resolveResp(
            NextResponse.json({
              message: `Sahne ${sceneIndex + 1} yeniden üretildi`,
              path: newPath,
              sceneIndex,
            })
          );
        } else {
          console.error("Regenerate stderr:", stderr.slice(-500));
          resolveResp(
            NextResponse.json(
              {
                error: `Yeniden üretim başarısız (exit ${code})`,
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
            { error: "Yeniden üretim zaman aşımına uğradı (120s)" },
            { status: 504 }
          )
        );
      }, 120000);
    });
  } catch (error) {
    console.error("Regenerate error:", error);
    return NextResponse.json(
      { error: `Yeniden üretim hatası: ${error}` },
      { status: 500 }
    );
  }
}
