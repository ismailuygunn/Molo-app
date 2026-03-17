export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, resolve } from "path";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

interface SubtitleEntry {
  index: number;
  start: string;
  end: string;
  text: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectDir = join(PROJECTS_DIR, id);

  try {
    const { entries, fontSize, marginV, width, height } = await req.json() as {
      entries: SubtitleEntry[];
      fontSize: number;
      marginV: number;
      width: number;
      height: number;
    };

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: "Altyazı verisi boş" }, { status: 400 });
    }

    // Build ASS file
    const projectName = id.includes("_") ? id.split("_").slice(1).join("_") : id;

    let ass = `[Script Info]
Title: ${projectName}
ScriptType: v4.00+
PlayResX: ${width || 1080}
PlayResY: ${height || 1920}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize || 42},&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,4,0,0,2,20,20,${marginV || 200},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    for (const entry of entries) {
      // Wrap long lines with ASS \\N
      const wrapped = entry.text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\\N");
      ass += `Dialogue: 0,${entry.start},${entry.end},Default,,0,0,0,,${wrapped}\n`;
    }

    const subsDir = join(projectDir, "subtitles");
    await mkdir(subsDir, { recursive: true });
    const assPath = join(subsDir, "subs_en.ass");
    await writeFile(assPath, ass, "utf-8");

    return NextResponse.json({ message: "Altyazılar kaydedildi", path: assPath });
  } catch (error) {
    console.error("Save subtitles error:", error);
    return NextResponse.json({ error: `Kaydetme hatası: ${error}` }, { status: 500 });
  }
}
