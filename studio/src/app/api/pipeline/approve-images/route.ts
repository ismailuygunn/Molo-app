export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { join, resolve } from "path";
import { readFile, writeFile, access } from "fs/promises";

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

    // Validate approval structure
    for (const [key, value] of Object.entries(approval)) {
      if (
        !value.selectedVariant ||
        !value.frameRole ||
        typeof value.withMolo !== "boolean"
      ) {
        return NextResponse.json(
          {
            error: `Geçersiz approval verisi: sahne ${key} için selectedVariant, frameRole ve withMolo gerekli`,
          },
          { status: 400 }
        );
      }
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
    const approvalPath = join(scenesDir, "approval.json");
    const scenesJsonPath = join(scenesDir, "scenes.json");
    const resumeSignalPath = join(projectDir, ".pipeline.resume");

    // 1. Write approval.json
    const approvalData = {
      projectId,
      approval,
      approvedAt: new Date().toISOString(),
    };
    await writeFile(approvalPath, JSON.stringify(approvalData, null, 2), "utf-8");

    // 2. Update scenes.json with approval field
    try {
      const raw = await readFile(scenesJsonPath, "utf-8");
      const scenesData = JSON.parse(raw);
      scenesData.approval = approval;
      scenesData.approvedAt = new Date().toISOString();
      await writeFile(scenesJsonPath, JSON.stringify(scenesData, null, 2), "utf-8");
    } catch {
      // scenes.json may not exist yet; not fatal, approval.json is the source of truth
      console.warn("scenes.json güncellenemedi, approval.json yine de yazıldı");
    }

    // 3. Create .pipeline.resume signal file
    await writeFile(resumeSignalPath, new Date().toISOString(), "utf-8");

    return NextResponse.json({
      message: "Görseller onaylandı, ses üretimine geçiliyor",
      projectId,
      approvedScenes: Object.keys(approval).length,
    });
  } catch (error) {
    console.error("Approve images error:", error);
    return NextResponse.json(
      { error: `Onaylama hatası: ${error}` },
      { status: 500 }
    );
  }
}
