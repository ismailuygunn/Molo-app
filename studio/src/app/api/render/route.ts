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
    const renderScript = [
      "import sys, json, os, subprocess, unicodedata",
      "from pathlib import Path",
      `sys.path.insert(0, '${SCRIPTS_DIR}')`,
      "from dotenv import load_dotenv",
      `load_dotenv(Path('${ROOT_DIR}') / '.env')`,
      "from molo_agent import compose_edit, add_subtitles, compose_final, get_audio_duration",
      "import molo_agent",
      "from config import *",
      "",
      `project_dir = Path('${projectDir}')`,
      `project_name = '${projectId}'.split('_', 1)[1] if '_' in '${projectId}' else '${projectId}'`,
      "",
      "# Load scenes",
      "scenes_json = project_dir / 'scenes' / 'scenes.json'",
      "if not scenes_json.exists():",
      "    print('No scenes.json found')",
      "    sys.exit(1)",
      "",
      "data = json.loads(scenes_json.read_text())",
      "scenes = data['scenes'] if isinstance(data, dict) else data",
      "durations = data.get('durations', []) if isinstance(data, dict) else []",
      `config = json.loads(Path('${configPath}').read_text())`,
      "",
      "# Set content type from brief (Turkish unicode safe)",
      "brief_path = project_dir / 'brief.md'",
      "ct_key = 'sosyal'",
      "if brief_path.exists():",
      "    brief_text = brief_path.read_text()",
      "    for line in brief_text.splitlines():",
      "        nf = unicodedata.normalize('NFKD', line).casefold().strip()",
      "        if ('erik t' in nf and ':' in nf) or 'content type:' in nf:",
      "            val = line.split(':', 1)[1].strip().lower()",
      "            if val in ['sosyal', 'ekran', 'robot']:",
      "                ct_key = val",
      "                print(f'Brief content type: {val}')",
      "",
      "# Collect existing scene videos and audio files",
      "from glob import glob",
      "video_files = sorted(glob(str(project_dir / 'scenes' / '*.mp4')))",
      "voice_files = sorted(glob(str(project_dir / 'audio' / '*.mp3')))",
      "",
      "if not video_files:",
      "    print('No video files found')",
      "    sys.exit(1)",
      "",
      "# Log source video dimensions (debug)",
      "try:",
      "    probe = subprocess.run(",
      "        ['ffprobe', '-v', 'quiet', '-select_streams', 'v:0',",
      "         '-show_entries', 'stream=width,height', '-of', 'json', video_files[0]],",
      "        capture_output=True, text=True, timeout=5)",
      "    vinfo = json.loads(probe.stdout)",
      "    streams = vinfo.get('streams', [{}])",
      "    src_w = streams[0].get('width', 0)",
      "    src_h = streams[0].get('height', 0)",
      "    print(f'Kaynak video: {src_w}x{src_h}')",
      "except Exception as e:",
      "    print(f'Video boyut okunamadi: {e}')",
      "",
      "molo_agent._content_type_key = ct_key",
      "molo_agent._ct = CONTENT_TYPES.get(ct_key, CONTENT_TYPES['sosyal']).copy()",
      "print(f'Content type: {ct_key} ({molo_agent._ct[\"width\"]}x{molo_agent._ct[\"height\"]})')",
      "",
      "print(f'Found {len(video_files)} videos, {len(voice_files)} audio files')",
      "print(f'Config: {json.dumps(config, indent=2)}')",
      "",
      "# Step 1: Per-scene merge (Encode 1)",
      "merged_scenes = compose_edit(video_files, voice_files, durations, project_dir, project_name,",
      "                             crf=config.get('crf'))",
      "if not merged_scenes:",
      "    print('Compose edit failed')",
      "    sys.exit(1)",
      "print(f'Merged scenes: {len(merged_scenes)} files')",
      "",
      "# Step 2: Generate ASS subtitles (no encode)",
      "ass_path = None",
      "if config.get('addSubtitles', True):",
      "    try:",
      "        lang = 'de'",
      "        ass_path = add_subtitles(None, scenes, durations, project_dir, project_name, lang,",
      "                                 font_size=config.get('fontSize'),",
      "                                 margin_v=config.get('marginV'))",
      "        if ass_path and os.path.exists(ass_path):",
      "            print(f'ASS subtitles: {ass_path}')",
      "        else:",
      "            print('WARN: Altyazi olusturulamadi, altyazisiz devam ediliyor')",
      "            ass_path = None",
      "    except Exception as e:",
      "        print(f'WARN: Altyazi hatasi: {e}')",
      "        ass_path = None",
      "",
      "# Step 3: Final compose - crossfade + subtitles + slowdown (Encode 2)",
      "final = compose_final(merged_scenes, ass_path, project_dir, project_name,",
      "                      crossfade=config.get('crossfade'),",
      "                      transition=config.get('transition'),",
      "                      speed=config.get('slowdown'))",
      "if not final:",
      "    print('Final compose failed')",
      "    sys.exit(1)",
      "print(f'Final: {final}')",
      "print('Render complete!')",
    ].join("\n");

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
