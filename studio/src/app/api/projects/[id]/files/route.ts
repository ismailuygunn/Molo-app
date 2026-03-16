export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join, resolve, extname } from "path";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectDir = join(PROJECTS_DIR, id);

  try {
    const result: Record<string, string[]> = {
      scenes_images: [],
      scenes_videos: [],
      audio: [],
      draft: [],
      final: [],
      subtitles: [],
    };

    const dirs = [
      { name: "scenes", imgKey: "scenes_images", vidKey: "scenes_videos" },
      { name: "audio", imgKey: null, vidKey: null, audioKey: "audio" },
      { name: "draft", imgKey: null, vidKey: null, mixKey: "draft" },
      { name: "final", imgKey: null, vidKey: null, mixKey: "final" },
      { name: "subtitles", imgKey: null, vidKey: null, mixKey: "subtitles" },
    ];

    for (const dir of dirs) {
      const dirPath = join(projectDir, dir.name);
      try {
        const files = await readdir(dirPath);
        for (const file of files) {
          if (file.startsWith(".")) continue;
          const filePath = join(dirPath, file);
          const s = await stat(filePath);
          if (!s.isFile()) continue;

          const ext = extname(file).toLowerCase();
          const apiPath = `/api/files/${id}/${dir.name}/${file}`;

          if (dir.name === "scenes") {
            if ([".png", ".jpg", ".jpeg"].includes(ext)) {
              result.scenes_images.push(apiPath);
            } else if ([".mp4", ".webm"].includes(ext)) {
              result.scenes_videos.push(apiPath);
            }
          } else if (dir.name === "audio") {
            if ([".mp3", ".wav", ".m4a"].includes(ext)) {
              result.audio.push(apiPath);
            }
          } else if (dir.name === "draft") {
            result.draft.push(apiPath);
          } else if (dir.name === "final") {
            result.final.push(apiPath);
          } else if (dir.name === "subtitles") {
            result.subtitles.push(apiPath);
          }
        }
      } catch {
        // Directory might not exist yet
      }
    }

    // Sort all arrays
    for (const key of Object.keys(result)) {
      result[key].sort();
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Project files error:", error);
    return NextResponse.json({ error: "Dosyalar listelenemedi" }, { status: 500 });
  }
}
