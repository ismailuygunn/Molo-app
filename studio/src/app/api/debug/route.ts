export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { resolve, join } from "path";

// Debug endpoint — shows what files actually exist on the server
export async function GET() {
  const cwd = process.cwd();
  const projectsDir = resolve(cwd, "..", "projects");
  const referenceDir = resolve(cwd, "..", "_reference");

  const result: Record<string, unknown> = {
    cwd,
    projectsDir,
    referenceDir,
    projectsDirExists: false,
    referenceDirExists: false,
    projects: {} as Record<string, string[]>,
    referenceFiles: [] as string[],
  };

  try {
    await stat(projectsDir);
    result.projectsDirExists = true;
    const entries = await readdir(projectsDir);
    for (const entry of entries) {
      const entryPath = join(projectsDir, entry);
      const s = await stat(entryPath);
      if (s.isDirectory()) {
        // List files in each project
        const projectFiles: string[] = [];
        const listRecursive = async (dir: string, prefix = "") => {
          try {
            const items = await readdir(dir);
            for (const item of items) {
              const itemPath = join(dir, item);
              const is = await stat(itemPath);
              if (is.isDirectory()) {
                await listRecursive(itemPath, `${prefix}${item}/`);
              } else {
                projectFiles.push(`${prefix}${item} (${(is.size / 1024).toFixed(0)}KB)`);
              }
            }
          } catch { /* */ }
        };
        await listRecursive(entryPath);
        (result.projects as Record<string, string[]>)[entry] = projectFiles;
      }
    }
  } catch {
    result.projectsDirExists = false;
  }

  try {
    await stat(referenceDir);
    result.referenceDirExists = true;
    const refFiles = await readdir(referenceDir);
    result.referenceFiles = refFiles;
  } catch {
    result.referenceDirExists = false;
  }

  return NextResponse.json(result, { status: 200 });
}
