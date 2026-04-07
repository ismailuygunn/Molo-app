export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const PROJECTS_DIR = join(process.cwd(), "..", "projects");

export async function POST(req: NextRequest) {
  try {
    const { konu, contentType, lang, tone, concept, maxScenes, gsSize } = await req.json();

    if (!konu) {
      return NextResponse.json({ error: "Konu gerekli" }, { status: 400 });
    }

    // Generate project ID
    const date = new Date().toISOString().slice(0, 10);
    const slug = konu
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40);
    const projectId = `${date}_${slug}`;
    const projectDir = join(PROJECTS_DIR, projectId);

    // Create project directories
    for (const dir of ["scenes", "audio"]) {
      await mkdir(join(projectDir, dir), { recursive: true });
    }

    // Write brief.md
    const contentTypeLabel = contentType || "sosyal";

    let brief = `# ${konu}

Konu: ${konu}
Dil: ${lang}
İçerik türü: ${contentTypeLabel}
${contentType === "greenscreen" ? `Boyut: ${gsSize || "dikey"}\n` : ""}Ton: ${tone}
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
