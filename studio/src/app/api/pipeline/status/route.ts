export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve } from "path";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

interface ProgressData {
  step: string;
  progress: number;
  message: string;
  isRunning: boolean;
  isError: boolean;
  isDone: boolean;
  isPaused: boolean;
  updatedAt: string;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
  }

  const projectDir = join(PROJECTS_DIR, projectId);
  const progressPath = join(projectDir, "progress.json");
  const logPath = join(projectDir, ".pipeline.log");
  const pidPath = join(projectDir, ".pipeline.pid");

  // 1. Check if process is alive
  let pid: number | null = null;
  let processAlive = false;
  try {
    const pidStr = await readFile(pidPath, "utf-8");
    pid = parseInt(pidStr.trim());
    process.kill(pid, 0);
    processAlive = true;
  } catch {
    processAlive = false;
  }

  // 2. Try reading structured progress.json (preferred)
  try {
    const raw = await readFile(progressPath, "utf-8");
    const data: ProgressData = JSON.parse(raw);

    const isRunning = processAlive && data.isRunning;
    const isDone = data.isDone;
    const isPaused = data.isPaused || false;
    const isError = data.isError || (!processAlive && !isDone && !isPaused && data.step !== "idle");

    // Always read log tail for display
    let logTail = "";
    try {
      const log = await readFile(logPath, "utf-8");
      logTail = log.length > 1500 ? log.slice(-1500) : log;
    } catch { /* no log yet */ }

    return NextResponse.json({
      status: isDone ? "done" : isError ? "error" : isPaused ? "paused" : isRunning ? "running" : "idle",
      step: isError && !data.isError ? "error" : data.step,
      progress: data.progress,
      message: isError && !data.isError
        ? "Pipeline beklenmedik şekilde sonlandı"
        : data.message,
      log: logTail,
      lastLine: data.message,
      isRunning,
      isError,
      isDone,
      isPaused,
      pid,
      updatedAt: data.updatedAt,
    });
  } catch {
    // No progress.json — fall back to log parsing
  }

  // 3. Fallback: parse log file (backward compat)
  try {
    const log = await readFile(logPath, "utf-8");
    const parsed = parsePipelineLog(log);
    const isRunning = processAlive && !parsed.isDone && !parsed.isError;
    const logTail = log.length > 1500 ? log.slice(-1500) : log;

    return NextResponse.json({
      status: parsed.isDone ? "done" : parsed.isError ? "error" : isRunning ? "running" : "idle",
      step: parsed.step,
      progress: parsed.progress,
      message: parsed.lastLine,
      log: logTail,
      lastLine: parsed.lastLine,
      isRunning,
      isError: parsed.isError,
      isDone: parsed.isDone,
      pid,
    });
  } catch {
    // No log either — idle
    return NextResponse.json({
      status: "idle",
      step: "idle",
      progress: 0,
      message: "",
      log: "",
      lastLine: "",
      isRunning: false,
      isError: false,
      isDone: false,
    });
  }
}

// Backward-compatible log parser (fallback only)
function parsePipelineLog(log: string) {
  const lines = log.split("\n").filter((l) => l.trim());
  const lastLine = lines[lines.length - 1] || "";
  const isDone = log.includes("TAMAMLANDI") || log.includes("exit code: 0");
  const isError =
    log.includes("exit code: 1") ||
    log.includes("❌") ||
    (log.includes("exit code:") && !log.includes("exit code: 0"));

  let step = "starting";
  let progress = 5;

  if (log.includes("Senaryo")) { step = "script"; progress = 15; }
  if (log.includes("Görselleri") || log.includes("görsel")) { step = "images"; progress = 40; }
  if (log.includes("inceleme") || log.includes("DURAKLATILDI")) { step = "image_review"; progress = 50; }
  if (log.includes("Ses") || log.includes("voice")) { step = "voice"; progress = 75; }
  if (isDone) { step = "done"; progress = 100; }
  if (isError) { step = "error"; }

  return { step, progress, lastLine, isDone, isError };
}
