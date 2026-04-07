export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { join, resolve } from "path";
import { readFile, writeFile, access } from "fs/promises";
import { existsSync } from "fs";

const ROOT_DIR = resolve(process.cwd(), "..");
const PROJECTS_DIR = join(ROOT_DIR, "projects");

interface FrameApproval {
  selectedVariant: string;
  frameRole: string;
  withMolo: boolean;
}

interface ApprovalMap {
  [sceneKey: string]: FrameApproval;
}

interface ApproveImagesBody {
  projectId: string;
  approval: ApprovalMap;
}

const DEFAULT_APPROVAL: FrameApproval = {
  selectedVariant: "v1",
  frameRole: "frame_1",
  withMolo: true,
};

export async function POST(req: NextRequest) {
  try {
    const body: ApproveImagesBody = await req.json();
    const { projectId, approval } = body;

    if (!projectId || !approval || typeof approval !== "object") {
      return NextResponse.json(
        { error: "projectId ve approval gerekli" },
        { status: 400 }
      );
    }

    const projectDir = join(PROJECTS_DIR, projectId);
    const resolvedProjectDir = resolve(projectDir);

    // Path traversal protection
    if (!resolvedProjectDir.startsWith(PROJECTS_DIR)) {
      return NextResponse.json(
        { error: "Geçersiz projectId" },
        { status: 400 }
      );
    }

    // Validate project exists
    try {
      await access(projectDir);
    } catch {
      return NextResponse.json(
        { error: `Proje bulunamadı: ${projectId}` },
        { status: 404 }
      );
    }

    const scenesDir = join(projectDir, "scenes");

    // Fill defaults for incomplete approvals and validate variant files
    const warnings: string[] = [];
    const finalApproval: ApprovalMap = {};

    // Read scenes.json to know all scene keys for partial approval defaults
    let allSceneKeys: string[] = [];
    const scenesJsonPath = join(scenesDir, "scenes.json");
    try {
      const raw = JSON.parse(await readFile(scenesJsonPath, "utf-8"));
      const scenesList = Array.isArray(raw) ? raw : raw.scenes || [];
      allSceneKeys = scenesList.map(
        (s: Record<string, unknown>, i: number) =>
          String(s.scene ?? `scene_${i + 1}`)
      );
    } catch {
      // If no scenes.json, just use the keys from approval
      allSceneKeys = Object.keys(approval);
    }

    for (const key of allSceneKeys) {
      const value = approval[key];
      if (!value || !value.selectedVariant || !value.frameRole) {
        // Apply defaults for missing/incomplete scene approvals
        finalApproval[key] = {
          selectedVariant:
            value?.selectedVariant || DEFAULT_APPROVAL.selectedVariant,
          frameRole: value?.frameRole || DEFAULT_APPROVAL.frameRole,
          withMolo:
            typeof value?.withMolo === "boolean"
              ? value.withMolo
              : DEFAULT_APPROVAL.withMolo,
        };
        warnings.push(
          `Sahne ${key}: eksik alan, varsayilan degerler kullanildi`
        );
      } else {
        finalApproval[key] = value;
      }

      // Verify variant file exists on disk
      const variantFile = join(
        scenesDir,
        key,
        `${finalApproval[key].selectedVariant}.png`
      );
      if (!existsSync(variantFile)) {
        warnings.push(
          `Sahne ${key}: variant dosyasi bulunamadi (${finalApproval[key].selectedVariant}.png)`
        );
        // Don't block — continue with approval
      }
    }

    const approvalPath = join(scenesDir, "approval.json");
    const resumeSignalPath = join(projectDir, ".pipeline.resume");

    // 1. Write approval.json
    const approvalData = {
      projectId,
      approval: finalApproval,
      approvedAt: new Date().toISOString(),
      warnings: warnings.length > 0 ? warnings : undefined,
    };
    await writeFile(
      approvalPath,
      JSON.stringify(approvalData, null, 2),
      "utf-8"
    );

    // 2. Update scenes.json with approval field
    try {
      const raw = await readFile(scenesJsonPath, "utf-8");
      const scenesData = JSON.parse(raw);
      scenesData.approval = finalApproval;
      scenesData.approvedAt = new Date().toISOString();
      await writeFile(
        scenesJsonPath,
        JSON.stringify(scenesData, null, 2),
        "utf-8"
      );
    } catch {
      // scenes.json may not exist yet; not fatal, approval.json is the source of truth
    }

    // 3. Create .pipeline.resume signal file
    await writeFile(resumeSignalPath, new Date().toISOString(), "utf-8");

    return NextResponse.json({
      message: "Görseller onaylandı, ses üretimine geçiliyor",
      projectId,
      approvedScenes: Object.keys(finalApproval).length,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json(
      { error: `Onaylama hatası: ${msg}` },
      { status: 500 }
    );
  }
}
