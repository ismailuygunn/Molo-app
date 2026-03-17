export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const PROJECTS_DIR = join(process.cwd(), "..", "projects");

export async function POST(req: NextRequest) {
  try {
    const { konu, contentType, lang, tone, concept, maxScenes } = await req.json();

    if (!konu) {
      return NextResponse.json({ error: "Konu gerekli" }, { status: 400 });
    }

    // Create project directory
    const today = new Date().toISOString().split("T")[0];
    const slug = konu
      .toLowerCase()
      .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const projectId = `${today}_${slug}`;
    const projectDir = join(PROJECTS_DIR, projectId);

    // Create directories
    for (const dir of ["scenes", "audio", "draft", "final", "subtitles"]) {
      await mkdir(join(projectDir, dir), { recursive: true });
    }

    // Write brief.md
    const contentTypeLabel =
      contentType === "ekran" ? "ekran" : contentType === "robot" ? "robot" : "sosyal";

    const brief = `# ${konu}

Konu: ${konu}
Dil: ${lang}
İçerik türü: ${contentTypeLabel}
Ton: ${tone}
Maksimum sahne: ${maxScenes || 4}
${concept ? `\nKonsept:\n${concept}` : ""}
`;

    await writeFile(join(projectDir, "brief.md"), brief, "utf-8");

    return NextResponse.json({
      projectId,
      message: "Brief oluşturuldu",
    });
  } catch (error) {
    console.error("Brief creation error:", error);
    return NextResponse.json({ error: "Brief oluşturulamadı" }, { status: 500 });
  }
}
