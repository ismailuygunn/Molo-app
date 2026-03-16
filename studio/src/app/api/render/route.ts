import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join, resolve } from "path";
import { writeFile } from "fs/promises";

const ROOT_DIR = resolve(process.cwd(), "..");
const SCRIPTS_DIR = join(ROOT_DIR, "scripts");
const PROJECTS_DIR = join(ROOT_DIR, "projects");

export async function POST(req: NextRequest) {
  try {
    const { projectId, type, crossfade, slowdown, crf, transition } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const logPath = join(projectDir, ".render.log");

    // Build render config
    const config = {
      crossfade: crossfade || 0.7,
      slowdown: slowdown || 0.88,
      crf: crf || 16,
      transition: transition || "fade",
      type: type || "draft",
    };

    // Write config for the script to read
    const configPath = join(projectDir, ".render_config.json");
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    // Call a Python render script (reuses compose_edit from molo_agent)
    const renderScript = `
import sys, json
from pathlib import Path
sys.path.insert(0, '${SCRIPTS_DIR}')
from dotenv import load_dotenv
load_dotenv(Path('${ROOT_DIR}') / '.env')
from molo_agent import compose_edit, add_subtitles, apply_slowdown
from config import *

project_dir = Path('${projectDir}')
project_name = '${projectId}'.split('_', 1)[1] if '_' in '${projectId}' else '${projectId}'

# Load scenes
scenes_json = project_dir / 'scenes' / 'scenes.json'
if not scenes_json.exists():
    print('No scenes.json found')
    sys.exit(1)

data = json.loads(scenes_json.read_text())
scenes = data['scenes'] if isinstance(data, dict) else data
durations = data.get('durations', []) if isinstance(data, dict) else []
config = json.loads(Path('${configPath}').read_text())

# Collect files
from glob import glob
video_files = sorted(glob(str(project_dir / 'scenes' / '*.mp4')))
voice_files = sorted(glob(str(project_dir / 'audio' / '*.mp3')))

if not video_files:
    print('No video files found')
    sys.exit(1)

print(f'Found {len(video_files)} videos, {len(voice_files)} audio files')
print(f'Config: {config}')

# Run compose
draft = compose_edit(video_files, voice_files, durations, project_dir, project_name)
if draft:
    print(f'Draft created: {draft}')
    # Add subtitles
    lang = 'de'
    subtitled = add_subtitles(draft, scenes, durations, project_dir, project_name, lang)
    if subtitled:
        print(f'Subtitled: {subtitled}')
        final = apply_slowdown(subtitled, project_dir, project_name)
        print(f'Final: {final}')
    print('✅ Render complete!')
else:
    print('❌ Compose failed')
    sys.exit(1)
`;

    const scriptPath = join(projectDir, ".render_script.py");
    await writeFile(scriptPath, renderScript, "utf-8");

    await writeFile(logPath, `[${new Date().toISOString()}] Render başlatılıyor...\n`, "utf-8");

    const child = spawn("python3", [scriptPath], {
      cwd: ROOT_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const { createWriteStream } = await import("fs");
    const logStream = createWriteStream(logPath, { flags: "a" });
    child.stdout?.on("data", (data: Buffer) => logStream.write(data.toString()));
    child.stderr?.on("data", (data: Buffer) => logStream.write(`[ERR] ${data.toString()}`));
    child.on("close", (code: number | null) => {
      logStream.write(`\n[${new Date().toISOString()}] Render tamamlandı (exit: ${code})\n`);
      logStream.end();
    });
    child.unref();

    return NextResponse.json({ message: "Render başlatıldı", pid: child.pid });
  } catch (error) {
    console.error("Render error:", error);
    return NextResponse.json({ error: `Render başlatılamadı: ${error}` }, { status: 500 });
  }
}
