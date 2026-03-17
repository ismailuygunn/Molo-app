import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

/** Debug: check Docker image filesystem */
export async function GET() {
  try {
    const checks: Record<string, string> = {};
    
    // Check projects-seed
    try {
      checks["projects-seed-exists"] = execSync("ls -la /app/projects-seed/ 2>&1 | head -20").toString();
    } catch (e) { checks["projects-seed-exists"] = String(e); }
    
    // Check projects volume
    try {
      checks["projects-volume"] = execSync("ls -la /app/projects/ 2>&1 | head -20").toString();
    } catch (e) { checks["projects-volume"] = String(e); }
    
    // Check if seed has files
    try {
      checks["seed-file-count"] = execSync("find /app/projects-seed -type f 2>/dev/null | wc -l").toString().trim();
    } catch (e) { checks["seed-file-count"] = String(e); }
    
    // Check volume file count
    try {
      checks["volume-file-count"] = execSync("find /app/projects -type f 2>/dev/null | wc -l").toString().trim();
    } catch (e) { checks["volume-file-count"] = String(e); }
    
    // Check working directory
    try {
      checks["cwd"] = execSync("pwd").toString().trim();
    } catch { /* */ }
    
    return NextResponse.json(checks);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
