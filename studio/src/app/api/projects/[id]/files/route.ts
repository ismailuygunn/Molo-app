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
      audio: [],
    };

    const dirs = [
      { name: "scenes", key: "scenes_images", exts: [".png", ".jpg", ".jpeg"] },
      { name: "audio", key: "audio", exts: [".mp3", ".wav", ".m4a"] },
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
          if (dir.exts.includes(ext)) {
            result[dir.key].push(`/api/files/${id}/${dir.name}/${file}`);
          }
        }
      } catch {
        // Directory might not exist yet
      }
    }

    result.scenes_images.sort();
    result.audio.sort();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Project files error:", error);
    return NextResponse.json({ error: "Dosyalar listelenemedi" }, { status: 500 });
  }
}
