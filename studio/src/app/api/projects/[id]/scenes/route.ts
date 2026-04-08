export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readFile, mkdir } from "fs/promises";
import { join, resolve } from "path";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectDir = join(PROJECTS_DIR, id);
  const scenesDir = join(projectDir, "scenes");

  // Ensure dir exists
  await mkdir(scenesDir, { recursive: true }).catch(() => {});

  let scenes: Record<string, unknown>[] = [];
  let durations: number[] = [];
  let totalDuration = 0;
  let title = "";
  let lang = "de";
  let hookText = "";
  let hookAlternatives: string[] = [];
  let hashtags: string[] = [];
  let caption = "";
  let series: unknown = null;

  // Read scenes.json
  try {
    const raw = JSON.parse(
      await readFile(join(scenesDir, "scenes.json"), "utf-8")
    );
    if (Array.isArray(raw)) {
      scenes = raw;
    } else {
      scenes = raw.scenes || [];
      durations = raw.durations || [];
      totalDuration = raw.total_duration || 0;
      title = raw.title || "";
      lang = raw.lang || "de";
      hookText = (raw as Record<string, unknown>).hook_text as string || "";
      hookAlternatives = (raw as Record<string, unknown>).hook_alternatives as string[] || [];
      hashtags = (raw as Record<string, unknown>).hashtags as string[] || [];
      caption = (raw as Record<string, unknown>).caption as string || "";
      series = (raw as Record<string, unknown>).series || null;
    }
  } catch {
    /* no scenes yet */
  }

  // Read QC scores
  let qcScores: Record<string, unknown> = {};
  try {
    qcScores = JSON.parse(
      await readFile(join(scenesDir, "qc_scores.json"), "utf-8")
    );
  } catch {
    /* no QC scores */
  }

  // If lang not in scenes.json, try brief.md
  if (lang === "de") {
    try {
      const brief = await readFile(join(projectDir, "brief.md"), "utf-8");
      const langMap: Record<string, string> = {
        de: "de",
        deutsch: "de",
        almanca: "de",
        tr: "tr",
        "türkçe": "tr",
        turkish: "tr",
        en: "en",
        english: "en",
        ingilizce: "en",
      };
      for (const line of brief.split("\n")) {
        const ll = line.toLowerCase().trim();
        if (ll.includes("dil:") || ll.includes("language:")) {
          const rawLang = line.split(":").slice(1).join(":").trim().toLowerCase();
          for (const [key, code] of Object.entries(langMap)) {
            if (rawLang.includes(key)) {
              lang = code;
              break;
            }
          }
        }
      }
    } catch {
      /* no brief */
    }
  }

  return NextResponse.json({
    scenes,
    durations,
    totalDuration,
    title,
    lang,
    qcScores,
    hookText,
    hookAlternatives,
    hashtags,
    caption,
    series,
  });
}
