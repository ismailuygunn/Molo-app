export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join, resolve } from "path";
import { writeFile, mkdir, readFile } from "fs/promises";

const ROOT_DIR = resolve(process.cwd(), "..");
const SCRIPTS_DIR = join(ROOT_DIR, "scripts");
const PROJECTS_DIR = join(ROOT_DIR, "projects");

export async function POST(req: NextRequest) {
  try {
    const { projectId, resume } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const briefPath = join(projectDir, "brief.md");
    const scriptPath = join(SCRIPTS_DIR, "molo_agent.py");
    const logPath = join(projectDir, ".pipeline.log");
    const pidPath = join(projectDir, ".pipeline.pid");

    // Check if pipeline is already running
    try {
      const pidStr = await readFile(pidPath, "utf-8");
      const pid = parseInt(pidStr.trim());
      process.kill(pid, 0); // Signal 0 = check alive
      // Process is still alive — reject
      return NextResponse.json(
        { error: "Pipeline zaten çalışıyor", pid },
        { status: 409 }
      );
    } catch {
      // Process not running or no PID file — OK to start
    }

    // Ensure project dir exists
    await mkdir(projectDir, { recursive: true });

    // E4: Backup previous log
    try {
      await readFile(logPath, "utf-8");
      const { rename } = await import("fs/promises");
      await rename(logPath, logPath + ".bak");
    } catch { /* no previous log */ }

    // Clear previous log
    await writeFile(logPath, `[${new Date().toISOString()}] Pipeline başlatılıyor...\n`, "utf-8");

    // Spawn pipeline with --auto-approve (and --resume if requested)
    const args = [scriptPath, briefPath, "--auto-approve"];
    if (resume) args.push("--resume");
    const child = spawn("python3", args, {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1", // Real-time output
      },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Save PID
    if (child.pid) {
      await writeFile(pidPath, String(child.pid), "utf-8");
    }

    // Stream stdout & stderr to log file
    const { createWriteStream } = await import("fs");
    const logStream = createWriteStream(logPath, { flags: "a" });

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      logStream.write(text);
      console.log("[PIPELINE]", text.trim());
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      logStream.write(`[STDERR] ${text}`);
      console.error("[PIPELINE ERR]", text.trim());
    });

    child.on("close", (code: number | null) => {
      const msg = `\n[${new Date().toISOString()}] Pipeline tamamlandı (exit code: ${code})\n`;
      logStream.write(msg);
      logStream.end();
    });

    child.unref();

    return NextResponse.json({
      message: "Pipeline başlatıldı",
      pid: child.pid,
      projectId,
      logPath: `.pipeline.log`,
    });
  } catch (error) {
    console.error("Pipeline error:", error);
    return NextResponse.json(
      { error: `Pipeline başlatılamadı: ${error}` },
      { status: 500 }
    );
  }
}

// Pipeline durdurma
export async function DELETE(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const pidPath = join(projectDir, ".pipeline.pid");
    const progressPath = join(projectDir, "progress.json");

    let pid: number | null = null;
    try {
      const pidStr = await readFile(pidPath, "utf-8");
      pid = parseInt(pidStr.trim());
      process.kill(pid, "SIGTERM");

      // Write cancelled status
      await writeFile(progressPath, JSON.stringify({
        step: "error",
        progress: 0,
        message: "Pipeline kullanıcı tarafından durduruldu",
        isRunning: false,
        isError: true,
        isDone: false,
        updatedAt: new Date().toISOString(),
      }), "utf-8");

      return NextResponse.json({ message: "Pipeline durduruldu", pid });
    } catch {
      return NextResponse.json({ message: "Pipeline zaten çalışmıyor" });
    }
  } catch (error) {
    console.error("Pipeline stop error:", error);
    return NextResponse.json({ error: "Pipeline durdurulamadı" }, { status: 500 });
  }
}

// Pipeline devam ettirme (pause sonrası)
export async function PATCH(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const resumeFile = join(projectDir, ".pipeline.resume");

    // Resume sinyali oluştur — pipeline bu dosyayı görünce devam eder
    await writeFile(resumeFile, new Date().toISOString(), "utf-8");

    return NextResponse.json({ message: "Pipeline devam ettiriliyor", projectId });
  } catch (error) {
    console.error("Pipeline resume error:", error);
    return NextResponse.json({ error: "Pipeline devam ettirilemedi" }, { status: 500 });
  }
}
