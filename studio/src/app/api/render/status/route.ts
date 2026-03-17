export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, resolve } from "path";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project");
    if (!projectId) {
      return NextResponse.json({ error: "project gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const logPath = join(projectDir, ".render.log");

    let logContent = "";
    let running = false;
    let completed = false;
    let error = false;
    let lastLine = "";
    let progress = 0;

    try {
      logContent = await readFile(logPath, "utf-8");
      const lines = logContent.trim().split("\n").filter(l => l.trim());
      lastLine = lines[lines.length - 1] || "";

      // Detect state from log — use explicit markers
      completed = logContent.includes("RENDER_SUCCESS");
      error = logContent.includes("RENDER_FAILED");

      // Check if render process is still running (log modified recently)
      try {
        const logStat = await stat(logPath);
        const age = Date.now() - logStat.mtimeMs;
        running = age < 15000 && !completed && !error; // modified in last 15s
      } catch { /* */ }

      // Estimate progress from log content
      if (logContent.includes("sahne birle")) progress = 40;
      if (logContent.includes("ADIM 6:") || logContent.includes("Per-Scene Merge")) progress = 20;
      if (logContent.includes("ASS") && logContent.includes("altyaz")) progress = 60;
      if (logContent.includes("ADIM 8:") || logContent.includes("Final Compose")) progress = 70;
      if (completed) progress = 100;
      if (error) progress = -1;

    } catch {
      // No log file
      return NextResponse.json({ running: false, completed: false, progress: 0, lastLine: "", log: "" });
    }

    // Extract last ~20 meaningful lines
    const meaningful = logContent.split("\n")
      .filter(l => l.trim() && !l.startsWith("  ") && !l.startsWith("{"))
      .slice(-20)
      .join("\n");

    return NextResponse.json({
      running,
      completed,
      error,
      progress,
      lastLine: lastLine.replace(/\[STDERR\]\s*/g, "").trim(),
      log: meaningful,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
