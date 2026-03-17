export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join, resolve } from "path";
import { writeFile, readFile } from "fs/promises";

const ROOT_DIR = resolve(process.cwd(), "..");
const SCRIPTS_DIR = join(ROOT_DIR, "scripts");
const PROJECTS_DIR = join(ROOT_DIR, "projects");

export async function POST(req: NextRequest) {
  try {
    const {
      projectId, type, crossfade, slowdown, crf, transition,
      addSubtitles, fontSize, marginV,
    } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const logPath = join(projectDir, ".render.log");
    const pidPath = join(projectDir, ".render.pid");

    // Check if render is already running
    try {
      const pidStr = await readFile(pidPath, "utf-8");
      const pid = parseInt(pidStr.trim());
      process.kill(pid, 0); // Signal 0 = check alive
      return NextResponse.json(
        { error: "Render zaten çalışıyor", pid },
        { status: 409 }
      );
    } catch {
      // Process not running or no PID file — OK to start
    }

    // Build render config with all user parameters
    const config = {
      crossfade: crossfade ?? 0.7,
      slowdown: slowdown ?? 0.88,
      crf: crf ?? 16,
      transition: transition ?? "fade",
      type: type ?? "draft",
      addSubtitles: addSubtitles !== false,
      fontSize: fontSize ?? 42,
      marginV: marginV ?? 200,
    };

    const configPath = join(projectDir, ".render_config.json");
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    await writeFile(logPath, `[${new Date().toISOString()}] Render başlatılıyor...\nConfig: ${JSON.stringify(config)}\n`, "utf-8");

    // Spawn molo_agent.py with --render-config flag
    const scriptPath = join(SCRIPTS_DIR, "molo_agent.py");
    const child = spawn("python3", [scriptPath, "--render-config", configPath], {
      cwd: ROOT_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Save PID
    if (child.pid) {
      await writeFile(pidPath, String(child.pid), "utf-8");
    }

    const { createWriteStream, unlink } = await import("fs");
    const logStream = createWriteStream(logPath, { flags: "a" });
    child.stdout?.on("data", (data: Buffer) => logStream.write(data.toString()));
    child.stderr?.on("data", (data: Buffer) => logStream.write(`[STDERR] ${data.toString()}`));
    child.on("close", (code: number | null) => {
      const marker = code === 0 ? "RENDER_SUCCESS" : "RENDER_FAILED";
      logStream.write(`\n${marker}\n[${new Date().toISOString()}] Render tamamlandı (exit: ${code})\n`);
      logStream.end();
      // Clean up PID file
      unlink(pidPath, () => {});
    });
    child.unref();

    return NextResponse.json({ message: "Render başlatıldı", pid: child.pid, config });
  } catch (error) {
    console.error("Render error:", error);
    return NextResponse.json({ error: `Render başlatılamadı: ${error}` }, { status: 500 });
  }
}

// Render durdurma
export async function DELETE(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const pidPath = join(projectDir, ".render.pid");

    try {
      const pidStr = await readFile(pidPath, "utf-8");
      const pid = parseInt(pidStr.trim());
      process.kill(pid, "SIGTERM");

      const { unlink } = await import("fs");
      unlink(pidPath, () => {});

      return NextResponse.json({ message: "Render durduruldu", pid });
    } catch {
      return NextResponse.json({ message: "Render zaten çalışmıyor" });
    }
  } catch (error) {
    return NextResponse.json({ error: `Render durdurulamadı: ${error}` }, { status: 500 });
  }
}
