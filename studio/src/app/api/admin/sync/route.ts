import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

/**
 * Admin sync: upload a tar.gz of a project directory.
 * POST /api/admin/sync?project=<project-id>
 * Body: raw tar.gz binary
 */
export async function POST(req: NextRequest) {
  try {
    const projectId = new URL(req.url).searchParams.get("project");
    if (!projectId) {
      return NextResponse.json({ error: "project param required" }, { status: 400 });
    }

    if (!/^[a-z0-9_\-]+$/i.test(projectId)) {
      return NextResponse.json({ error: "invalid project id" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    await mkdir(projectDir, { recursive: true });

    // Read tar.gz from body
    const body = await req.arrayBuffer();
    const tarPath = join("/tmp", `${projectId}.tar.gz`);
    await writeFile(tarPath, Buffer.from(body));

    // Extract — strip-components=0 because tar was created with -C dir .
    execSync(`tar xzf "${tarPath}" -C "${projectDir}"`, { timeout: 120000 });
    execSync(`rm -f "${tarPath}"`);

    let fileCount = 0;
    try {
      const count = execSync(`find "${projectDir}" -type f | wc -l`).toString().trim();
      fileCount = parseInt(count) || 0;
    } catch { /* ignore */ }

    return NextResponse.json({ status: "ok", project: projectId, files: fileCount });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const entries = await readdir(PROJECTS_DIR);
    const projects = [];
    for (const entry of entries) {
      if (entry === "lost+found" || entry.startsWith(".")) continue;
      try {
        const s = await stat(join(PROJECTS_DIR, entry));
        if (!s.isDirectory()) continue;
        const count = execSync(`find "${join(PROJECTS_DIR, entry)}" -type f | wc -l`).toString().trim();
        projects.push({ id: entry, files: parseInt(count) || 0 });
      } catch { /* skip */ }
    }
    return NextResponse.json({ projects, total: projects.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
