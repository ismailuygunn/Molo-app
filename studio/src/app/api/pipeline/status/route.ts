import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, resolve } from "path";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

// Parse pipeline step from log content
function parsePipelineStep(log: string): {
  step: string;
  progress: number;
  lastLine: string;
  isRunning: boolean;
  isError: boolean;
  isDone: boolean;
} {
  const lines = log.split("\n").filter((l) => l.trim());
  const lastLine = lines[lines.length - 1] || "";

  // Check completion
  const isDone = log.includes("TAMAMLANDI") || log.includes("exit code: 0");
  const isError =
    log.includes("exit code: 1") ||
    log.includes("❌") ||
    (log.includes("exit code:") && !log.includes("exit code: 0"));
  const isRunning = !isDone && !isError && !log.includes("exit code:");

  // Detect current step from log markers
  let step = "starting";
  let progress = 5;

  if (log.includes("ADIM 1:") || log.includes("Senaryo Üretimi")) {
    step = "script";
    progress = 10;
  }
  if (log.includes("ADIM 2:") || log.includes("Ses Üretimi")) {
    step = "voice";
    progress = 25;
  }
  if (log.includes("İÇERİK ONAYI") || log.includes("Otomatik onay")) {
    step = "approval";
    progress = 30;
  }
  if (log.includes("ADIM 4:") || log.includes("Sahne Görselleri")) {
    step = "images";
    progress = 40;
  }
  if (log.includes("ADIM 5:") || log.includes("Video Üretimi")) {
    step = "videos";
    progress = 55;
  }
  if (log.includes("ADIM 6:") || log.includes("Kurgu")) {
    step = "edit";
    progress = 75;
  }
  if (log.includes("ADIM 7:") || log.includes("Altyazı")) {
    step = "subtitles";
    progress = 85;
  }
  if (log.includes("ADIM 8:") || log.includes("Final Slowdown")) {
    step = "slowdown";
    progress = 90;
  }
  if (log.includes("ADIM 9:") || log.includes("Thumbnail")) {
    step = "thumbnail";
    progress = 95;
  }
  if (isDone) {
    step = "done";
    progress = 100;
  }
  if (isError) {
    step = "error";
  }

  return { step, progress, lastLine, isRunning, isError, isDone };
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
  }

  const projectDir = join(PROJECTS_DIR, projectId);
  const logPath = join(projectDir, ".pipeline.log");
  const pidPath = join(projectDir, ".pipeline.pid");

  try {
    // Read log
    let log = "";
    try {
      log = await readFile(logPath, "utf-8");
    } catch {
      return NextResponse.json({
        status: "idle",
        step: "idle",
        progress: 0,
        log: "",
        lastLine: "",
        isRunning: false,
        isError: false,
        isDone: false,
      });
    }

    // Check if process is still running
    let pid: number | null = null;
    let processAlive = false;
    try {
      const pidStr = await readFile(pidPath, "utf-8");
      pid = parseInt(pidStr.trim());
      process.kill(pid, 0); // Signal 0 = check if alive
      processAlive = true;
    } catch {
      processAlive = false;
    }

    const parsed = parsePipelineStep(log);

    // If log says done/error but process is still alive, trust the process
    const isRunning = processAlive && !parsed.isDone && !parsed.isError;

    // Return last 2000 chars of log to avoid huge payloads
    const logTail = log.length > 2000 ? log.slice(-2000) : log;

    return NextResponse.json({
      status: parsed.isDone ? "done" : parsed.isError ? "error" : isRunning ? "running" : "idle",
      step: parsed.step,
      progress: parsed.progress,
      log: logTail,
      lastLine: parsed.lastLine,
      isRunning,
      isError: parsed.isError,
      isDone: parsed.isDone,
      pid,
    });
  } catch (error) {
    console.error("Pipeline status error:", error);
    return NextResponse.json({ error: "Status okunamadı" }, { status: 500 });
  }
}
