export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve } from "path";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
  }

  const scenesPath = join(PROJECTS_DIR, projectId, "scenes", "scenes.json");

  try {
    const data = await readFile(scenesPath, "utf-8");
    const parsed = JSON.parse(data);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ scenes: [], durations: [], title: "" });
  }
}
