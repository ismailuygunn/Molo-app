export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join, resolve } from "path";
import { writeFile } from "fs/promises";

const ROOT_DIR = resolve(process.cwd(), "..");
const SCRIPTS_DIR = join(ROOT_DIR, "scripts");
const PROJECTS_DIR = join(ROOT_DIR, "projects");

export async function POST(req: NextRequest) {
  try {
    const {
      projectId, type, crossfade, slowdown, crf, transition,
      addSubtitles, fontSize, marginV,
    } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId gerekli" }, { status: 400 });
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const logPath = join(projectDir, ".render.log");

    // Build render config with all user parameters
    const config = {
      crossfade: crossfade ?? 0.7,
      slowdown: slowdown ?? 0.88,
      crf: crf ?? 16,
      transition: transition ?? "fade",
      type: type ?? "draft",
      addSubtitles: addSubtitles !== false,
      fontSize: fontSize ?? 42,
      marginV: marginV ?? 200,
    };

    const configPath = join(projectDir, ".render_config.json");
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    // Python render script — re-composes from existing scene videos + audio
    const renderScript = `
import sys, json, os
from pathlib import Path
sys.path.insert(0, '${SCRIPTS_DIR}')
from dotenv import load_dotenv
load_dotenv(Path('${ROOT_DIR}') / '.env')
from molo_agent import compose_edit, add_subtitles, apply_slowdown
import molo_agent
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

# Set content type from brief (critical for correct resolution + subtitle positioning)
brief_path = project_dir / 'brief.json'
if brief_path.exists():
    brief = json.loads(brief_path.read_text())
    ct_key = brief.get('contentType', 'sosyal')
else:
    ct_key = 'sosyal'
molo_agent._content_type_key = ct_key
molo_agent._ct = CONTENT_TYPES.get(ct_key, CONTENT_TYPES['sosyal']).copy()
print(f'Content type: {ct_key}')

# Collect existing scene videos and audio files
from glob import glob
video_files = sorted(glob(str(project_dir / 'scenes' / '*.mp4')))
voice_files = sorted(glob(str(project_dir / 'audio' / '*.mp3')))

if not video_files:
    print('No video files found')
    sys.exit(1)

print(f'Found {len(video_files)} videos, {len(voice_files)} audio files')
print(f'Config: {json.dumps(config, indent=2)}')

# Step 1: Compose edit — merge scene videos + audio with user settings
draft = compose_edit(video_files, voice_files, durations, project_dir, project_name,
                     crossfade=config.get('crossfade'),
                     crf=config.get('crf'),
                     transition=config.get('transition'))
if not draft:
    print('Compose failed')
    sys.exit(1)
print(f'Draft created: {draft}')

# Step 2: Add subtitles (if enabled) with user font/margin settings
if config.get('addSubtitles', True):
    lang = 'de'
    subtitled = add_subtitles(draft, scenes, durations, project_dir, project_name, lang,
                              font_size=config.get('fontSize'),
                              margin_v=config.get('marginV'))
    if subtitled:
        print(f'Subtitled: {subtitled}')
        # Step 3: Apply slowdown with user speed
        final = apply_slowdown(subtitled, project_dir, project_name,
                               speed=config.get('slowdown'))
        print(f'Final: {final}')
else:
    # No subtitles — apply slowdown directly to draft
    final = apply_slowdown(draft, project_dir, project_name,
                           speed=config.get('slowdown'))
    print(f'Final (no subs): {final}')

print('Render complete!')
`;

    const scriptPath = join(projectDir, ".render_script.py");
    await writeFile(scriptPath, renderScript, "utf-8");
    await writeFile(logPath, `[${new Date().toISOString()}] Render başlatılıyor...\nConfig: ${JSON.stringify(config)}\n`, "utf-8");

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

    return NextResponse.json({ message: "Render başlatıldı", pid: child.pid, config });
  } catch (error) {
    console.error("Render error:", error);
    return NextResponse.json({ error: `Render başlatılamadı: ${error}` }, { status: 500 });
  }
}
