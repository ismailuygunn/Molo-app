import { NextRequest, NextResponse } from "next/server";
import { readdir, rename, stat } from "fs/promises";
import { join, resolve } from "path";

export const dynamic = "force-dynamic";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

/**
 * Admin endpoint: fix project directories with non-ASCII characters.
 * GET  → lists all directories with non-ASCII chars
 * POST → renames them to ASCII-safe equivalents
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
      
      // Check if target already exists
      try {
        await stat(newPath);
        results.push({ old: entry, new: newName, status: "skipped — target exists" });
        continue;
      } catch { /* target doesn't exist, good */ }
      
      await rename(oldPath, newPath);
      results.push({ old: entry, new: newName, status: "renamed" });
    }
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
