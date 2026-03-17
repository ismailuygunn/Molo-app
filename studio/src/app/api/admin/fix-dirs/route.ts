import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, cp, rm } from "fs/promises";
import { join, resolve } from "path";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");
const SEED_DIR = resolve(process.cwd(), "..", "projects-seed");

/**
 * Admin endpoint:
 * GET  → lists dirs with non-ASCII chars
 * POST → renames non-ASCII dirs to ASCII-safe
 * PUT  → seeds volume from Docker image (projects-seed → projects)
 */

function slugify(name: string): string {
  return name
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/[^a-z0-9_\-]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function GET() {
  try {
    const entries = await readdir(PROJECTS_DIR);
    const nonAscii = entries.filter(e => /[^\x00-\x7F]/.test(e));
    const fixes = nonAscii.map(old => ({
      old,
      new: old.split("_").map((part, i) => i === 0 ? part : slugify(part)).join("_"),
    }));
    return NextResponse.json({ total: entries.length, nonAscii: nonAscii.length, fixes, allEntries: entries });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const entries = await readdir(PROJECTS_DIR);
    const results = [];
    for (const entry of entries) {
      if (!/[^\x00-\x7F]/.test(entry)) continue;
      const parts = entry.split("_");
      const newName = parts.map((part, i) => i === 0 ? part : slugify(part)).join("_");
      if (newName === entry) continue;
      
      const oldPath = join(PROJECTS_DIR, entry);
      const newPath = join(PROJECTS_DIR, newName);
      
      try {
        await stat(newPath);
        results.push({ old: entry, new: newName, status: "skipped — target exists" });
        continue;
      } catch { /* target doesn't exist, good */ }
      
      await cp(oldPath, newPath, { recursive: true });
      await rm(oldPath, { recursive: true, force: true });
      results.push({ old: entry, new: newName, status: "renamed" });
    }
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** PUT: seed volume from Docker image's projects-seed directory */
export async function PUT() {
  try {
    // Check seed dir exists
    try {
      await stat(SEED_DIR);
    } catch {
      return NextResponse.json({ error: "No seed directory found at " + SEED_DIR }, { status: 404 });
    }

    const seedEntries = await readdir(SEED_DIR);
    const results: Array<{ project: string; copiedFiles: number }> = [];
    
    for (const projName of seedEntries) {
      const seedProj = join(SEED_DIR, projName);
      const s = await stat(seedProj);
      if (!s.isDirectory()) continue;
      
      const targetProj = join(PROJECTS_DIR, projName);
      
      // Use cp -r with no-clobber approach via execSync
      try {
        execSync(`mkdir -p "${targetProj}"`);
        // Copy all files, preserving structure, don't overwrite existing
        const output = execSync(
          `cd "${seedProj}" && find . -type f | while read f; do ` +
          `if [ ! -f "${targetProj}/$f" ]; then ` +
          `mkdir -p "$(dirname "${targetProj}/$f")" && ` +
          `cp "$f" "${targetProj}/$f" && echo "$f"; fi; done`,
          { timeout: 120000 }
        ).toString();
        
        const copiedFiles = output.trim().split("\n").filter(l => l.length > 0).length;
        results.push({ project: projName, copiedFiles });
      } catch (err) {
        results.push({ project: projName, copiedFiles: -1 });
      }
    }
    
    // Count totals
    const totalVolume = execSync(`find "${PROJECTS_DIR}" -type f | wc -l`).toString().trim();
    
    return NextResponse.json({
      status: "ok",
      results,
      totalFilesOnVolume: parseInt(totalVolume) || 0,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

